// ── Dhan-Panchang sync server ────────────────────────────────────────────────
// Small REST API that persists app data to MongoDB Atlas. The PWA stays
// offline-first: localStorage is the source of truth on the device, and this
// server receives structured pushes whenever the device is online.
//
//   Database: dhan_panchang
//   Collections (with JSON-schema validation + indexes):
//     enterprises     one doc per enterprise (profile + goal + language)
//     ledger_entries  one doc per money-diary entry, keyed to enterprise
//     signals         latest district signal pack observed by any device
//
// Secrets live in .env (git-ignored). Run: npm run server

import express from "express";
import cors from "cors";
import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set. Put it in .env and run: npm run server");
  process.exit(1);
}
const PORT = Number(process.env.PORT ?? 8787);

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
});

const SECTORS = ["dairy", "poultry", "food_processing", "handicrafts", "rural_retail"];

// ── Schema: created with validators so bad writes are rejected by the DB ────
async function ensureSchema(db) {
  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));

  if (!existing.has("enterprises")) {
    await db.createCollection("enterprises", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["_id", "name", "sector", "districtId", "openingBalance", "updatedAt"],
          properties: {
            _id: { bsonType: "string", description: "device-generated enterprise id" },
            name: { bsonType: "string", minLength: 1 },
            sector: { enum: SECTORS },
            districtId: { bsonType: "string" },
            stateId: { bsonType: "string" },
            openingBalance: { bsonType: ["int", "long", "double"] },
            createdWeek: { bsonType: ["int", "long", "double"] },
            lang: { bsonType: "string" },
            goal: {
              bsonType: ["object", "null"],
              properties: {
                target: { bsonType: ["int", "long", "double"], minimum: 0 },
                byWeek: { bsonType: ["int", "long", "double"], minimum: 0 },
              },
            },
            createdAt: { bsonType: "date" },
            updatedAt: { bsonType: "date" },
          },
        },
      },
    });
  }

  if (!existing.has("ledger_entries")) {
    await db.createCollection("ledger_entries", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["_id", "enterpriseId", "type", "category", "amount", "weekOffset"],
          properties: {
            _id: { bsonType: "string", description: "device-generated entry id" },
            enterpriseId: { bsonType: "string" },
            type: { enum: ["income", "expense"] },
            category: { bsonType: "string" },
            amount: { bsonType: ["int", "long", "double"], minimum: 0 },
            note: { bsonType: "string" },
            weekOffset: { bsonType: ["int", "long", "double"] },
            ts: { bsonType: ["int", "long", "double"] },
            syncedAt: { bsonType: "date" },
          },
        },
      },
    });
  }

  if (!existing.has("signals")) {
    await db.createCollection("signals", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["_id", "shocks", "updatedAt"],
          properties: {
            _id: { bsonType: "string", description: "districtId" },
            shocks: {
              bsonType: "object",
              properties: {
                feed_price: { bsonType: ["int", "long", "double"] },
                monsoon: { bsonType: ["int", "long", "double"] },
                demand: { bsonType: ["int", "long", "double"] },
                fuel: { bsonType: ["int", "long", "double"] },
              },
            },
            fetchedAt: { bsonType: ["date", "null"] },
            updatedAt: { bsonType: "date" },
          },
        },
      },
    });
  }

  if (!existing.has("loan_decisions")) {
    await db.createCollection("loan_decisions", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["_id", "enterpriseId", "status", "updatedAt"],
          properties: {
            _id: { bsonType: "string" }, // = enterpriseId (one live decision each)
            enterpriseId: { bsonType: "string" },
            enterpriseName: { bsonType: "string" },
            sector: { bsonType: "string" },
            status: { enum: ["recommended", "approved", "hold", "declined"] },
            amount: { bsonType: ["int", "long", "double"], minimum: 0 },
            note: { bsonType: "string" },
            officer: { bsonType: "string" },
            createdAt: { bsonType: "date" },
            updatedAt: { bsonType: "date" },
          },
        },
      },
    });
  }

  await db.collection("ledger_entries").createIndex({ enterpriseId: 1, weekOffset: 1 });
  await db.collection("enterprises").createIndex({ districtId: 1, sector: 1 });
  await db.collection("loan_decisions").createIndex({ status: 1, updatedAt: -1 });
}

// ── App ──────────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: "512kb" }));

