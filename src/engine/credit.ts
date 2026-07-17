import type { MemberAnalysis } from "./portfolio";
import { cashRunway } from "./model";

// ── Credit Readiness score ───────────────────────────────────────────────────
// The institutional payload: turns an enterprise's forecast + track record into
// a transparent 0-100 loan-readiness score, so a field officer / bank can see
// who is ready to move from grants to formal credit. Every point is explained
// (no black box) - this is the seed of the "Credit Readiness Passport".
//
// Five weighted factors, each mapped to plain-language reasons:
//   Cash runway      30  - how long cash stays positive
//   Net cash flow    25  - money in vs out over 6 months
//   Stability        20  - how steady the weekly balance is
//   Track record     15  - how much history has been recorded
//   Risk flags       10  - penalised by active warnings

export type CreditBand = "ready" | "developing" | "early";

export interface CreditFactor {
  key: string;
  labelKey: string;
  points: number; // awarded
  max: number;
  positive: boolean; // helps vs. drags
}

export interface CreditScore {
  score: number; // 0-100
  band: CreditBand;
  factors: CreditFactor[];
  suggestedLimit: number; // ₹ safe loan ceiling, 0 if not ready
}

function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
  return Math.sqrt(v);
}

export function creditScore(a: MemberAnalysis): CreditScore {
  const weeks = a.weeks;
  const netFlow = weeks.reduce((s, w) => s + w.net, 0);
  const avgBalance = weeks.reduce((s, w) => s + w.balance, 0) / weeks.length;

  // 1. Cash runway (30) - never dips negative = full marks.
  const runway = cashRunway(weeks);
  const runwayPts = runway == null ? 30 : Math.round((Math.min(runway, 26) / 26) * 30);

  // 2. Net cash flow (25) - positive six-month flow, scaled.
  const netPts = netFlow > 0 ? Math.round(Math.min(netFlow / 60000, 1) * 25) : 0;

  // 3. Stability (20) - low volatility of the weekly balance vs. its level.
  const cv = avgBalance > 0 ? stdDev(weeks.map((w) => w.balance)) / avgBalance : 2;
  const stabilityPts = Math.round(Math.max(0, 1 - Math.min(cv, 1)) * 20);

  // 4. Track record (15) - entries recorded (caps at ~12).
  const historyPts = Math.round(Math.min(a.member.ledger.length / 12, 1) * 15);

  // 5. Risk flags (10) - full marks if clean, penalised by warnings.
  const flagPts = a.status === "risk" ? 0 : a.status === "watch" ? 5 : 10;

  const score = Math.max(0, Math.min(100, runwayPts + netPts + stabilityPts + historyPts + flagPts));
  const band: CreditBand = score >= 70 ? "ready" : score >= 45 ? "developing" : "early";

  // Suggested safe limit: only when developing/ready. Roughly half of the
  // projected positive flow, nudged by band. Conservative by design.
  const base = Math.max(0, netFlow) * 0.5;
  const suggestedLimit =
    band === "ready"
      ? Math.round(base / 1000) * 1000
      : band === "developing"
        ? Math.round((base * 0.5) / 1000) * 1000
        : 0;

  return {
    score,
    band,
    suggestedLimit,
    factors: [
      { key: "runway", labelKey: "credit.f_runway", points: runwayPts, max: 30, positive: runwayPts >= 15 },
      { key: "netflow", labelKey: "credit.f_netflow", points: netPts, max: 25, positive: netPts >= 12 },
      { key: "stability", labelKey: "credit.f_stability", points: stabilityPts, max: 20, positive: stabilityPts >= 10 },
      { key: "history", labelKey: "credit.f_history", points: historyPts, max: 15, positive: historyPts >= 8 },
      { key: "flags", labelKey: "credit.f_flags", points: flagPts, max: 10, positive: flagPts >= 5 },
    ],
  };
}

export const bandColor: Record<CreditBand, string> = {
  ready: "var(--surplus)",
  developing: "var(--tight)",
  early: "var(--deficit)",
};
