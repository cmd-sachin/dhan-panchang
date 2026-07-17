import type {
  ForecastWeek,
  LedgerEntry,
  RiskFlag,
  ShockId,
  SignalPack,
  EnterpriseProfile,
} from "./types";
import { SECTORS } from "./sectors";

// ── Anomaly detection + risk flagging ───────────────────────────────────────
// Two independent signals, combined:
//   1. Self-anomaly: the enterprise's OWN recent history vs. its personal
//      "normal" (runs fully offline, no external data needed).
//   2. Structural gap: the forecast projects the balance crossing a floor →
//      flag the gap week, amount, and a named cause from the Signal Pack.
// Every flag carries a named cause + gap week + gap amount + mapped action.

const SAFETY_FLOOR = 0; // balance below this is a liquidity risk

function recentByCategory(ledger: LedgerEntry[], weeksBack = 4) {
  const cutoff = -weeksBack;
  const map = new Map<string, number[]>();
  for (const e of ledger) {
    if (e.weekOffset < cutoff || e.weekOffset > 0) continue;
    if (!map.has(e.category)) map.set(e.category, []);
    map.get(e.category)!.push(e.amount);
  }
  return map;
}

function baselineByCategory(ledger: LedgerEntry[]) {
  const map = new Map<string, number[]>();
  for (const e of ledger) {
    if (e.weekOffset > -4) continue; // older history = "usual"
    if (!map.has(e.category)) map.set(e.category, []);
    map.get(e.category)!.push(e.amount);
  }
  return map;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// The dominant shock in the Signal Pack, used to name a cause. Restricted to
// shocks the enterprise's SECTOR is actually exposed to — so a kirana shop is
// never blamed on "feed prices". `relevant` is the set of shock ids that at
// least one of the sector's events carries a sensitivity for.
function dominantShock(
  signal: SignalPack,
  relevant: Set<ShockId>,
): { id: ShockId; mult: number } | null {
  let best: { id: ShockId; mult: number } | null = null;
  for (const [k, m] of Object.entries(signal.shocks)) {
    if (!relevant.has(k as ShockId)) continue;
    const dev = Math.abs(m - 1);
    if (dev > 0.08 && (!best || dev > Math.abs(best.mult - 1))) {
      best = { id: k as ShockId, mult: m };
    }
  }
  return best;
}

const SHOCK_CAUSE: Record<ShockId, string> = {
  feed_price: "cause.feed_price",
  monsoon: "cause.monsoon",
  demand: "cause.demand",
  fuel: "cause.fuel",
};

const SHOCK_ACTION: Record<ShockId, string> = {
  feed_price: "action.stock_feed",
  monsoon: "action.buffer_savings",
  demand: "action.pre_book",
  fuel: "action.consolidate_trips",
};

export function detectFlags(
  profile: EnterpriseProfile,
  ledger: LedgerEntry[],
  forecast: ForecastWeek[],
  signal: SignalPack,
): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const sector = SECTORS[profile.sector];

  // Shocks this sector is structurally exposed to (union of event sensitivities).
  const relevantShocks = new Set<ShockId>();
  for (const ev of sector.events) {
    if (!ev.sensitivity) continue;
    for (const k of Object.keys(ev.sensitivity)) relevantShocks.add(k as ShockId);
  }

  // 1) Self-anomaly on primary income category.
  const recent = recentByCategory(ledger);
  const base = baselineByCategory(ledger);
  for (const ev of sector.events) {
    if (ev.type !== "income") continue;
    const r = recent.get(ev.id);
    const b = base.get(ev.id);
    if (!r || !b || r.length < 1 || b.length < 2) continue;
    const rm = mean(r);
    const bm = mean(b);
    if (bm <= 0) continue;
    const drop = (bm - rm) / bm;
    if (drop >= 0.15) {
      flags.push({
        id: `anomaly_${ev.id}`,
        severity: drop >= 0.25 ? "red" : "amber",
        causeKey: "cause.income_drop",
        causeParams: {
          pct: Math.round(drop * 100),
          eventKey: ev.labelKey,
        },
        gapWeek: 0,
        gapAmount: Math.round(bm - rm),
        // Income drop → demand-side action, not the expense-shock action.
        actionKey: "action.pre_book",
      });
    }
  }

  // 2) Structural liquidity gap from the forecast trough.
  const trough = forecast.reduce((a, b) => (b.lo < a.lo ? b : a));
  if (trough.lo < SAFETY_FLOOR && trough.week > 0) {
    const shock = dominantShock(signal, relevantShocks);
    flags.push({
      id: "liquidity_gap",
      severity: trough.balance < SAFETY_FLOOR ? "red" : "amber",
      causeKey: shock ? SHOCK_CAUSE[shock.id] : "cause.seasonal_dip",
      causeParams: shock
        ? { pct: Math.round(Math.abs(shock.mult - 1) * 100) }
        : undefined,
      gapWeek: trough.week,
      gapAmount: Math.abs(Math.round(Math.min(trough.balance, trough.lo))),
      actionKey: shock ? SHOCK_ACTION[shock.id] : "action.buffer_savings",
    });
  }

  // Sort: red before amber, then soonest gap first.
  return flags.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "red" ? -1 : 1;
    return a.gapWeek - b.gapWeek;
  });
}
