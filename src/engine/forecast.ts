import type {
  EnterpriseProfile,
  ForecastWeek,
  LedgerEntry,
  MoneyEvent,
  ShockId,
  SignalPack,
} from "./types";
import { SECTORS } from "./sectors";

export const HORIZON = 26; // weeks (~6 months)

export interface ForecastInput {
  profile: EnterpriseProfile;
  ledger: LedgerEntry[];
  signal: SignalPack;
  // Optional what-if shock overrides (multipliers) layered on the Signal Pack.
  shockOverride?: Partial<Record<ShockId, number>>;
}

// Apply a shock multiplier to an event's magnitude via its sensitivities.
// sensitivity s and shock multiplier m (1 = normal): effect = 1 + s*(m-1).
function shockedMean(
  ev: MoneyEvent,
  shocks: Record<ShockId, number>,
): number {
  if (!ev.sensitivity) return ev.mean;
  let factor = 1;
  for (const [k, s] of Object.entries(ev.sensitivity)) {
    const m = shocks[k as ShockId] ?? 1;
    factor += (s as number) * (m - 1);
  }
  return ev.mean * Math.max(0, factor);
}

// ── Bayesian personalisation ────────────────────────────────────────────────
// Each entry the owner records shifts the posterior for its category toward
// the observed value (conjugate-style shrinkage). Sparse data → stay near the
// sector prior; more entries → trust the owner's own history. This is what
// makes the model useful from day one yet personal over time.
interface Posterior {
  mean: number; // personalised per-occurrence mean
  n: number; // effective observation count
}

const PRIOR_STRENGTH = 3; // pseudo-counts: prior worth ~3 observations

function personalise(
  events: MoneyEvent[],
  ledger: LedgerEntry[],
): Map<string, Posterior> {
  const post = new Map<string, Posterior>();
  for (const ev of events) post.set(ev.id, { mean: ev.mean, n: 0 });

  // Group observed amounts by category (matched to event id).
  const obs = new Map<string, number[]>();
  for (const e of ledger) {
    if (!obs.has(e.category)) obs.set(e.category, []);
    obs.get(e.category)!.push(e.amount);
  }

  for (const ev of events) {
    const xs = obs.get(ev.id);
    if (!xs || xs.length === 0) continue;
    const obsMean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const n = xs.length;
    // Shrinkage: weighted average of prior mean and observed mean.
    const mean =
      (PRIOR_STRENGTH * ev.mean + n * obsMean) / (PRIOR_STRENGTH + n);
    post.set(ev.id, { mean, n });
  }
  return post;
}

// Confidence band scale: wide when data is sparse, narrows with entries.
// Returned as a fractional half-width applied to cumulative balance.
export function dataConfidence(ledger: LedgerEntry[]): number {
  const n = ledger.length;
  // 0 entries → ~0.35 band; asymptotically → ~0.08.
  return 0.08 + 0.27 / (1 + n / 6);
}

export function computeForecast(input: ForecastInput): ForecastWeek[] {
  const { profile, ledger, signal, shockOverride } = input;
  const sector = SECTORS[profile.sector];
  const shocks = { ...signal.shocks, ...(shockOverride ?? {}) };
  const post = personalise(sector.events, ledger);
  const bandScale = dataConfidence(ledger);

  const weeks: ForecastWeek[] = [];
  let balance = profile.openingBalance;
  let variance = 0;

  for (let w = 0; w < HORIZON; w++) {
    let income = sector.baselineIncome;
    let expense = sector.baselineExpense;
    let weekVar = 0;
    const events: ForecastWeek["events"] = [];

    for (const ev of sector.events) {
      const fires =
        ev.cadence === "weekly" || (ev.weeks?.includes(w) ?? false);
      if (!fires) continue;
      const pm = post.get(ev.id)!;
      // Personalised mean, then re-expose to shocks (shocks act on structure).
      const base = pm.mean;
      const amount = shockedMean({ ...ev, mean: base }, shocks);
      if (ev.type === "income") income += amount;
      else expense += amount;
      weekVar += Math.pow(amount * ev.cv, 2);
      events.push({ labelKey: ev.labelKey, type: ev.type, amount });
    }

    const net = income - expense;
    balance += net;
    variance += weekVar;
    const sd = Math.sqrt(variance);
    // Combine intrinsic event variance with data-sparsity band.
    const half = 1.6 * sd + Math.abs(balance) * bandScale;

    weeks.push({
      week: w,
      income: Math.round(income),
      expense: Math.round(expense),
      net: Math.round(net),
      balance: Math.round(balance),
      lo: Math.round(balance - half),
      hi: Math.round(balance + half),
      events,
    });
  }
  return weeks;
}

// Convenience: derived headline numbers for the home screen.
export function forecastSummary(weeks: ForecastWeek[]) {
  const end = weeks[weeks.length - 1];
  const trough = weeks.reduce((a, b) => (b.balance < a.balance ? b : a));
  const netFlow = weeks.reduce((s, w) => s + w.net, 0);
  return {
    endBalance: end.balance,
    troughWeek: trough.week,
    troughBalance: trough.balance,
    netFlow: Math.round(netFlow),
  };
}