let db;

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Full-state upsert from a device: enterprise profile, goal, ledger, and the
// device's latest cached district signal. Local state wins (offline-first).
app.put("/api/enterprises/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const { profile, goal, lang, ledger, signal } = req.body ?? {};
    if (!profile?.name || !SECTORS.includes(profile.sector)) {
      return res.status(400).json({ error: "invalid profile" });
    }
    const now = new Date();

    // Only set optional fields when present - `undefined` serialises to null,
    // which the collection validator rightly rejects.
    const set = {
      name: String(profile.name),
      sector: profile.sector,
      districtId: String(profile.districtId),
      openingBalance: Number(profile.openingBalance) || 0,
      createdWeek: Number(profile.createdWeek) || 0,
      goal: goal ?? null,
      updatedAt: now,
    };
    if (profile.stateId) set.stateId = String(profile.stateId);
    if (lang) set.lang = String(lang);

    await db.collection("enterprises").updateOne(
      { _id: id },
      { $set: set, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );

    let entries = 0;
    if (Array.isArray(ledger) && ledger.length > 0) {
      const ops = ledger
        .filter((e) => e && e.id && (e.type === "income" || e.type === "expense"))
        .map((e) => ({
          replaceOne: {
            filter: { _id: String(e.id) },
            replacement: {
              _id: String(e.id),
              enterpriseId: id,
              type: e.type,
              category: String(e.category ?? "other"),
              amount: Math.max(0, Number(e.amount) || 0),
              ...(e.note ? { note: String(e.note) } : {}),
              weekOffset: Number(e.weekOffset) || 0,
              ts: Number(e.ts) || 0,
              syncedAt: now,
            },
            upsert: true,
          },
        }));
      if (ops.length > 0) {
        const result = await db.collection("ledger_entries").bulkWrite(ops, { ordered: false });
        entries = result.upsertedCount + result.modifiedCount + result.matchedCount;
      }
    }

    if (signal?.districtId && signal?.shocks) {
      await db.collection("signals").updateOne(
        { _id: String(signal.districtId) },
        {
          $set: {
            shocks: signal.shocks,
            fetchedAt: signal.fetchedAt ? new Date(signal.fetchedAt) : null,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
    }

    res.json({ ok: true, entries });
  } catch (err) {
    console.error("PUT /api/enterprises failed:", err.message);
    res.status(500).json({ error: "sync failed" });
  }
});

// Restore an enterprise onto a device.
app.get("/api/enterprises/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const enterprise = await db.collection("enterprises").findOne({ _id: id });
    if (!enterprise) return res.status(404).json({ error: "not found" });
    const ledger = await db
      .collection("ledger_entries")
      .find({ enterpriseId: id })
      .sort({ weekOffset: 1, ts: 1 })
      .toArray();
    res.json({ enterprise, ledger });
  } catch (err) {
    console.error("GET /api/enterprises/:id failed:", err.message);
    res.status(500).json({ error: "fetch failed" });
  }
});

// Institutional view: every enterprise in the book - the live officer feed.
// ?full=1 also returns each enterprise's ledger so risk can be computed.
app.get("/api/enterprises", async (req, res) => {
  try {
    const full = req.query.full === "1";
    const list = await db
      .collection("enterprises")
      .find({}, full ? {} : { projection: { name: 1, sector: 1, districtId: 1, updatedAt: 1 } })
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();
    if (!full) return res.json({ enterprises: list });

    const ids = list.map((e) => e._id);
    const entries = await db
      .collection("ledger_entries")
      .find({ enterpriseId: { $in: ids } })
      .sort({ weekOffset: 1, ts: 1 })
      .toArray();
    const byEnt = new Map(ids.map((id) => [id, []]));
    for (const e of entries) byEnt.get(e.enterpriseId)?.push(e);
    res.json({
      enterprises: list.map((e) => ({ ...e, ledger: byEnt.get(e._id) ?? [] })),
    });
  } catch (err) {
    console.error("GET /api/enterprises failed:", err.message);
    res.status(500).json({ error: "fetch failed" });
  }
});

// ── Live district signals (real government + weather sources) ────────────────
//   feed_price ← data.gov.in Agmarknet daily mandi prices (Maize modal price,
//                state median, national fallback)            [live, govt]
//   monsoon    ← Open-Meteo 16-day precipitation outlook     [live]
//   demand/fuel← still baseline (next: NPCI UPI stats, PPAC fuel RSP)
// Cached in the `signals` collection with a 6h TTL. Client passes state/lat/lon.
const DATA_GOV_KEY =
  process.env.DATA_GOV_API_KEY ?? "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b";
const MANDI_RESOURCE = "9ef84268-d588-465a-a308-a864a43d0070";
const SIGNAL_TTL_MS = 6 * 60 * 60 * 1000;

