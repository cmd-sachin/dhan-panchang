import type { ForecastWeek, ShockId } from "./types";
import { SECTORS } from "./sectors";
import { computeForecast, type ForecastInput } from "./forecast";

// ── Model utilities on top of the on-device forecaster ──────────────────────
// The forecaster itself is a lightweight learning model: sector priors are
// Bayesian-updated by every ledger entry, live district signals condition the
// event magnitudes, and confidence bands narrow as data accumulates. This
// module adds the human-facing layers: horizon ranges, driver attribution
// ("why is money moving"), cash runway, loan affordability and goal tracking.

// ── Forecast horizons ────────────────────────────────────────────────────────
export type HorizonId = "1w" | "1m" | "3m" | "6m";

export const HORIZONS: { id: HorizonId; weeks: number; labelKey: string }[] = [
  { id: "1w", weeks: 1, labelKey: "horizon.1w" },
  { id: "1m", weeks: 4, labelKey: "horizon.1m" },
  { id: "3m", weeks: 13, labelKey: "horizon.3m" },
  { id: "6m", weeks: 26, labelKey: "horizon.6m" },
];

export function sliceHorizon(weeks: ForecastWeek[], horizon: HorizonId) {
  const n = HORIZONS.find((h) => h.id === horizon)!.weeks;
  return weeks.slice(0, n);
}

export function horizonSummary(weeks: ForecastWeek[], horizon: HorizonId) {
  const slice = sliceHorizon(weeks, horizon);
  const end = slice[slice.length - 1];
  const trough = slice.reduce((a, b) => (b.balance < a.balance ? b : a));
  const netFlow = slice.reduce((s, w) => s + w.net, 0);
  return {
    weeks: slice,
    endBalance: end.balance,
    troughWeek: trough.week,
    troughBalance: trough.balance,
    netFlow: Math.round(netFlow),
  };
}

// ── Cash runway: how long the balance stays above zero ──────────────────────
// Returns the number of weeks until the projected balance first dips below
// zero, or null if it never does within the 26-week horizon.
export function cashRunway(weeks: ForecastWeek[]): number | null {
  for (const w of weeks) {
    if (w.balance < 0) return w.week;
  }
  return null;
}

// ── Driver attribution: what moves the money, in plain language ─────────────
// Two kinds of drivers:
//  1. Category flows - each event category's total in/out over the horizon,
//     plus the steady baseline ("regular sales", "daily running costs").
//  2. Shock effects - for each active district signal, recompute the forecast
//     with that one signal neutralised; the end-balance difference IS that
//     signal's rupee impact. Counterfactual attribution, fully auditable.
export interface Driver {
  id: string;
  kind: "flow" | "shock";
  labelKey: string; // i18n key for the name
  labelParams?: Record<string, string | number>;
  amount: number; // signed ₹ impact over the horizon (+ helps, − hurts)
}

const SHOCK_LABEL: Record<ShockId, string> = {
  feed_price: "cshort.feed_price",
  monsoon: "cshort.monsoon",
  demand: "cshort.demand",
  fuel: "cshort.fuel",
};

export function computeDrivers(
  input: ForecastInput,
  weeks: ForecastWeek[],
  horizon: HorizonId,
): Driver[] {
  const slice = sliceHorizon(weeks, horizon);
  const n = slice.length;
  const sector = SECTORS[input.profile.sector];
  const drivers: Driver[] = [];

  // 1. Category flows over the horizon.
  const byCat = new Map<string, { labelKey: string; amount: number }>();
  for (const w of slice) {
    for (const e of w.events) {
      const cur = byCat.get(e.labelKey) ?? { labelKey: e.labelKey, amount: 0 };
      cur.amount += e.type === "income" ? e.amount : -e.amount;
      byCat.set(e.labelKey, cur);
    }
  }
  for (const [key, v] of byCat) {
    drivers.push({
      id: `flow_${key}`,
      kind: "flow",
      labelKey: v.labelKey,
      amount: Math.round(v.amount),
    });
  }
  // Steady baseline, lumped into two understandable rows.
  drivers.push({
    id: "flow_base_income",
    kind: "flow",
    labelKey: "driver.base_income",
    amount: Math.round(sector.baselineIncome * n),
  });
  drivers.push({
    id: "flow_base_expense",
    kind: "flow",
    labelKey: "driver.base_expense",
    amount: -Math.round(sector.baselineExpense * n),
  });

  // 2. Shock counterfactuals: neutralise one signal at a time.
  const effective = { ...input.signal.shocks, ...(input.shockOverride ?? {}) };
  const endActual = slice[n - 1].balance;
  for (const [id, mult] of Object.entries(effective) as [ShockId, number][]) {
    if (Math.abs(mult - 1) < 0.03) continue;
    const neutral = computeForecast({
      ...input,
      shockOverride: { ...(input.shockOverride ?? {}), [id]: 1 },
    });
    const endNeutral = neutral[n - 1].balance;
    const impact = Math.round(endActual - endNeutral);
    if (Math.abs(impact) < 50) continue;
    drivers.push({
      id: `shock_${id}`,
      kind: "shock",
      labelKey: SHOCK_LABEL[id],
      labelParams: { pct: Math.round(Math.abs(mult - 1) * 100) },
      amount: impact,
    });
  }

  return drivers.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

// ── Loan affordability check ─────────────────────────────────────────────────
// Adds the loan amount to today's balance, subtracts the weekly-ised EMI, and
// checks whether the projected balance stays above zero over the next 6
// months. Transparent arithmetic over the forecast - the same logic a bank's
// repayment-capacity stress test would run.
export interface LoanVerdict {
  affordable: boolean;
  tightestWeek: number;
  tightestBalance: number; // projected balance at the tightest point
}

export function checkLoan(
  weeks: ForecastWeek[],
  loanAmount: number,
  monthlyEmi: number,
): LoanVerdict {
  const weeklyEmi = (monthlyEmi * 12) / 52;
  let tightest = { week: 0, bal: Infinity };
  for (const w of weeks) {
    const adjusted = w.balance + loanAmount - weeklyEmi * (w.week + 1);
    if (adjusted < tightest.bal) tightest = { week: w.week, bal: adjusted };
  }
  return {
    affordable: tightest.bal >= 0,
    tightestWeek: tightest.week,
    tightestBalance: Math.round(tightest.bal),
  };
}

// ── Savings goal projection ──────────────────────────────────────────────────
export interface SavingsGoal {
  target: number; // ₹
  byWeek: number; // horizon week offset (e.g. 13 = ~3 months)
}

export interface GoalStatus {
  onTrack: boolean;
  projected: number; // expected balance at the goal week
  weeklyExtra: number; // ₹/week more needed if behind (0 if on track)
}

export function goalStatus(weeks: ForecastWeek[], goal: SavingsGoal): GoalStatus {
  const at = weeks[Math.min(goal.byWeek, weeks.length - 1)];
  const projected = at.balance;
  const gap = goal.target - projected;
  return {
    onTrack: gap <= 0,
    projected,
    weeklyExtra: gap > 0 ? Math.ceil(gap / Math.max(1, goal.byWeek)) : 0,
  };
}
