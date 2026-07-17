// Small formatting helpers shared across screens.

// Indian-style rupee formatting with lakh grouping, compact for big sums.
export function rupee(n: number): string {
  const neg = n < 0;
  const abs = Math.abs(Math.round(n));
  let s: string;
  if (abs >= 100000) {
    s = `${(abs / 100000).toFixed(abs >= 1000000 ? 1 : 2)}L`;
  } else {
    // group by Indian numbering (last 3, then pairs)
    const str = String(abs);
    const last3 = str.slice(-3);
    const rest = str.slice(0, -3);
    s = rest
      ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3
      : last3;
  }
  return `${neg ? "−" : ""}₹${s}`;
}

// Month abbreviations across the 26-week horizon, starting from the real
// current month. Returns [{ label, atWeek }] for ~6 month markers.
export function monthMarkers(horizon: number) {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en", { month: "short" });
  const markers: { label: string; atWeek: number }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < horizon; w++) {
    const d = new Date(now.getTime() + w * 7 * 86400000);
    const m = d.getMonth();
    if (m !== lastMonth) {
      markers.push({ label: fmt.format(d), atWeek: w });
      lastMonth = m;
    }
  }
  return markers;
}

export type WeekClass = "surplus" | "tight" | "deficit";

export function classifyWeek(lo: number, balance: number, net: number): WeekClass {
  if (lo < 0 || balance < 0) return "deficit";
  if (net < 0 || balance < 3000) return "tight";
  return "surplus";
}

export const WEEK_COLORS: Record<WeekClass, string> = {
  surplus: "var(--surplus)",
  tight: "var(--tight)",
  deficit: "var(--deficit)",
};

export const WEEK_BADGE: Record<WeekClass, "surplus" | "tight" | "deficit"> = {
  surplus: "surplus",
  tight: "tight",
  deficit: "deficit",
};