// Fetch a sector-relevant commodity's live modal price (Agmarknet), state
// median with national fallback, and its % vs the long-run reference.
async function fetchCommodity(commodity, refPrice, stateName) {
  const c = encodeURIComponent(commodity || "Maize");
  const ref = Number(refPrice) > 0 ? Number(refPrice) : 2000;
  const fetchPrices = async (filters) => {
    const url =
      `https://api.data.gov.in/resource/${MANDI_RESOURCE}?api-key=${DATA_GOV_KEY}` +
      `&format=json&limit=60&filters%5Bcommodity%5D=${c}${filters}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.records ?? [])
      .map((r) => Number(r.modal_price))
      .filter((p) => Number.isFinite(p) && p > 100 && p < 100000);
  };
  let prices = stateName
    ? await fetchPrices(`&filters%5Bstate%5D=${encodeURIComponent(stateName)}`)
    : [];
  if (prices.length < 3) prices = await fetchPrices("");
  if (prices.length === 0) return null;
  prices.sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];
  const mult = Math.max(0.85, Math.min(1.3, median / ref));
  const pctVsNormal = Math.round((median / ref - 1) * 100);
  return {
    mult: Math.round(mult * 100) / 100,
    median,
    samples: prices.length,
    pctVsNormal,
    commodity: commodity || "Maize",
  };
}

// Real weather: 16-day rain (monsoon multiplier) + current temp + next-week
// heat and heavy-rain peaks. IMD thresholds: heatwave (plains) >= 40C,
// heavy rain >= 64.5mm/day.
async function fetchWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m&daily=precipitation_sum,temperature_2m_max` +
    `&forecast_days=16&timezone=auto`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const json = await res.json();
  const rain = json.daily?.precipitation_sum;
  const tmax = json.daily?.temperature_2m_max;
  if (!rain) return null;
  const total = rain.reduce((a, b) => a + (b ?? 0), 0);
  const mult = 0.88 + (Math.min(total, 180) / 180) * 0.27;
  const next7Rain = rain.slice(0, 7);
  const next7Tmax = (tmax ?? []).slice(0, 7);
  return {
    mult: Math.round(mult * 100) / 100,
    rainMm: Math.round(total),
    maxRainDayMm: Math.round(Math.max(0, ...next7Rain)),
    tempNowC: json.current?.temperature_2m ?? null,
    tempMaxC: next7Tmax.length ? Math.round(Math.max(...next7Tmax)) : null,
  };
}

app.get("/api/signals/:districtId", async (req, res) => {
  try {
    const districtId = String(req.params.districtId);
    const { state, lat, lon } = req.query;
    const commodity = req.query.commodity ? String(req.query.commodity) : "Maize";
    const ref = req.query.ref ? Number(req.query.ref) : 2000;
    // cache per district + commodity (weather is district-level, market is per-business-commodity)
    const cacheId = `${districtId}:${commodity}`;

    const cached = await db.collection("signals").findOne({ _id: cacheId });
    if (cached?.live && Date.now() - new Date(cached.updatedAt).getTime() < SIGNAL_TTL_MS) {
      return res.json({ shocks: cached.shocks, meta: cached.meta, cachedAt: cached.updatedAt });
    }

    const [mkt, wx] = await Promise.all([
      fetchCommodity(commodity, ref, state ? String(state) : null).catch(() => null),
      lat && lon ? fetchWeather(Number(lat), Number(lon)).catch(() => null) : null,
    ]);
    if (!mkt && !wx) return res.status(502).json({ error: "no live sources reachable" });

    const shocks = {};
    if (mkt) shocks.feed_price = mkt.mult;
    if (wx) shocks.monsoon = wx.mult;
    const meta = {
      ...(mkt
        ? {
            commodity: mkt.commodity,
            commodityPrice: mkt.median,
            commodityPctVsNormal: mkt.pctVsNormal,
            mandiSamples: mkt.samples,
            // kept for back-compat with existing clients
            maizeMedianPrice: mkt.median,
            feedPctVsNormal: mkt.pctVsNormal,
          }
        : {}),
      ...(wx
        ? {
            rain16dMm: wx.rainMm,
            maxRainDayMm: wx.maxRainDayMm,
            tempNowC: wx.tempNowC,
            tempMaxC: wx.tempMaxC,
          }
        : {}),
      sources: [
        ...(mkt ? ["agmarknet:data.gov.in"] : []),
        ...(wx ? ["open-meteo"] : []),
      ],
    };
    const now = new Date();
    await db.collection("signals").updateOne(
      { _id: cacheId },
      { $set: { districtId, commodity, shocks, meta, live: true, fetchedAt: now, updatedAt: now } },
      { upsert: true },
    );
    // Append a dated snapshot to build a real covariate time-series for training.
    const day = now.toISOString().slice(0, 10);
    await db.collection("signal_history").updateOne(
      { _id: `${cacheId}:${day}` },
      { $set: { districtId, commodity, day, shocks, meta, ts: now } },
      { upsert: true },
    );
    res.json({ shocks, meta, cachedAt: now });
  } catch (err) {
    console.error("GET /api/signals failed:", err.message);
    res.status(500).json({ error: "signal fetch failed" });
  }
});

// Device reset → remove the enterprise and its ledger.
app.delete("/api/enterprises/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    await db.collection("ledger_entries").deleteMany({ enterpriseId: id });
    await db.collection("enterprises").deleteOne({ _id: id });
    await db.collection("loan_decisions").deleteOne({ _id: id });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/enterprises failed:", err.message);
    res.status(500).json({ error: "delete failed" });
  }
});

