import { Egg, Milk, CookingPot, Palette, Store, type LucideIcon } from "lucide-react";
import type { SectorId } from "@/engine/types";

// Lucide icon per sector (replaces emoji). Kept in the UI layer so the engine
// stays presentation-agnostic.
export const SECTOR_ICON: Record<SectorId, LucideIcon> = {
  poultry: Egg,
  dairy: Milk,
  food_processing: CookingPot,
  handicrafts: Palette,
  rural_retail: Store,
};
