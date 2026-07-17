import type { SectorId } from "@/engine/types";

// A broad menu of rural micro-enterprises for onboarding. Each maps to one of
// the five engine sectors (which carry the forecast model). "Other" lets a user
// pick anything and choose the closest base category. Labels are English (the
// long tail); the five base sectors stay fully translated elsewhere.

export interface BusinessType {
  id: string;
  label: string;
  sector: SectorId;
}

export interface BusinessGroup {
  sector: SectorId;
  label: string;
  types: BusinessType[];
}

const B = (id: string, label: string, sector: SectorId): BusinessType => ({ id, label, sector });

export const BUSINESS_GROUPS: BusinessGroup[] = [
  {
    sector: "dairy",
    label: "Dairy & livestock",
    types: [
      B("dairy_farm", "Dairy farming", "dairy"),
      B("milk_vendor", "Milk collection / vendor", "dairy"),
      B("goat_sheep", "Goat / sheep rearing", "dairy"),
      B("cattle", "Cattle rearing", "dairy"),
    ],
  },
  {
    sector: "poultry",
    label: "Poultry",
    types: [
      B("broiler", "Broiler poultry", "poultry"),
      B("layer_eggs", "Layer / eggs", "poultry"),
      B("duck", "Duck farming", "poultry"),
      B("fish", "Fish / aquaculture", "poultry"),
    ],
  },
  {
    sector: "food_processing",
    label: "Food processing",
    types: [
      B("flour_rice_mill", "Flour / rice mill", "food_processing"),
      B("oil_mill", "Oil mill / ghani", "food_processing"),
      B("spices", "Spices & masala", "food_processing"),
      B("pickle_papad", "Pickles & papad", "food_processing"),
      B("snacks", "Snacks & namkeen", "food_processing"),
      B("bakery", "Bakery", "food_processing"),
      B("jaggery", "Jaggery / sugar unit", "food_processing"),
      B("dairy_products", "Ghee / paneer / sweets", "food_processing"),
      B("catering", "Catering / tiffin", "food_processing"),
      B("honey", "Honey / bee-keeping", "food_processing"),
    ],
  },
  {
    sector: "handicrafts",
    label: "Handicrafts & artisan",
    types: [
      B("handloom", "Handloom & weaving", "handicrafts"),
      B("pottery", "Pottery", "handicrafts"),
      B("bamboo", "Bamboo & cane", "handicrafts"),
      B("tailoring", "Tailoring & embroidery", "handicrafts"),
      B("jewellery", "Bangles & jewellery", "handicrafts"),
      B("leather", "Leather goods", "handicrafts"),
      B("carpentry", "Carpentry & furniture", "handicrafts"),
      B("agarbatti", "Agarbatti / candles", "handicrafts"),
    ],
  },
  {
    sector: "rural_retail",
    label: "Village retail & services",
    types: [
      B("kirana", "Kirana / general store", "rural_retail"),
      B("veg_fruit", "Vegetable & fruit vendor", "rural_retail"),
      B("tea_dhaba", "Tea stall / dhaba", "rural_retail"),
      B("cloth", "Cloth & garment shop", "rural_retail"),
      B("hardware", "Hardware & building", "rural_retail"),
      B("stationery_mobile", "Stationery & mobile", "rural_retail"),
      B("pharmacy", "Pharmacy / medical", "rural_retail"),
      B("salon", "Salon & beauty", "rural_retail"),
      B("repair", "Repair services", "rural_retail"),
      B("agri_input", "Seeds & agri inputs", "rural_retail"),
    ],
  },
];

export const BUSINESS_TYPES: BusinessType[] = BUSINESS_GROUPS.flatMap((g) => g.types);

const byId = new Map(BUSINESS_TYPES.map((b) => [b.id, b]));
export function businessType(id: string | undefined): BusinessType | undefined {
  return id ? byId.get(id) : undefined;
}
