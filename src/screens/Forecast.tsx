import { useMemo, useState } from "react";
import {
  TrendingDown,
  TrendingUp,
  CalendarClock,
  ShieldCheck,
  CloudDownload,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { useEnterprise } from "@/store/useEnterprise";
import { CashFlowChart } from "@/components/charts/CashFlowChart";
import { HeatStrip } from "@/components/HeatStrip";
import { rupee } from "@/util";
import type { StringKey } from "@/i18n/strings";
import {
  HORIZONS,
  type HorizonId,
  horizonSummary,
  computeDrivers,
  cashRunway,
} from "@/engine/model";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { InfoTip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function StatTile({
  label,
  value,
  tone = "default",
  icon: Icon,
  help,
}: {
  label: string;
  value: string;
  tone?: "default" | "pos" | "neg";
  icon: React.ComponentType<{ className?: string }>;
  help?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-forest">
          <Icon className="size-4" />
        </span>
        <InfoTip label={help ?? label}>
          <div className="mt-3 w-fit cursor-help border-b border-dashed border-muted-foreground/40 text-[11px] text-muted-foreground">
            {label}
          </div>
        </InfoTip>
        <div
          className={`tnum text-lg font-bold ${
            tone === "pos" ? "text-surplus" : tone === "neg" ? "text-deficit" : ""
          }`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

// "District data: updated 2h ago" - freshness of the cached live signal.
function Freshness({ fetchedAt }: { fetchedAt: number | null }) {
  const { t } = useI18n();
  let text: string;
  if (!fetchedAt) {
    text = t("fresh.builtin");
  } else {
    const mins = Math.floor((Date.now() - fetchedAt) / 60000);
    if (mins < 90) text = t("fresh.live_just");
    else if (mins < 60 * 36) text = t("fresh.live_h", { n: Math.round(mins / 60) });
    else text = t("fresh.live_d", { n: Math.round(mins / 1440) });
  }
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <CloudDownload className="size-3.5" />
      {text}
    </div>
  );
}

export function Forecast() {
  const { t } = useI18n();
  const { useForecast } = useEnterprise();
  const { weeks, signal, input } = useForecast();
  const [horizon, setHorizon] = useState<HorizonId>("6m");

  const summary = useMemo(() => horizonSummary(weeks, horizon), [weeks, horizon]);
  const drivers = useMemo(
    () => computeDrivers(input, weeks, horizon).slice(0, 7),
    [input, weeks, horizon],
  );
  const runway = cashRunway(weeks);
  const maxDriver = Math.max(1, ...drivers.map((d) => Math.abs(d.amount)));
  const slice = summary.weeks;

  return (
    <div className="space-y-4">
      {/* horizon selector */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex rounded-full bg-muted p-1">
          {HORIZONS.map((h) => (
            <button
              key={h.id}
              onClick={() => setHorizon(h.id)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                horizon === h.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(h.labelKey as StringKey)}
            </button>
          ))}
        </div>
        <div className="hidden sm:block">
          <Freshness fetchedAt={signal.fetchedAt} />
        </div>
      </div>
      <div className="sm:hidden">
        <Freshness fetchedAt={signal.fetchedAt} />
      </div>

      {/* headline stats for the selected range */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label={t("forecast.at_end")}
          value={rupee(summary.endBalance)}
          tone={summary.endBalance >= 0 ? "pos" : "neg"}
          icon={TrendingUp}
          help={t("help.projected_end")}
        />
        <StatTile
          label={t("home.lowest_point")}
          value={t("home.week_n", { n: summary.troughWeek + 1 })}
          icon={CalendarClock}
          help={t("help.tightest_week")}
        />
        <StatTile
          label={t("forecast.flow")}
          value={(summary.netFlow >= 0 ? "+" : "") + rupee(summary.netFlow)}
          tone={summary.netFlow >= 0 ? "pos" : "neg"}
          icon={summary.netFlow >= 0 ? TrendingUp : TrendingDown}
          help={t("help.net_flow")}
        />
        <StatTile
          label={t("runway.label")}
          value={runway == null ? t("runway.long") : t("runway.weeks", { n: runway })}
          tone={runway == null ? "pos" : runway <= 4 ? "neg" : "default"}
          icon={ShieldCheck}
          help={t("help.runway")}
        />
      </div>

      {/* forecast visual for the selected range */}
      <Card>
        <CardContent className="p-5">
          <h2 className="font-bold tracking-tight">{t("nav.forecast")}</h2>
          <p className="mb-2 text-xs text-muted-foreground">{t("home.almanac_hint")}</p>
          {horizon === "1w" ? (
            <div className="space-y-1.5 pt-1">
              {slice[0].events.length === 0 ? (
                <p className="text-sm text-muted-foreground">-</p>
              ) : (
                slice[0].events.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl bg-muted px-3.5 py-2.5 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      {e.type === "income" ? (
                        <ArrowUpRight className="size-4 text-surplus" />
                      ) : (
                        <ArrowDownRight className="size-4 text-deficit" />
                      )}
                      {t(e.labelKey as StringKey)}
                    </span>
                    <span className="tnum font-semibold">
                      {e.type === "expense" ? "-" : "+"}
                      {rupee(e.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              <CashFlowChart weeks={slice} />
              <div className="mt-4">
                <HeatStrip weeks={slice} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* drivers: what moves the money */}
      <Card>
        <CardContent className="p-5">
          <h2 className="font-bold tracking-tight">{t("drivers.title")}</h2>
          <p className="mb-4 text-xs text-muted-foreground">{t("drivers.hint")}</p>
          <div className="space-y-3.5">
            {drivers.map((d) => {
              const positive = d.amount >= 0;
              return (
                <div key={d.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      {positive ? (
                        <ArrowUpRight className="size-4 shrink-0 text-surplus" />
                      ) : (
                        <ArrowDownRight className="size-4 shrink-0 text-deficit" />
                      )}
                      <span className="truncate">
                        {t(d.labelKey as StringKey, d.labelParams)}
                        {d.kind === "shock" && d.labelParams?.pct != null && (
                          <span className="text-muted-foreground"> · {d.labelParams.pct}%</span>
                        )}
                      </span>
                    </span>
                    <span
                      className={`tnum shrink-0 font-semibold ${
                        positive ? "text-surplus" : "text-deficit"
                      }`}
                    >
                      {positive ? "+" : "-"}
                      {rupee(Math.abs(d.amount))}
                    </span>
                  </div>
                  <Progress
                    value={(Math.abs(d.amount) / maxDriver) * 100}
                    indicatorClassName={positive ? "bg-surplus" : "bg-deficit"}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
