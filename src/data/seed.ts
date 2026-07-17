import type { EnterpriseProfile, LedgerEntry } from "../engine/types";

// ── Demo seed: Meena's poultry unit, Nashik ─────────────────────────────────
// The ledger is calibrated so the engine recovers the concept's signature
// story: batch-sale income is trending down ~22% vs. Meena's usual, three
// weeks before the district feed-price shock bites. Fully reproducible.

export const SEED_PROFILE: EnterpriseProfile = {
  name: "Meena",
  sector: "poultry",
  districtId: "nashik",
  openingBalance: 8000,
  createdWeek: -20,
};

let idc = 0;
const uid = () => `seed_${idc++}`;

function entry(
  weekOffset: number,
  type: "income" | "expense",
  category: string,
  amount: number,
): LedgerEntry {
  return {
    id: uid(),
    ts: 0, // seed rows carry no wall-clock time (deterministic)
    type,
    category,
    amount,
    weekOffset,
  };
}

// "Usual" batch sales (older history) ~18–19k, recent two ~14k → ~22% drop.
export const SEED_LEDGER: LedgerEntry[] = [
  // established history — the personal "normal"
  entry(-19, "income", "batch_sale", 18500),
  entry(-13, "income", "batch_sale", 19200),
  entry(-7, "income", "batch_sale", 18800),
  // recent cycle softening (demand dip)
  entry(-2, "income", "batch_sale", 14400),
  entry(-1, "income", "batch_sale", 14100),
  // weekly feed purchases, creeping up recently (feed-price shock)
  entry(-4, "expense", "feed_purchase", 1550),
  entry(-3, "expense", "feed_purchase", 1600),
  entry(-2, "expense", "feed_purchase", 1780),
  entry(-1, "expense", "feed_purchase", 1900),
  entry(0, "expense", "feed_purchase", 1950),
  // restocks
  entry(-19, "expense", "chick_restock", 6400),
  entry(-13, "expense", "chick_restock", 6600),
  entry(-7, "expense", "chick_restock", 6500),
];
