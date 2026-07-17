import type { EnterpriseProfile, LedgerEntry, SectorId } from "../engine/types";

// ── Field-officer portfolio (mock, calibrated) ──────────────────────────────
// A NABARD field officer's book of ~9 enterprises across sectors and
// districts. Ledgers are shaped to produce a realistic spread of risk — and
// deliberately to seed a "poultry × Nashik feed-price stress" cluster that the
// cross-enterprise intelligence surfaces.

export interface PortfolioMember {
  id: string;
  profile: EnterpriseProfile;
  ledger: LedgerEntry[];
}

let idc = 0;
function e(
  member: string,
  weekOffset: number,
  type: "income" | "expense",
  category: string,
  amount: number,
): LedgerEntry {
  return {
    id: `p_${member}_${idc++}`,
    ts: 0,
    type,
    category,
    amount,
    weekOffset,
  };
}

interface Spec {
  id: string;
  name: string;
  sector: SectorId;
  district: string;
  opening: number;
  // recent-vs-usual income multiplier per primary event (drives anomalies)
  recentIncomeMult?: number;
  primaryIncomeEvent: string;
  primaryIncomeUsual: number;
  restockEvent?: string;
  restockAmount?: number;
}

// Build a compact but realistic history: 3 "usual" primary-income points, 2
// recent points (scaled by recentIncomeMult), plus recurring cost entries.
function buildLedger(s: Spec): LedgerEntry[] {
  const rows: LedgerEntry[] = [];
  const usual = s.primaryIncomeUsual;
  const mult = s.recentIncomeMult ?? 1;
  // established "normal"
  [-19, -13, -7].forEach((w, i) =>
    rows.push(
      e(s.id, w, "income", s.primaryIncomeEvent, Math.round(usual * (1 + (i - 1) * 0.03))),
    ),
  );
  // recent
  [-2, -1].forEach((w) =>
    rows.push(e(s.id, w, "income", s.primaryIncomeEvent, Math.round(usual * mult))),
  );
  // recurring restock/material cost
  if (s.restockEvent && s.restockAmount) {
    [-19, -13, -7].forEach((w) =>
      rows.push(e(s.id, w, "expense", s.restockEvent!, s.restockAmount!)),
    );
  }
  return rows;
}

const SPECS: Spec[] = [
  {
    id: "meena",
    name: "Meena",
    sector: "poultry",
    district: "nashik",
    opening: 8000,
    recentIncomeMult: 0.77,
    primaryIncomeEvent: "batch_sale",
    primaryIncomeUsual: 18800,
    restockEvent: "chick_restock",
    restockAmount: 6500,
  },
  {
    id: "ramesh",
    name: "Ramesh Patil",
    sector: "poultry",
    district: "nashik",
    opening: 12000,
    recentIncomeMult: 0.84,
    primaryIncomeEvent: "batch_sale",
    primaryIncomeUsual: 21000,
    restockEvent: "chick_restock",
    restockAmount: 7000,
  },
  {
    id: "sunita",
    name: "Sunita SHG",
    sector: "poultry",
    district: "nashik",
    opening: 6000,
    recentIncomeMult: 0.9,
    primaryIncomeEvent: "batch_sale",
    primaryIncomeUsual: 16500,
    restockEvent: "chick_restock",
    restockAmount: 6000,
  },
  {
    id: "lakshmi",
    name: "Lakshmi Dugdha",
    sector: "dairy",
    district: "nashik",
    opening: 15000,
    recentIncomeMult: 1.02,
    primaryIncomeEvent: "milk_sale",
    primaryIncomeUsual: 2600,
  },
  {
    id: "kavita",
    name: "Kavita Dairy",
    sector: "dairy",
    district: "guntur",
    opening: 9000,
    recentIncomeMult: 0.88,
    primaryIncomeEvent: "milk_sale",
    primaryIncomeUsual: 2500,
  },
  {
    id: "fatima",
    name: "Fatima Crafts",
    sector: "handicrafts",
    district: "jaipur",
    opening: 11000,
    recentIncomeMult: 1.15,
    primaryIncomeEvent: "mela_sales",
    primaryIncomeUsual: 6000,
  },
  {
    id: "anil",
    name: "Anil Foods",
    sector: "food_processing",
    district: "guntur",
    opening: 18000,
    recentIncomeMult: 0.8,
    primaryIncomeEvent: "bulk_order",
    primaryIncomeUsual: 14000,
    restockEvent: "raw_material",
    restockAmount: 7000,
  },
  {
    id: "gita",
    name: "Gita Kirana",
    sector: "rural_retail",
    district: "ludhiana",
    opening: 14000,
    recentIncomeMult: 1.0,
    primaryIncomeEvent: "festival_spike",
    primaryIncomeUsual: 7000,
  },
  {
    id: "harpreet",
    name: "Harpreet Store",
    sector: "rural_retail",
    district: "ludhiana",
    opening: 5000,
    recentIncomeMult: 0.85,
    primaryIncomeEvent: "harvest_credit_sales",
    primaryIncomeUsual: 9000,
    restockEvent: "stock_purchase",
    restockAmount: 8000,
  },
];

