import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, ArrowUp, ArrowDown } from "lucide-react";
import type { ForecastWeek } from "@/engine/types";
import { useI18n } from "@/i18n";
import type { StringKey } from "@/i18n/strings";
import { classifyWeek, monthMarkers, rupee, WEEK_COLORS } from "@/util";
import { InfoTip } from "@/components/ui/tooltip";

const LEGEND: {
  cls: "surplus" | "tight" | "deficit";
  color: string;
  label: StringKey;
  help: StringKey;
}[] = [
  { cls: "surplus", color: "var(--surplus)", label: "home.legend_surplus", help: "home.legend_surplus_help" },
  { cls: "tight", color: "var(--tight)", label: "home.legend_tight", help: "home.legend_tight_help" },
  { cls: "deficit", color: "var(--deficit)", label: "home.legend_deficit", help: "home.legend_deficit_help" },
];

// The signature visual: a 6-month colour band of surplus/tight/deficit weeks
// with event markers. Tap a week to reveal its drivers.
export function HeatStrip({ weeks }: { weeks: ForecastWeek[] }) {
  const { t } = useI18n();
  const [sel, setSel] = useState<number | null>(null);
  const markers = monthMarkers(weeks.length);
  const selected = sel != null ? weeks[sel] : null;

  return (
    <div>
      <div className="mb-2 flex gap-0.5">
        {markers.map((m, i) => {
          const nextAt = markers[i + 1]?.atWeek ?? weeks.length;
          return (
            <div
              key={m.atWeek}
              className="border-l border-border pl-1 text-[10px] font-medium text-muted-foreground"
              style={{ flex: nextAt - m.atWeek }}
            >
              {m.label}
            </div>
          );
        })}
      </div>

      <div className="flex h-16 items-stretch gap-[3px]">
        {weeks.map((w, i) => {
          const cls = classifyWeek(w.lo, w.balance, w.net);
          const big = w.events.find((e) => Math.abs(e.amount) > 5000);
          return (
            <motion.button
              key={w.week}
              initial={{ scaleY: 0.2, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ delay: i * 0.012, duration: 0.25, ease: "easeOut" }}
              onClick={() => setSel(sel === w.week ? null : w.week)}
              className={`relative min-w-0 flex-1 origin-bottom rounded-[4px] outline-none transition-transform hover:scale-y-105 ${
                sel === w.week ? "ring-2 ring-forest ring-offset-1" : ""
              }`}
              style={{ background: WEEK_COLORS[cls] }}
              title={`${t("home.week_n", { n: w.week + 1 })} · ${rupee(w.balance)}`}
            >
              {big &&
                (big.type === "income" ? (
                  <ArrowUp className="absolute left-1/2 top-0.5 size-2.5 -translate-x-1/2 text-white/90" />
                ) : (
                  <ArrowDown className="absolute left-1/2 top-0.5 size-2.5 -translate-x-1/2 text-white/90" />
                ))}
            </motion.button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
        {LEGEND.map((l) => (
          <InfoTip key={l.cls} label={t(l.help)}>
            <button className="flex cursor-help items-center gap-1.5 outline-none">
              <i className="size-2.5 rounded-[3px]" style={{ background: l.color }} />
              <span className="border-b border-dashed border-muted-foreground/40">
                {t(l.label)}
              </span>
            </button>
          </InfoTip>
        ))}
      </div>

      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 rounded-2xl bg-muted p-3.5 text-sm"
        >
          <div className="flex items-center justify-between font-semibold">
            <span>
              {selected.week === 0
                ? t("home.this_week")
                : t("home.week_n", { n: selected.week + 1 })}
            </span>
            <span className="tnum">{rupee(selected.balance)}</span>
          </div>
          {selected.events.length === 0 ? (
            <div className="mt-1 text-muted-foreground">—</div>
          ) : (
            <div className="mt-2 space-y-1.5">
              {selected.events.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-[13px] text-muted-foreground"
                >
                  <span className="flex items-center gap-1.5">
                    {e.type === "income" ? (
                      <ArrowUpRight className="size-3.5 text-surplus" />
                    ) : (
                      <ArrowDownRight className="size-3.5 text-deficit" />
                    )}
                    {t(e.labelKey as StringKey)}
                  </span>
                  <span className="tnum">
                    {e.type === "expense" ? "−" : "+"}
                    {rupee(e.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
