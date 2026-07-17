import type { SectorId } from "./types";
import { signalMeta, signalCommodity } from "./signals";
import { commodityFor } from "./commodities";
import { stateName, stateOfDistrict } from "@/data/locations";

// ── Live district alerts (REAL data, not mock) ───────────────────────────────
// Built from the live signal pack's metadata: real temperature and rain from
// Open-Meteo, real mandi commodity price from Agmarknet. IMD thresholds:
// heatwave (plains) ≥ 40°C, heavy rain ≥ 64.5 mm/day. Every number shown here
// comes from a live source cached for the district.

export type LiveAlertKind = "heat" | "rain" | "market" | "dry";

export interface LiveAlert {
  id: string;
  kind: LiveAlertKind;
  severity: "red" | "amber";
  titleKey: string;
  titleParams?: Record<string, string | number>;
  actionKey: string;
}

export function districtAlerts(districtId: string, sector: SectorId): LiveAlert[] {
  const m = signalMeta(districtId);
  const out: LiveAlert[] = [];
  const st = stateName(stateOfDistrict(districtId));
  const commodity = signalCommodity(districtId) ?? commodityFor(sector).name;

  // Heat (real forecast max temperature over the next week)
  if (typeof m.tempMaxC === "number") {
    if (m.tempMaxC >= 44) {
      out.push({
        id: "heat", kind: "heat", severity: "red",
        titleKey: "live.heat", titleParams: { t: m.tempMaxC },
        actionKey: sector === "rural_retail" ? "live.heat_retail" : "live.heat_farm",
      });
    } else if (m.tempMaxC >= 40) {
      out.push({
        id: "heat", kind: "heat", severity: "amber",
        titleKey: "live.heat", titleParams: { t: m.tempMaxC },
        actionKey: sector === "rural_retail" ? "live.heat_retail" : "live.heat_farm",
      });
    }
  }

  // Heavy rain (real max daily rainfall over the next week)
  if (typeof m.maxRainDayMm === "number" && m.maxRainDayMm >= 64) {
    out.push({
      id: "rain", kind: "rain", severity: m.maxRainDayMm >= 100 ? "red" : "amber",
      titleKey: "live.rain", titleParams: { mm: m.maxRainDayMm },
      actionKey: "live.rain_action",
    });
  }

  // Market: this business's own commodity vs its long-run normal (real Agmarknet)
  const pct = m.commodityPctVsNormal ?? m.feedPctVsNormal;
  const price = m.commodityPrice ?? m.maizeMedianPrice;
  if (typeof pct === "number" && Math.abs(pct) >= 12 && typeof price === "number") {
    const up = pct >= 0;
    out.push({
      id: "market", kind: "market", severity: Math.abs(pct) >= 22 ? "red" : "amber",
      titleKey: up ? "live.market_up" : "live.market_down",
      titleParams: { commodity, price, pct: Math.abs(pct), state: st },
      actionKey: sector === "rural_retail" || sector === "handicrafts"
        ? "live.market_action_stock"
        : "live.market_action",
    });
  }

  // Weak-rain / dry outlook (low 16-day rain total)
  if (typeof m.rain16dMm === "number" && m.rain16dMm < 15 && !out.some((a) => a.kind === "rain")) {
    out.push({
      id: "dry", kind: "dry", severity: "amber",
      titleKey: "live.dry", titleParams: { mm: m.rain16dMm },
      actionKey: "live.dry_action",
    });
  }

  return out;
}
