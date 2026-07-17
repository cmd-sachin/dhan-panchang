import type { SectorId } from "./types";

// The real mandi commodity that best represents each sector's main input/output,
// with a long-run "normal" reference price (₹/quintal) used to compute the
// "% vs normal" market trend. Prices come live from Agmarknet (data.gov.in).
export interface CommodityRef {
  name: string; // Agmarknet commodity name
  ref: number; // ₹/quintal long-run reference
}

export const SECTOR_COMMODITY: Record<SectorId, CommodityRef> = {
  poultry: { name: "Maize", ref: 2000 }, // feed
  dairy: { name: "Bajra", ref: 2200 }, // fodder grain
  food_processing: { name: "Wheat", ref: 2400 }, // staple input
  handicrafts: { name: "Cotton", ref: 7000 }, // raw material
  rural_retail: { name: "Onion", ref: 2500 }, // fast-moving stock
};

export function commodityFor(sector: SectorId): CommodityRef {
  return SECTOR_COMMODITY[sector] ?? SECTOR_COMMODITY.rural_retail;
}
