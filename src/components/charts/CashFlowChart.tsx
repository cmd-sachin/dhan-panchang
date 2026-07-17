import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { ForecastWeek } from "@/engine/types";
import { monthMarkers, rupee } from "@/util";
import { useI18n } from "@/i18n";

// Smooth cumulative-balance forecast with a shaded confidence ribbon.
// The ribbon (lo..hi) is drawn with the classic two-area overlay so it reads
// as uncertainty widening into the future - narrowing as entries accumulate.
export function CashFlowChart({ weeks }: { weeks: ForecastWeek[] }) {
  const { t } = useI18n();
  const markers = monthMarkers(weeks.length);
  const tickWeeks = new Set(markers.map((m) => m.atWeek));

  const data = weeks.map((w) => ({
    week: w.week,
    month: markers.find((m) => m.atWeek === w.week)?.label ?? "",
    balance: w.balance,
    lo: w.lo,
    hi: w.hi,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
          <defs>
            <linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {/* confidence ribbon: hi in lime, lo masked with card colour */}
          <Area
            type="monotone"
            dataKey="hi"
            stroke="none"
            fill="var(--brand)"
            fillOpacity={0.14}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="lo"
            stroke="none"
            fill="var(--card)"
            fillOpacity={1}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="none"
            fill="url(#balFill)"
            isAnimationActive={false}
          />
          <ReferenceLine y={0} stroke="var(--deficit)" strokeDasharray="3 3" strokeOpacity={0.5} />
          <Line
            type="monotone"
            dataKey="balance"
            stroke="var(--forest)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: "var(--forest)" }}
            isAnimationActive={true}
            animationDuration={700}
          />
          <XAxis
            dataKey="week"
            tickLine={false}
            axisLine={false}
            interval={0}
            ticks={[...tickWeeks]}
            tickFormatter={(w) => data[w]?.month ?? ""}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            dy={6}
          />
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Tooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof data)[number];
              return (
                <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-lg">
                  <div className="text-xs text-muted-foreground">
                    {t("home.week_n", { n: p.week + 1 })}
                  </div>
                  <div className="tnum text-sm font-bold">{rupee(p.balance)}</div>
                  <div className="tnum text-[11px] text-muted-foreground">
                    {rupee(p.lo)} - {rupee(p.hi)}
                  </div>
                </div>
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
