// ── Core domain types for the Dhan-Panchang almanac engine ──────────────────
// Everything here runs on-device. No numbers are ever produced by an LLM;
// the LLM layer (Tier 2) only narrates over these values.

export type SectorId =
  | "dairy"
  | "poultry"
  | "food_processing"
  | "handicrafts"
  | "rural_retail";

export type FlowType = "income" | "expense";

// A named, probabilistic money event on the enterprise's calendar.
// The 3–6 month forecast is the superposition of these events over a baseline.
export interface MoneyEvent {
  id: string;
  labelKey: string; // i18n key
  type: FlowType;
  // Scheduling: which ISO-week offsets (from "now") the event lands on.
  // "weekly" repeats every week; "seasonal" fires on specific week offsets.
  cadence: "weekly" | "monthly" | "seasonal";
  weeks?: number[]; // seasonal/monthly: week offsets 0..25 it fires on
  mean: number; // expected rupee magnitude per occurrence
  cv: number; // coefficient of variation (spread → confidence band width)
  // How external shocks move this event. 0 = insensitive, 1 = fully exposed.
  sensitivity?: Partial<Record<ShockId, number>>;
}

export type ShockId = "feed_price" | "monsoon" | "demand" | "fuel";

export interface SectorTemplate {
  id: SectorId;
  labelKey: string;
  emoji: string;
  baselineIncome: number; // steady weekly income floor
  baselineExpense: number; // steady weekly expense floor
  events: MoneyEvent[];
  // Plain-language "normal" descriptors used by the anomaly narrator.
  primaryIncomeKey: string;
}

// A district Signal Pack - Tier 1 reference data, refreshed on any network.
// Injected into the event model; the core forecast never needs a live API.
export interface SignalPack {
  districtId: string;
  // Multipliers vs. the seasonal normal (1.0 = normal).
  shocks: Record<ShockId, number>;
  // Epoch ms of the last live refresh; null = built-in baseline only.
  fetchedAt: number | null;
}

// One append-only ledger entry the enterprise owner records.
export interface LedgerEntry {
  id: string;
  ts: number; // epoch ms
  type: FlowType;
  category: string; // maps loosely to an event id or "other"
  amount: number;
  note?: string;
  weekOffset: number; // which week bucket relative to "now" (<=0 = past)
}

// A single week in the forecast.
export interface ForecastWeek {
  week: number; // offset from now (0 = this week)
  income: number;
  expense: number;
  net: number;
  balance: number; // cumulative
  lo: number; // lower confidence bound on balance
  hi: number; // upper confidence bound on balance
  events: { labelKey: string; type: FlowType; amount: number }[];
}

export interface RiskFlag {
  id: string;
  severity: "amber" | "red";
  causeKey: string; // named cause, i18n key
  causeParams?: Record<string, string | number>;
  gapWeek: number; // week the shortfall is projected to bite
  gapAmount: number; // projected rupee gap
  actionKey: string; // mapped actionable suggestion
}

export interface EnterpriseProfile {
  name: string;
  sector: SectorId;
  businessType?: string; // display label of the specific business (maps to sector)
  districtId: string;
  openingBalance: number;
  createdWeek: number;
}
