import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Sparkles, TrendingUp } from "lucide-react";
import { useI18n } from "@/i18n";
import type { StringKey } from "@/i18n/strings";
import { rupee } from "@/util";
import { sectorStats, type MemberAnalysis } from "@/engine/portfolio";
import { SECTORS } from "@/engine/sectors";
import { SECTOR_ICON } from "@/sectorMeta";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export function OfficerAnalytics({ analyses }: { analyses: MemberAnalysis[] }) {
  const { t } = useI18n();
  const stats = useMemo(() => sectorStats(analyses), [analyses]);
  const best = stats[0];
  const barData = stats.map((s) => ({
    key: s.sector,
    name: t(SECTORS[s.sector].labelKey as StringKey),
    readiness: s.avgCredit,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:hidden">{t("an.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("an.subtitle")}</p>
      </div>

      {/* best sector to lend into */}
      {best && (
        <Card className="overflow-hidden border-none bg-primary text-primary-foreground">
          <CardContent className="relative p-6">
            <div className="absolute -right-10 -top-10 size-40 rounded-full bg-brand/20 blur-2xl" />
            <div className="relative flex items-center gap-2 text-xs font-semibold text-primary-foreground/70">
              <Sparkles className="size-4" /> {t("an.best_sector")}
            </div>
            <div className="relative mt-2 flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-white/10 text-brand">
                {(() => {
                  const Icon = SECTOR_ICON[best.sector];
                  return <Icon className="size-6" />;
                })()}
              </span>
              <div>
                <div className="text-xl font-bold">{t(SECTORS[best.sector].labelKey as StringKey)}</div>
                <div className="text-xs text-primary-foreground/60">
                  {t("an.enterprises_n", { n: best.count })} · {t("an.avg_credit")} {best.avgCredit}
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="tnum text-3xl font-extrabold text-brand">{best.opportunity}</div>
                <div className="text-[10px] text-primary-foreground/60">{t("an.opportunity")}</div>
              </div>
            </div>
            <div className="relative mt-4 flex gap-2 border-t border-white/10 pt-3 text-xs">
              <span className="text-primary-foreground/70">
                {t("an.lendable")}: <b className="tnum text-primary-foreground">{rupee(best.lendableAmount)}</b>
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* readiness by sector chart */}
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 font-bold tracking-tight">{t("an.by_sector")}</h2>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval={0} />
                <YAxis hide domain={[0, 100]} />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="rounded-xl border border-border bg-popover px-3 py-2 text-sm shadow-lg">
                        <span className="tnum font-bold">{payload[0].value as number}</span>
                        <span className="text-muted-foreground"> / 100</span>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="readiness" radius={[8, 8, 8, 8]} maxBarSize={46}>
                  {barData.map((d) => (
                    <Cell
                      key={d.key}
                      fill={d.readiness >= 70 ? "var(--surplus)" : d.readiness >= 45 ? "var(--tight)" : "var(--deficit)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* per-sector detail */}
      <div className="space-y-3">
        {stats.map((s) => {
          const Icon = SECTOR_ICON[s.sector];
          return (
            <Card key={s.sector}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-forest">
                    <Icon className="size-5" />
                  </span>
                  <div className="flex-1">
                    <div className="font-semibold">{t(SECTORS[s.sector].labelKey as StringKey)}</div>
                    <div className="text-xs text-muted-foreground">{t("an.enterprises_n", { n: s.count })}</div>
                  </div>
                  <Badge variant={s.opportunity >= 60 ? "surplus" : s.opportunity >= 40 ? "tight" : "deficit"}>
                    <TrendingUp className="size-3.5" /> {s.opportunity}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="tnum text-sm font-bold text-surplus">{s.loanReady}/{s.count}</div>
                    <div className="text-[10px] text-muted-foreground">{t("an.loan_ready")}</div>
                  </div>
                  <div>
                    <div className="tnum text-sm font-bold">{rupee(s.lendableAmount)}</div>
                    <div className="text-[10px] text-muted-foreground">{t("an.lendable")}</div>
                  </div>
                  <div>
                    <div className="tnum text-sm font-bold text-deficit">{rupee(s.exposure)}</div>
                    <div className="text-[10px] text-muted-foreground">{t("an.at_risk")}</div>
                  </div>
                </div>
                <div className="mt-3">
                  <Progress value={s.avgCredit} indicatorClassName={s.avgCredit >= 70 ? "bg-surplus" : s.avgCredit >= 45 ? "bg-tight" : "bg-deficit"} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
