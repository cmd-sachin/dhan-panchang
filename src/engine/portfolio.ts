import type { ForecastWeek, RiskFlag, SectorId, ShockId } from "./types";
import { SECTORS } from "./sectors";
import { getSignalPack } from "./signals";
import { computeForecast, forecastSummary } from "./forecast";
import { detectFlags } from "./anomaly";
import { creditScore, type CreditScore } from "./credit";
import { PORTFOLIO, type PortfolioMember } from "../data/portfolio";

export type Status = "healthy" | "watch" | "risk";

export interface MemberAnalysis {
  member: PortfolioMember;
  status: Status;
  riskScore: number; // higher = more urgent
  timeToGap: number | null; // weeks until first gap (null if none)
  atRisk: number; // ₹ exposure across flags
  flags: RiskFlag[];
  endBalance: number;
  weeks: ForecastWeek[];
  credit: CreditScore;
}

function statusOf(flags: RiskFlag[]): Status {
  if (flags.some((f) => f.severity === "red")) return "risk";
  if (flags.length > 0) return "watch";
  return "healthy";
}

export function analyseMember(member: PortfolioMember): MemberAnalysis {
  const signal = getSignalPack(member.profile.districtId);
  const weeks = computeForecast({ profile: member.profile, ledger: member.ledger, signal });
  const flags = detectFlags(member.profile, member.ledger, weeks, signal);
  const summary = forecastSummary(weeks);

  const atRisk = flags.reduce((s, f) => s + f.gapAmount, 0);
  const gapWeeks = flags.map((f) => f.gapWeek);
  const timeToGap = gapWeeks.length ? Math.min(...gapWeeks) : null;

  // Urgency score: severity + imminence + magnitude + shrinking runway.
  let score = 0;
  for (const f of flags) {
    score += f.severity === "red" ? 100 : 40;
    score += Math.max(0, 26 - f.gapWeek) * 2;
    score += f.gapAmount / 1500;
  }
  if (summary.endBalance < 0) score += 50;

  const analysis: MemberAnalysis = {
    member,
    status: statusOf(flags),
    riskScore: Math.round(score),
    timeToGap,
    atRisk,
    flags,
    endBalance: summary.endBalance,
    weeks,
    credit: { score: 0, band: "early", factors: [], suggestedLimit: 0 },
  };
  analysis.credit = creditScore(analysis);
  return analysis;
}

export function analysePortfolio(members: PortfolioMember[] = PORTFOLIO): MemberAnalysis[] {
  return members.map(analyseMember).sort((a, b) => b.riskScore - a.riskScore);
}

// ── Cluster / portfolio intelligence ────────────────────────────────────────
// Detects correlated risk across the officer's book — e.g. "feed-price stress
// across all poultry units this month" — so interventions can be batched.
// Systemic early warning at scale (feature B3 in the concept).

const SHOCK_CAUSES = new Set([
  "cause.feed_price",
  "cause.monsoon",
  "cause.demand",
  "cause.fuel",
]);

const CAUSE_SHOCK: Record<string, ShockId> = {
  "cause.feed_price": "feed_price",
  "cause.monsoon": "monsoon",
  "cause.demand": "demand",
  "cause.fuel": "fuel",
};

export interface Cluster {
  sector: SectorId;
  districtId: string;
  causeKey: string;
  count: number;
  total: number; // total units of that sector+district in the book
  atRisk: number; // combined ₹ exposure
}

