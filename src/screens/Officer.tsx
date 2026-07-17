import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  ChevronRight,
  ArrowLeft,
  Layers,
  Lightbulb,
  ShieldCheck,
  MapPin,
  Droplets,
  Search,
  BadgeCheck,
  FileDown,
  Thermometer,
  CloudRain,
  IndianRupee,
  Pencil,
} from "lucide-react";
import { useI18n } from "@/i18n";
import type { StringKey } from "@/i18n/strings";
import { HeatStrip } from "@/components/HeatStrip";
import { CashFlowChart } from "@/components/charts/CashFlowChart";
import { rupee } from "@/util";
import type { MemberAnalysis, Cluster } from "@/engine/portfolio";
import { portfolioTotals } from "@/engine/portfolio";
import { bandColor, type CreditBand } from "@/engine/credit";
import { districtName, STATES, districtsOf } from "@/data/locations";
import { signalMeta, signalCommodity } from "@/engine/signals";
import { SECTORS, SECTOR_LIST } from "@/engine/sectors";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RiskFlag } from "@/engine/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { InfoTip } from "@/components/ui/tooltip";
import { SECTOR_ICON } from "@/sectorMeta";
import { cn } from "@/lib/utils";

const CAUSE_SHORT: Record<string, StringKey> = {
  "cause.feed_price": "cshort.feed_price",
  "cause.monsoon": "cshort.monsoon",
  "cause.demand": "cshort.demand",
  "cause.fuel": "cshort.fuel",
};

const BAND_LABEL: Record<CreditBand, StringKey> = {
  ready: "credit.ready",
  developing: "credit.developing",
  early: "credit.early",
};

const dotColor = (s: MemberAnalysis["status"]) =>
  s === "risk" ? "var(--deficit)" : s === "watch" ? "var(--tight)" : "var(--surplus)";