export const PORTFOLIO: PortfolioMember[] = SPECS.map((s) => ({
  id: s.id,
  profile: {
    name: s.name,
    sector: s.sector,
    districtId: s.district,
    openingBalance: s.opening,
    createdWeek: 0,
  },
  ledger: buildLedger(s),
}));

// ── District-scoped portfolio (officer jurisdiction) ─────────────────────────
// In reality one officer covers ONE district (a NABARD DDM) or a branch's block
// - not the whole country. So the officer's book is limited to their district
// and generated deterministically for it (calibrated synthetic - the training
// data may be mocked; the risk signals conditioning it are live). Nashik keeps
// its curated poultry cluster so the demo story holds.

const NAME_POOL = [
  "Anita Devi", "Ravi Kumar", "Priya SHG", "Suresh Patil", "Fatima Bano",
  "Ganesh Rao", "Kamala JLG", "Iqbal Traders", "Deepa Mahila", "Vijay Store",
  "Rekha Dairy", "Manoj Poultry", "Savita SHG", "Arjun Foods", "Nasreen Crafts",
  "Balaji Kirana", "Geeta Devi", "Prakash Rao", "Shabana SHG", "Mohan Traders",
];

interface GenSpec {
  sector: SectorId;
  primaryIncomeEvent: string;
  primaryIncomeUsual: number;
  restockEvent?: string;
  restockAmount?: number;
}
const SECTOR_GEN: GenSpec[] = [
  { sector: "poultry", primaryIncomeEvent: "batch_sale", primaryIncomeUsual: 18000, restockEvent: "chick_restock", restockAmount: 6500 },
  { sector: "dairy", primaryIncomeEvent: "milk_sale", primaryIncomeUsual: 2600 },
  { sector: "food_processing", primaryIncomeEvent: "bulk_order", primaryIncomeUsual: 14000, restockEvent: "raw_material", restockAmount: 7000 },
  { sector: "handicrafts", primaryIncomeEvent: "mela_sales", primaryIncomeUsual: 6000 },
  { sector: "rural_retail", primaryIncomeEvent: "harvest_credit_sales", primaryIncomeUsual: 9000, restockEvent: "stock_purchase", restockAmount: 8000 },
];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function districtPortfolio(districtId: string): PortfolioMember[] {
  const rnd = mulberry32(hashStr(districtId));
  const members: PortfolioMember[] = [];

  // Nashik: keep the curated poultry cluster + dairy for the demo.
  if (districtId === "nashik") {
    for (const m of PORTFOLIO.filter((p) => p.profile.districtId === "nashik")) members.push(m);
  }

  const n = 8 + Math.floor(rnd() * 6); // 8-13 units
  for (let i = 0; i < n; i++) {
    const g = SECTOR_GEN[Math.floor(rnd() * SECTOR_GEN.length)];
    const id = `${districtId}_g${i}`;
    const recentMult = 0.72 + rnd() * 0.5; // 0.72-1.22 → mix of stressed & healthy
    const spec: Spec = {
      id,
      name: NAME_POOL[(hashStr(districtId) + i) % NAME_POOL.length],
      sector: g.sector,
      district: districtId,
      opening: 4000 + Math.floor(rnd() * 16000),
      recentIncomeMult: Math.round(recentMult * 100) / 100,
      primaryIncomeEvent: g.primaryIncomeEvent,
      primaryIncomeUsual: g.primaryIncomeUsual,
      restockEvent: g.restockEvent,
      restockAmount: g.restockAmount,
    };
    members.push({
      id,
      profile: {
        name: spec.name,
        sector: spec.sector,
        districtId,
        openingBalance: spec.opening,
        createdWeek: 0,
      },
      ledger: buildLedger(spec),
    });
  }
  return members;
}