// Bulk-seed an officer's book (enterprises + ledgers) into MongoDB, so the
// officer's data genuinely lives in the DB and can be read/updated/deleted.
app.post("/api/portfolio/seed", async (req, res) => {
  try {
    const members = Array.isArray(req.body?.members) ? req.body.members : [];
    const now = new Date();
    let enterprises = 0;
    let entries = 0;
    for (const m of members) {
      const p = m.profile;
      if (!p?.name || !SECTORS.includes(p.sector) || !m.id) continue;
      const set = {
        name: String(p.name),
        sector: p.sector,
        districtId: String(p.districtId),
        openingBalance: Number(p.openingBalance) || 0,
        createdWeek: Number(p.createdWeek) || 0,
        updatedAt: now,
      };
      if (p.stateId) set.stateId = String(p.stateId);
      await db
        .collection("enterprises")
        .updateOne({ _id: m.id }, { $set: set, $setOnInsert: { createdAt: now } }, { upsert: true });
      enterprises++;
      const ops = (m.ledger ?? [])
        .filter((e) => e?.id && (e.type === "income" || e.type === "expense"))
        .map((e) => ({
          replaceOne: {
            filter: { _id: `${m.id}:${e.id}` },
            replacement: {
              _id: `${m.id}:${e.id}`,
              enterpriseId: m.id,
              type: e.type,
              category: String(e.category ?? "other"),
              amount: Math.max(0, Number(e.amount) || 0),
              weekOffset: Number(e.weekOffset) || 0,
              ts: Number(e.ts) || 0,
              syncedAt: now,
            },
            upsert: true,
          },
        }));
      if (ops.length) {
        const r = await db.collection("ledger_entries").bulkWrite(ops, { ordered: false });
        entries += r.upsertedCount + r.modifiedCount + r.matchedCount;
      }
    }
    res.json({ ok: true, enterprises, entries });
  } catch (err) {
    console.error("POST /api/portfolio/seed failed:", err.message);
    res.status(500).json({ error: "seed failed" });
  }
});

// ── Loan decisions: full CRUD for the officer's lending workflow ─────────────
app.get("/api/decisions", async (_req, res) => {
  try {
    const list = await db.collection("loan_decisions").find({}).sort({ updatedAt: -1 }).toArray();
    res.json({ decisions: list });
  } catch (err) {
    console.error("GET /api/decisions failed:", err.message);
    res.status(500).json({ error: "fetch failed" });
  }
});

const DECISION_STATUS = ["recommended", "approved", "hold", "declined"];

// Create or update a decision (upsert).
app.put("/api/decisions/:enterpriseId", async (req, res) => {
  try {
    const enterpriseId = String(req.params.enterpriseId);
    const { status, amount, note, enterpriseName, sector, officer } = req.body ?? {};
    if (!DECISION_STATUS.includes(status)) return res.status(400).json({ error: "invalid status" });
    const now = new Date();
    const set = { enterpriseId, status, amount: Math.max(0, Number(amount) || 0), updatedAt: now };
    if (note) set.note = String(note);
    if (enterpriseName) set.enterpriseName = String(enterpriseName);
    if (sector) set.sector = String(sector);
    if (officer) set.officer = String(officer);
    await db
      .collection("loan_decisions")
      .updateOne({ _id: enterpriseId }, { $set: set, $setOnInsert: { createdAt: now } }, { upsert: true });
    const saved = await db.collection("loan_decisions").findOne({ _id: enterpriseId });
    res.json({ ok: true, decision: saved });
  } catch (err) {
    console.error("PUT /api/decisions failed:", err.message);
    res.status(500).json({ error: "save failed" });
  }
});

app.delete("/api/decisions/:enterpriseId", async (req, res) => {
  try {
    const r = await db.collection("loan_decisions").deleteOne({ _id: String(req.params.enterpriseId) });
    res.json({ ok: true, deleted: r.deletedCount });
  } catch (err) {
    console.error("DELETE /api/decisions failed:", err.message);
    res.status(500).json({ error: "delete failed" });
  }
});

// ── Boot ─────────────────────────────────────────────────────────────────────
try {
  await client.connect();
  db = client.db("dhan_panchang");
  await ensureSchema(db);
  await db.command({ ping: 1 });
  app.listen(PORT, () => {
    console.log(`Dhan-Panchang sync server on http://localhost:${PORT} (MongoDB Atlas connected)`);
  });
} catch (err) {
  console.error("Failed to start:", err.message);
  process.exit(1);
}