export function detectClusters(analyses: MemberAnalysis[]): Cluster[] {
  // Group by sector+district and count shock-driven structural flags.
  const groups = new Map<
    string,
    { sector: SectorId; districtId: string; total: number; hits: Map<string, { count: number; atRisk: number }> }
  >();

  for (const a of analyses) {
    const sd = `${a.member.profile.sector}|${a.member.profile.districtId}`;
    if (!groups.has(sd)) {
      groups.set(sd, {
        sector: a.member.profile.sector,
        districtId: a.member.profile.districtId,
        total: 0,
        hits: new Map(),
      });
    }
    const g = groups.get(sd)!;
    g.total += 1;
    // A member contributes at most once per shock cause.
    const seen = new Set<string>();
    for (const f of a.flags) {
      if (!SHOCK_CAUSES.has(f.causeKey) || seen.has(f.causeKey)) continue;
      seen.add(f.causeKey);
      const h = g.hits.get(f.causeKey) ?? { count: 0, atRisk: 0 };
      h.count += 1;
      h.atRisk += f.gapAmount;
      g.hits.set(f.causeKey, h);
    }
  }

  const clusters: Cluster[] = [];
  for (const g of groups.values()) {
    for (const [causeKey, h] of g.hits) {
      // Cluster = 2+ units sharing a shock (correlated, batchable).
      if (h.count >= 2) {
        clusters.push({
          sector: g.sector,
          districtId: g.districtId,
          causeKey,
          count: h.count,
          total: g.total,
          atRisk: h.atRisk,
        });
      }
    }
  }
  // Most units affected first.
  return clusters.sort((a, b) => b.count - a.count);
}

export function portfolioTotals(analyses: MemberAnalysis[]) {
  return {
    total: analyses.length,
    risk: analyses.filter((a) => a.status === "risk").length,
    watch: analyses.filter((a) => a.status === "watch").length,
    healthy: analyses.filter((a) => a.status === "healthy").length,
    exposure: analyses.reduce((s, a) => s + a.atRisk, 0),
    loanReady: analyses.filter((a) => a.credit.band === "ready").length,
  };
}

// ── Sector analytics: which sectors to lend into ─────────────────────────────
export interface SectorStat {
  sector: SectorId;
  count: number;
  avgCredit: number; // 0-100 mean readiness
  loanReady: number; // enterprises in the "ready" band
  exposure: number; // ₹ cash at risk
  lendableAmount: number; // Σ suggested safe loans
  opportunity: number; // 0-100 lend-attractiveness (high readiness, low risk)
}

export function sectorStats(analyses: MemberAnalysis[]): SectorStat[] {
  const bySector = new Map<SectorId, MemberAnalysis[]>();
  for (const a of analyses) {
    const s = a.member.profile.sector;
    if (!bySector.has(s)) bySector.set(s, []);
    bySector.get(s)!.push(a);
  }
  const stats: SectorStat[] = [];
  for (const [sector, members] of bySector) {
    const n = members.length;
    const avgCredit = Math.round(members.reduce((s, a) => s + a.credit.score, 0) / n);
    const loanReady = members.filter((a) => a.credit.band === "ready").length;
    const exposure = members.reduce((s, a) => s + a.atRisk, 0);
    const lendableAmount = members.reduce((s, a) => s + a.credit.suggestedLimit, 0);
    // Opportunity: reward readiness + share of loan-ready, dampen by risk share.
    const riskShare = members.filter((a) => a.status === "risk").length / n;
    const opportunity = Math.max(
      0,
      Math.min(100, Math.round(avgCredit * (0.6 + 0.4 * (loanReady / n)) - riskShare * 25)),
    );
    stats.push({ sector, count: n, avgCredit, loanReady, exposure, lendableAmount, opportunity });
  }
  return stats.sort((a, b) => b.opportunity - a.opportunity);
}

// ── Loan allocator: fit the best loans into a budget ─────────────────────────
// Greedy by credit readiness: fund the most loan-ready enterprises first, each
// at its own suggested safe limit, until the budget runs out. Transparent and
// defensible - the same "lend to who can repay, safely" logic a bank uses.
export interface Allocation {
  analysis: MemberAnalysis;
  amount: number;
}
export function allocateLoans(analyses: MemberAnalysis[], budget: number): {
  allocations: Allocation[];
  used: number;
  reached: number;
} {
  const candidates = analyses
    .filter((a) => a.credit.suggestedLimit > 0)
    .sort((a, b) => b.credit.score - a.credit.score);
  const allocations: Allocation[] = [];
  let used = 0;
  for (const a of candidates) {
    if (used >= budget) break;
    const amount = Math.min(a.credit.suggestedLimit, budget - used);
    if (amount < 1000) continue;
    allocations.push({ analysis: a, amount });
    used += amount;
  }
  return { allocations, used, reached: allocations.length };
}

export { SECTORS };
export const CAUSE_TO_SHOCK = CAUSE_SHOCK;