// ── Officer jurisdiction setup ───────────────────────────────────────────────
// One officer covers ONE district. Pick the jurisdiction before the book loads.
export function OfficerSetup({ onPick }: { onPick: (districtId: string) => void }) {
  const { t } = useI18n();
  const [stateId, setStateId] = useState("maharashtra");
  const [district, setDistrict] = useState("nashik");
  const dists = districtsOf(stateId);
  return (
    <div className="mx-auto max-w-md space-y-5 py-6">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-forest">
          <MapPin className="size-6" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t("off.setup_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("off.setup_hint")}</p>
        </div>
      </div>
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">{t("loc.state")}</label>
            <Select
              value={stateId}
              onValueChange={(s) => {
                setStateId(s);
                setDistrict(districtsOf(s)[0].id);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">{t("off.your_district")}</label>
            <Select value={district} onValueChange={setDistrict}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {dists.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={() => onPick(district)}>
            {t("off.enter_district")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Small circular credit-score chip used in triage rows.
function CreditChip({ score, band }: { score: number; band: CreditBand }) {
  return (
    <span
      className="flex size-9 shrink-0 flex-col items-center justify-center rounded-full text-[13px] font-bold leading-none"
      style={{ background: `color-mix(in srgb, ${bandColor[band]} 16%, transparent)`, color: bandColor[band] }}
    >
      {score}
    </span>
  );
}

type SortKey = "risk" | "exposure" | "credit";

function causeText(t: (k: StringKey, p?: any) => string, f?: RiskFlag) {
  if (!f) return "";
  return t(f.causeKey as StringKey, {
    ...f.causeParams,
    eventKey: f.causeParams?.eventKey ? t(f.causeParams.eventKey as StringKey) : "",
  });
}

// ── Live district conditions strip (real weather + market) ──────────────────
export function LiveConditions({ districtId }: { districtId: string }) {
  const { t } = useI18n();
  const m = signalMeta(districtId);
  const chips: { icon: typeof Thermometer; label: string; tone: string }[] = [];
  if (typeof m.tempMaxC === "number") {
    chips.push({
      icon: Thermometer,
      label: `${m.tempMaxC}°C`,
      tone: m.tempMaxC >= 40 ? "text-deficit" : "text-foreground",
    });
  }
  if (typeof m.maxRainDayMm === "number") {
    chips.push({
      icon: CloudRain,
      label: `${m.maxRainDayMm}mm`,
      tone: m.maxRainDayMm >= 64 ? "text-deficit" : "text-foreground",
    });
  }
  const price = m.commodityPrice ?? m.maizeMedianPrice;
  const pct = m.commodityPctVsNormal ?? m.feedPctVsNormal;
  const commodity = signalCommodity(districtId);
  if (typeof price === "number") {
    chips.push({
      icon: IndianRupee,
      label: `${commodity ? commodity + " " : ""}₹${price}${typeof pct === "number" ? ` (${pct >= 0 ? "+" : ""}${pct}%)` : ""}`,
      tone: Math.abs(pct ?? 0) >= 12 ? "text-deficit" : "text-foreground",
    });
  }
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c, i) => (
        <span key={i} className={`flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium ${c.tone}`}>
          <c.icon className="size-3.5" /> {c.label}
        </span>
      ))}
      <span className="text-[10px] text-muted-foreground">{t("live.sources")}</span>
    </div>
  );
}

// ── Triage ────────────────────────────────────────────────────────────────
export function OfficerTriage({
  analyses,
  onOpen,
  districtId,
  onChangeDistrict,
}: {
  analyses: MemberAnalysis[];
  onOpen: (id: string) => void;
  districtId: string;
  onChangeDistrict: () => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("risk");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = analyses.filter((a) => {
      if (sector !== "all" && a.member.profile.sector !== sector) return false;
      if (!q) return true;
      return (
        a.member.profile.name.toLowerCase().includes(q) ||
        districtName(a.member.profile.districtId).toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) => {
      if (sort === "exposure") return b.atRisk - a.atRisk;
      if (sort === "credit") return b.credit.score - a.credit.score;
      return b.riskScore - a.riskScore;
    });
    return list;
  }, [analyses, query, sector, sort]);

  const exportCsv = () => {
    const head = ["Name", "Sector", "District", "Status", "CashAtRisk", "CreditScore", "Band", "SuggestedLoan"];
    const lines = rows.map((a) =>
      [
        a.member.profile.name,
        t(SECTORS[a.member.profile.sector].labelKey as StringKey),
        districtName(a.member.profile.districtId),
        a.status,
        a.atRisk,
        a.credit.score,
        a.credit.band,
        a.credit.suggestedLimit,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dhan-panchang-portfolio.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const SORTS: { id: SortKey; label: StringKey }[] = [
    { id: "risk", label: "off.sort_risk" },
    { id: "exposure", label: "off.sort_exposure" },
    { id: "credit", label: "off.sort_credit" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:hidden">{t("off.portfolio_title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("off.district_book", { district: districtName(districtId), n: analyses.length })}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" size="sm" onClick={onChangeDistrict}>
            <Pencil className="size-4" /> <span className="hidden sm:inline">{t("off.change_district")}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <FileDown className="size-4" /> CSV
          </Button>
        </div>
      </div>

      {/* live district conditions (real weather + market) */}
      <LiveConditions districtId={districtId} />

      {/* search + filter + sort */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("off.search")}
            className="h-11 pl-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSector("all")}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium",
              sector === "all" ? "border-brand bg-brand-soft text-forest" : "border-border text-muted-foreground",
            )}
          >
            {t("off.filter_all")}
          </button>
          {SECTOR_LIST.map((s) => {
            const Icon = SECTOR_ICON[s.id];
            return (
              <button
                key={s.id}
                onClick={() => setSector(s.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium",
                  sector === s.id ? "border-brand bg-brand-soft text-forest" : "border-border text-muted-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {t(s.labelKey as StringKey)}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-muted-foreground">{t("off.sort_label")}:</span>
          {SORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              className={cn(
                "rounded-full px-2.5 py-1 font-medium",
                sort === s.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {t(s.label)}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-2 sm:p-3">
          {rows.length === 0 && (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">{t("off.none_match")}</p>
          )}
          {rows.map((a, i) => {
            const sec = SECTORS[a.member.profile.sector];
            const Icon = SECTOR_ICON[a.member.profile.sector];
            const top = a.flags[0];
            return (
              <motion.button
                key={a.member.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.03 }}
                onClick={() => onOpen(a.member.id)}
                className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition-colors hover:bg-muted"
              >
                <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-forest">
                  <Icon className="size-5" />
                  <span
                    className="absolute -right-0.5 -top-0.5 size-3.5 rounded-full border-2 border-card"
                    style={{ background: dotColor(a.status) }}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{a.member.profile.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t(sec.labelKey as StringKey)} · {districtName(a.member.profile.districtId)}
                  </div>
                  {top && (
                    <div className="mt-0.5 truncate text-[12.5px] text-foreground/70">{causeText(t, top)}</div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {a.timeToGap != null && (
                    <div
                      className="tnum text-sm font-bold"
                      style={{ color: a.status === "risk" ? "var(--deficit)" : "var(--tight)" }}
                    >
                      {a.timeToGap === 0 ? t("off.time_now") : t("off.weeks_short", { n: a.timeToGap + 1 })}
                    </div>
                  )}
                  {a.atRisk > 0 && <div className="tnum text-xs text-muted-foreground">{rupee(a.atRisk)}</div>}
                </div>
                <InfoTip label={`${t("credit.score")}: ${a.credit.score}/100 · ${t(BAND_LABEL[a.credit.band])}`}>
                  <div>
                    <CreditChip score={a.credit.score} band={a.credit.band} />
                  </div>
                </InfoTip>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </motion.button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Monitor / dashboard ─────────────────────────────────────────────────────
function KpiTile({
  n,
  label,
  color,
  help,
}: {
  n: number;
  label: string;
  color?: string;
  help?: string;
}) {
  const body = (
    <div className="rounded-2xl bg-white/8 p-3 text-center">
      <div className="tnum text-2xl font-extrabold" style={color ? { color } : undefined}>
        {n}
      </div>
      <div
        className={cn(
          "text-[10.5px] text-primary-foreground/60",
          help && "cursor-help underline decoration-dashed decoration-white/30 underline-offset-2",
        )}
      >
        {label}
      </div>
    </div>
  );
  return help ? <InfoTip label={help}>{body}</InfoTip> : body;
}

export function OfficerMonitor({
  analyses,
  clusters,
}: {
  analyses: MemberAnalysis[];
  clusters: Cluster[];
}) {
  const { t } = useI18n();
  const totals = portfolioTotals(analyses);

  // cash at risk grouped by sector
  const bySector = new Map<string, number>();
  for (const a of analyses) {
    bySector.set(a.member.profile.sector, (bySector.get(a.member.profile.sector) ?? 0) + a.atRisk);
  }
  const barData = [...bySector.entries()]
    .map(([sec, v]) => ({
      sec,
      name: t(SECTORS[sec].labelKey as StringKey),
      value: Math.round(v),
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight md:hidden">{t("off.dashboard_title")}</h1>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[var(--radius)] bg-primary p-6 text-primary-foreground shadow-lg"
      >
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-brand/20 blur-2xl" />
        <div className="relative grid grid-cols-4 gap-2.5">
          <KpiTile n={totals.total} label={t("off.k_total")} />
          <KpiTile n={totals.risk} label={t("off.k_risk")} color="#ffb3aa" help={t("help.k_risk")} />
          <KpiTile n={totals.watch} label={t("off.k_watch")} color="#ffd699" help={t("help.k_watch")} />
          <KpiTile n={totals.healthy} label={t("off.k_steady")} color="var(--brand)" help={t("help.k_steady")} />
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
          <div>
            <div className="text-[11px] text-primary-foreground/60">{t("off.exposure")}</div>
            <div className="tnum text-xl font-extrabold text-brand">{rupee(totals.exposure)}</div>
          </div>
          <InfoTip label={t("help.k_ready")}>
            <div className="cursor-help">
              <div className="flex items-center gap-1 text-[11px] text-primary-foreground/60">
                <BadgeCheck className="size-3.5" /> {t("off.k_ready")}
              </div>
              <div className="tnum text-xl font-extrabold" style={{ color: "var(--surplus)" }}>
                {totals.loanReady} / {totals.total}
              </div>
            </div>
          </InfoTip>
        </div>
      </motion.div>

      {barData.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 font-bold tracking-tight">{t("off.exposure")}</h2>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="rounded-xl border border-border bg-popover px-3 py-2 text-sm shadow-lg">
                          <span className="tnum font-bold">{rupee(payload[0].value as number)}</span>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="value" radius={[8, 8, 8, 8]} maxBarSize={44}>
                    {barData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "var(--forest)" : "var(--brand)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-1 flex items-center gap-2 font-bold tracking-tight">
            <Layers className="size-5 text-forest" /> {t("off.cluster_title")}
          </h2>
          {clusters.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("off.cluster_none")}</p>
          ) : (
            <div className="mt-3 space-y-3">
              {clusters.map((c, i) => {
                const sector = SECTORS[c.sector];
                const Icon = SECTOR_ICON[c.sector];
                return (
                  <div key={i} className="rounded-2xl border border-l-4 border-l-deficit bg-deficit-soft/40 p-4">
                    <div className="flex items-start gap-2 font-semibold text-foreground">
                      <Icon className="mt-0.5 size-4 shrink-0 text-deficit" />
                      <span>
                        {t("off.cluster_line", {
                          count: c.count,
                          total: c.total,
                          sector: t(sector.labelKey as StringKey),
                          cause: t(CAUSE_SHORT[c.causeKey] ?? (c.causeKey as StringKey)),
                        })}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-4" />
                        <b className="font-semibold text-foreground">
                          {districtName(c.districtId)}
                        </b>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Droplets className="size-4" />
                        <b className="tnum font-semibold text-foreground">{rupee(c.atRisk)}</b> {t("off.at_risk_label")}
                      </span>
                    </div>
                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-card p-3 text-sm">
                      <Lightbulb className="mt-0.5 size-4 shrink-0 text-forest" />
                      {t("off.cluster_batch")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Enterprise detail (officer view) ────────────────────────────────────────
function FlagCard({ flag }: { flag: RiskFlag }) {
  const { t } = useI18n();
  const red = flag.severity === "red";
  return (
    <div className={cn("rounded-2xl border border-l-4 p-4", red ? "border-l-deficit bg-deficit-soft/40" : "border-l-tight bg-tight-soft/40")}>
      <Badge variant={red ? "deficit" : "tight"}>{red ? t("alerts.sev_red") : t("alerts.sev_amber")}</Badge>
      <div className="mt-2 font-semibold text-foreground">{causeText(t, flag)}</div>
      <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-card p-3 text-sm">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-forest" />
        {t(flag.actionKey as StringKey)}
      </div>
    </div>
  );
}

export function OfficerDetail({ a, onBack }: { a: MemberAnalysis; onBack: () => void }) {
  const { t } = useI18n();
  const sector = SECTORS[a.member.profile.sector];
  const SectorIcon = SECTOR_ICON[a.member.profile.sector];
  const statusVariant = a.status === "risk" ? "deficit" : a.status === "watch" ? "tight" : "surplus";
  const statusKey = (
    a.status === "healthy" ? "home.status_healthy" : a.status === "watch" ? "home.status_watch" : "home.status_risk"
  ) as StringKey;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft className="size-4" /> {t("off.back")}
      </Button>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[var(--radius)] bg-primary p-6 text-primary-foreground shadow-lg"
      >
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-brand/20 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-white/10 text-brand">
            <SectorIcon className="size-6" />
          </span>
          <div className="flex-1">
            <div className="text-lg font-bold">{a.member.profile.name}</div>
            <div className="text-xs text-primary-foreground/60">
              {t(sector.labelKey as StringKey)} · {districtName(a.member.profile.districtId)}
            </div>
          </div>
          <Badge variant={statusVariant}>{t(statusKey)}</Badge>
        </div>
        <div className="relative mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
          <div>
            <div className="text-[11px] text-primary-foreground/60">{t("home.balance_now")}</div>
            <div className="tnum text-base font-bold">{rupee(a.weeks[0].balance)}</div>
          </div>
          <div>
            <div className="text-[11px] text-primary-foreground/60">{t("home.projected_end")}</div>
            <div className="tnum text-base font-bold text-brand">{rupee(a.endBalance)}</div>
          </div>
          <div>
            <div className="text-[11px] text-primary-foreground/60">{t("off.exposure")}</div>
            <div className="tnum text-base font-bold">{rupee(a.atRisk)}</div>
          </div>
        </div>
      </motion.div>

      {/* Credit readiness - the institutional / passport payload */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-forest">
                <BadgeCheck className="size-4" />
              </span>
              <div>
                <h2 className="font-bold tracking-tight">{t("credit.title")}</h2>
                <p className="text-xs text-muted-foreground">{t("credit.subtitle")}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="tnum text-3xl font-extrabold" style={{ color: bandColor[a.credit.band] }}>
                {a.credit.score}
              </div>
              <Badge
                variant={a.credit.band === "ready" ? "surplus" : a.credit.band === "developing" ? "tight" : "deficit"}
              >
                {t(BAND_LABEL[a.credit.band])}
              </Badge>
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {a.credit.factors.map((f) => (
              <div key={f.key}>
                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span>{t(f.labelKey as StringKey)}</span>
                  <span className="tnum text-muted-foreground">
                    {f.points}/{f.max}
                  </span>
                </div>
                <Progress
                  value={(f.points / f.max) * 100}
                  indicatorClassName={f.positive ? "bg-surplus" : "bg-tight"}
                />
              </div>
            ))}
          </div>

          {a.credit.suggestedLimit > 0 && (
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-brand-soft/60 p-3.5">
              <span className="text-sm font-medium text-forest">{t("credit.suggested")}</span>
              <span className="tnum text-lg font-extrabold text-forest">{rupee(a.credit.suggestedLimit)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-2 font-bold tracking-tight">{t("off.forecast")}</h2>
          <CashFlowChart weeks={a.weeks} />
          <div className="mt-4">
            <HeatStrip weeks={a.weeks} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 font-bold tracking-tight">{t("off.risk_panel")}</h2>
          {a.flags.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="size-5 text-surplus" /> {t("off.no_flags")}
            </div>
          ) : (
            <div className="space-y-3">
              {a.flags.map((f) => (
                <FlagCard key={f.id} flag={f} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
