import type { SectorTemplate } from "./types";

// ── Sector × event templates ────────────────────────────────────────────────
// These are the "sector × district priors" from the concept: calibrated
// seasonal structure per sector. A cold-start enterprise is useful from day
// one because it inherits this template, then personalises via entries.
//
// Week offsets are relative to "now" over a 26-week (≈6 month) horizon.

export const SECTORS: Record<string, SectorTemplate> = {
  poultry: {
    id: "poultry",
    labelKey: "sector.poultry",
    emoji: "🐔",
    baselineIncome: 2200,
    baselineExpense: 900,
    primaryIncomeKey: "cause.milk_income", // reused generic "primary income"
    events: [
      {
        id: "batch_sale",
        labelKey: "event.batch_sale",
        type: "income",
        cadence: "seasonal",
        weeks: [6, 12, 18, 24], // ~6-week broiler cycles
        mean: 18000,
        cv: 0.22,
        // Good monsoon lifts rural buying power; fuel eats into realisation.
        sensitivity: { demand: 0.6, feed_price: -0.2, monsoon: 0.15, fuel: -0.1 },
      },
      {
        id: "feed_purchase",
        labelKey: "event.feed_purchase",
        type: "expense",
        cadence: "weekly",
        mean: 1600,
        cv: 0.15,
        // Good rains → cheaper grain; fuel raises delivered feed cost.
        sensitivity: { feed_price: 1.0, monsoon: -0.2, fuel: 0.15 },
      },
      {
        id: "chick_restock",
        labelKey: "event.chick_restock",
        type: "expense",
        cadence: "seasonal",
        weeks: [1, 7, 13, 19],
        mean: 6500,
        cv: 0.18,
        sensitivity: { fuel: 0.1 },
      },
      {
        id: "festival_demand",
        labelKey: "event.festival_demand",
        type: "income",
        cadence: "seasonal",
        weeks: [15], // Diwali-window uplift
        mean: 9000,
        cv: 0.3,
        sensitivity: { demand: 0.9, monsoon: 0.2 },
      },
    ],
  },

  dairy: {
    id: "dairy",
    labelKey: "sector.dairy",
    emoji: "🥛",
    baselineIncome: 1400,
    baselineExpense: 600,
    primaryIncomeKey: "cause.milk_income",
    events: [
      {
        id: "milk_sale",
        labelKey: "event.milk_sale",
        type: "income",
        cadence: "weekly",
        mean: 2600,
        cv: 0.12,
        sensitivity: { monsoon: 0.3, feed_price: -0.15, demand: 0.2 },
      },
      {
        id: "fodder",
        labelKey: "event.fodder",
        type: "expense",
        cadence: "weekly",
        mean: 1100,
        cv: 0.2,
        // Good rains → cheaper fodder; fuel raises delivered cost.
        sensitivity: { monsoon: -0.4, feed_price: 0.6, fuel: 0.15 },
      },
      {
        id: "vet",
        labelKey: "event.vet",
        type: "expense",
        cadence: "seasonal",
        weeks: [4, 16],
        mean: 2200,
        cv: 0.3,
      },
      {
        id: "coop_bonus",
        labelKey: "event.coop_bonus",
        type: "income",
        cadence: "seasonal",
        weeks: [12, 24],
        mean: 4000,
        cv: 0.25,
      },
    ],
  },

  food_processing: {
    id: "food_processing",
    labelKey: "sector.food_processing",
    emoji: "🫙",
    baselineIncome: 3000,
    baselineExpense: 1400,
    primaryIncomeKey: "cause.sales_income",
    events: [
      {
        id: "bulk_order",
        labelKey: "event.bulk_order",
        type: "income",
        cadence: "seasonal",
        weeks: [3, 9, 15, 21],
        mean: 14000,
        cv: 0.28,
        sensitivity: { demand: 0.7, monsoon: 0.2 },
      },
      {
        id: "raw_material",
        labelKey: "event.raw_material",
        type: "expense",
        cadence: "monthly",
        weeks: [1, 5, 9, 13, 17, 21, 25],
        mean: 7000,
        cv: 0.22,
        // Good harvest → cheaper produce inputs.
        sensitivity: { feed_price: 0.5, fuel: 0.3, monsoon: -0.25 },
      },
      {
        id: "packaging",
        labelKey: "event.packaging",
        type: "expense",
        cadence: "weekly",
        mean: 700,
        cv: 0.15,
        sensitivity: { fuel: 0.4 },
      },
    ],
  },

  handicrafts: {
    id: "handicrafts",
    labelKey: "sector.handicrafts",
    emoji: "🧵",
    baselineIncome: 900,
    baselineExpense: 400,
    primaryIncomeKey: "cause.sales_income",
    events: [
      {
        id: "diwali_order",
        labelKey: "event.diwali_order",
        type: "income",
        cadence: "seasonal",
        weeks: [14, 15, 16],
        mean: 12000,
        cv: 0.35,
        // Good monsoon → stronger rural festival spending.
        sensitivity: { demand: 0.9, monsoon: 0.15 },
      },
      {
        id: "material_buy",
        labelKey: "event.material_buy",
        type: "expense",
        cadence: "seasonal",
        weeks: [10, 11],
        mean: 8000,
        cv: 0.25,
        sensitivity: { fuel: 0.15 },
      },
      {
        id: "mela_sales",
        labelKey: "event.mela_sales",
        type: "income",
        cadence: "seasonal",
        weeks: [5, 20],
        mean: 6000,
        cv: 0.3,
        // Melas depend on rural incomes; travel costs bite into takings.
        sensitivity: { demand: 0.5, monsoon: 0.2, fuel: -0.1 },
      },
    ],
  },

  rural_retail: {
    id: "rural_retail",
    labelKey: "sector.rural_retail",
    emoji: "🏪",
    baselineIncome: 3500,
    baselineExpense: 2600,
    primaryIncomeKey: "cause.sales_income",
    events: [
      {
        id: "harvest_credit_sales",
        labelKey: "event.harvest_credit_sales",
        type: "income",
        cadence: "seasonal",
        weeks: [8, 9, 10],
        mean: 9000,
        cv: 0.3,
        sensitivity: { monsoon: 0.5, demand: 0.3 },
      },
      {
        id: "stock_purchase",
        labelKey: "event.stock_purchase",
        type: "expense",
        cadence: "monthly",
        weeks: [2, 6, 10, 14, 18, 22],
        mean: 8000,
        cv: 0.2,
        // Fuel raises delivered stock cost. (No demand link here: putting
        // demand on an expense made "demand up" read as a loss.)
        sensitivity: { fuel: 0.4 },
      },
      {
        id: "festival_spike",
        labelKey: "event.festival_spike",
        type: "income",
        cadence: "seasonal",
        weeks: [15, 16],
        mean: 7000,
        cv: 0.28,
        sensitivity: { demand: 0.8, monsoon: 0.15 },
      },
    ],
  },
};

// District Signal Packs now live in engine/signals.ts (cached + live refresh).
export const SECTOR_LIST = Object.values(SECTORS);
