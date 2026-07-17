import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  Plus,
  LineChart,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Bell,
  ShieldCheck,
  Target,
  X,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { useEnterprise } from "@/store/useEnterprise";
import { HeatStrip } from "@/components/HeatStrip";
import { rupee } from "@/util";
import type { StringKey } from "@/i18n/strings";
import { SECTORS } from "@/engine/sectors";
import type { RiskFlag } from "@/engine/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { InfoTip } from "@/components/ui/tooltip";
import { SECTOR_ICON } from "@/sectorMeta";
import { districtName } from "@/data/locations";
import { goalStatus } from "@/engine/model";
import { cn } from "@/lib/utils";

function statusOf(flags: RiskFlag[]): "healthy" | "watch" | "risk" {
  if (flags.some((f) => f.severity === "red")) return "risk";
  if (flags.length > 0) return "watch";
  return "healthy";
}

// Rotating "welcome" greeting across Indian languages.
const GREETINGS = [
  "Namaste",
  "नमस्ते",
  "নমস্কার",
  "வணக்கம்",
  "నమస్కారం",
  "ನಮಸ್ಕಾರ",
  "નમસ્તે",
  "ਸਤ ਸ੍ਰੀ ਅਕਾਲ",
  "नमस्कार",
];

function RotatingGreeting() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % GREETINGS.length), 2800);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="relative inline-flex h-[1.4em] overflow-hidden align-bottom">
      <AnimatePresence mode="wait">
        <motion.span
          key={i}
          initial={{ y: "70%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-70%", opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="whitespace-nowrap text-forest"
        >
          {GREETINGS[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// Savings goal: set a target, see on-track / behind from the forecast.
function GoalCard() {
  const { t } = useI18n();
  const { goal, setGoal, useForecast } = useEnterprise();
  const { weeks } = useForecast();
  const [amount, setAmount] = useState("20000");
  const [byWeek, setByWeek] = useState(13);

  if (!goal) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-forest">
              <Target className="size-4" />
            </span>
            <h2 className="font-bold tracking-tight">{t("goal.title")}</h2>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">{t("goal.subtitle")}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("goal.target_label")}</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("goal.by_label")}</Label>
              <div className="flex gap-1.5">
                {[1, 3, 6].map((m) => (
                  <button
                    key={m}
                    onClick={() => setByWeek(Math.min(26, Math.round(m * 4.33)))}
                    className={cn(
                      "flex-1 rounded-xl border px-1 py-2 text-xs font-semibold",
                      byWeek === Math.min(26, Math.round(m * 4.33))
                        ? "border-brand bg-brand-soft text-forest"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {m === 1 ? t("horizon.1m") : t("goal.months_n", { n: m })}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            className="mt-4"
            disabled={!Number(amount)}
            onClick={() => setGoal({ target: Number(amount), byWeek })}
          >
            {t("goal.set")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const status = goalStatus(weeks, goal);
  const haveNow = weeks[0].balance; // cash saved so far
  // progress bar = how much of the target you hold TODAY (partial, honest)
  const pct = Math.max(0, Math.min(100, (haveNow / goal.target) * 100));
  const whenLabel = t("goal.months_n", { n: Math.max(1, Math.round(goal.byWeek / 4.33)) });
  const gap = Math.max(0, goal.target - status.projected);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-forest">
              <Target className="size-4" />
            </span>
            <h2 className="font-bold tracking-tight">{t("goal.title")}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status.onTrack ? "surplus" : "tight"}>
              {status.onTrack ? t("goal.on_track") : t("goal.behind")}
            </Badge>
            <InfoTip label={t("goal.remove")}>
              <button
                onClick={() => setGoal(null)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </InfoTip>
          </div>
        </div>

        {/* saved so far → target, with a genuinely partial bar */}
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">
            {t("goal.have_now")}{" "}
            <b className="tnum text-foreground">{rupee(haveNow)}</b>
          </span>
          <span className="tnum font-bold">{rupee(goal.target)}</span>
        </div>
        <Progress value={pct} indicatorClassName={status.onTrack ? "bg-surplus" : "bg-tight"} />
        <div className="mt-1 text-right text-[11px] text-muted-foreground">{Math.round(pct)}%</div>

        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {status.onTrack
            ? t("goal.reach_msg", { target: rupee(goal.target), when: whenLabel })
            : t("goal.short_msg", { gap: rupee(gap), when: whenLabel, amt: rupee(status.weeklyExtra) })}
        </p>
      </CardContent>
    </Card>
  );
}

export function Home({
  goForecast,
  goAlerts,
  goLedger,
  onAdd,
}: {
  goForecast: () => void;
  goAlerts: () => void;
  goLedger: () => void;
  onAdd: () => void;
}) {
  const { t } = useI18n();
  const { profile, ledger, useForecast } = useEnterprise();
  const { weeks, summary, flags } = useForecast();
  const [show, setShow] = useState(true);
  const p = profile!;
  const sector = SECTORS[p.sector];
  const SectorIcon = SECTOR_ICON[p.sector];
  const status = statusOf(flags);
  const topFlag = flags[0];

  const statusVariant = status === "risk" ? "deficit" : status === "watch" ? "tight" : "surplus";
  const statusKey = (
    status === "healthy" ? "home.status_healthy" : status === "watch" ? "home.status_watch" : "home.status_risk"
  ) as StringKey;

  const recent = [...ledger].sort((a, b) => b.ts - a.ts || b.weekOffset - a.weekOffset).slice(0, 4);
  const mask = (s: string) => (show ? s : "••••••");

  return (
    <div className="space-y-4">
      {/* greeting */}
      <div className="flex items-center gap-3">
        <InfoTip label={p.businessType ?? t(sector.labelKey as StringKey)}>
          <span className="flex size-11 cursor-help items-center justify-center rounded-full bg-brand-soft text-forest">
            <SectorIcon className="size-5" />
          </span>
        </InfoTip>
        <div>
          <div className="text-lg font-bold tracking-tight">
            <RotatingGreeting />, {p.name}
          </div>
          <div className="text-sm text-muted-foreground">
            {p.businessType ?? t(sector.labelKey as StringKey)} · {districtName(p.districtId)}
          </div>
        </div>
      </div>

      {/* balance hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[var(--radius)] bg-primary p-6 text-primary-foreground shadow-lg"
      >
        <div className="absolute -right-12 -top-12 size-44 rounded-full bg-brand/20 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <InfoTip label={t("help.balance_now")}>
            <span className="cursor-help border-b border-dashed border-white/30 text-sm text-primary-foreground/70">
              {t("home.balance_now")}
            </span>
          </InfoTip>
          <InfoTip label={t("help.status")}>
            <Badge variant={statusVariant} size="sm" className="cursor-help">
              {t(statusKey)}
            </Badge>
          </InfoTip>
        </div>
        <div className="relative mt-1 flex items-center gap-3">
          <span className="tnum text-[40px] font-extrabold leading-none">
            {mask(rupee(weeks[0].balance))}
          </span>
          <InfoTip label={t("help.hide")}>
            <button onClick={() => setShow((v) => !v)} className="text-primary-foreground/60">
              {show ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
            </button>
          </InfoTip>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
          <div>
            <InfoTip label={t("help.projected_end")}>
              <span className="cursor-help border-b border-dashed border-white/30 text-[11px] text-primary-foreground/60">
                {t("home.projected_end")}
              </span>
            </InfoTip>
            <div className="tnum text-lg font-bold text-brand">{mask(rupee(summary.endBalance))}</div>
          </div>
          <div>
            <InfoTip label={t("help.net_flow")}>
              <span className="cursor-help border-b border-dashed border-white/30 text-[11px] text-primary-foreground/60">
                {t("home.net_flow")}
              </span>
            </InfoTip>
            <div className="tnum text-lg font-bold">
              {show ? (summary.netFlow >= 0 ? "+" : "") + rupee(summary.netFlow) : "••••"}
            </div>
          </div>
        </div>
      </motion.div>

      {/* actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={onAdd}>
          <Plus className="size-5" /> {t("home.quick_add")}
        </Button>
        <Button variant="soft" onClick={goForecast}>
          <LineChart className="size-5" /> {t("nav.forecast")}
        </Button>
      </div>

      {/* almanac */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-bold tracking-tight">{t("home.almanac_title")}</h2>
            <button onClick={goForecast} className="text-muted-foreground">
              <ChevronRight className="size-5" />
            </button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">{t("home.almanac_hint")}</p>
          <HeatStrip weeks={weeks} />
        </CardContent>
      </Card>

      {/* next warning */}
      <Card
        className={topFlag ? "cursor-pointer" : ""}
        onClick={() => topFlag && goAlerts()}
      >
        <CardContent className="p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-forest">
              {topFlag ? <Bell className="size-4" /> : <ShieldCheck className="size-4" />}
            </span>
            <h2 className="font-bold tracking-tight">{t("home.next_flag")}</h2>
          </div>
          {topFlag ? (
            <div className="space-y-2">
              <Badge variant={topFlag.severity === "red" ? "deficit" : "tight"}>
                {topFlag.severity === "red" ? t("alerts.sev_red") : t("alerts.sev_amber")}
              </Badge>
              <div className="font-semibold text-forest">
                {t(topFlag.causeKey as StringKey, {
                  ...topFlag.causeParams,
                  eventKey: topFlag.causeParams?.eventKey
                    ? t(topFlag.causeParams.eventKey as StringKey)
                    : "",
                })}
              </div>
              <div className="text-sm text-muted-foreground">
                {topFlag.gapWeek === 0
                  ? t("alerts.now")
                  : t("alerts.gap_at", { when: t("home.week_n", { n: topFlag.gapWeek + 1 }) })}{" "}
                · {t("alerts.gap_amount", { amt: rupee(topFlag.gapAmount).replace("₹", "") })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("home.all_clear")}</p>
          )}
        </CardContent>
      </Card>

      {/* savings goal */}
      <GoalCard />

      {/* recent activity */}
      {recent.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold tracking-tight">{t("home.recent")}</h2>
              <button onClick={goLedger} className="text-sm font-medium text-forest">
                {t("home.see_all")}
              </button>
            </div>
            <div className="space-y-1">
              {recent.map((e) => {
                const ev = sector.events.find((x) => x.id === e.category);
                return (
                  <div key={e.id} className="flex items-center gap-3 py-2">
                    <span
                      className={`flex size-10 items-center justify-center rounded-full ${
                        e.type === "income" ? "bg-surplus-soft text-surplus" : "bg-deficit-soft text-deficit"
                      }`}
                    >
                      {e.type === "income" ? (
                        <ArrowUpRight className="size-5" />
                      ) : (
                        <ArrowDownRight className="size-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {ev ? t(ev.labelKey as StringKey) : t("ledger.other")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.weekOffset === 0 ? t("home.this_week") : t("home.week_n", { n: e.weekOffset })}
                      </div>
                    </div>
                    <div className={`tnum font-bold ${e.type === "income" ? "text-surplus" : "text-foreground"}`}>
                      {e.type === "expense" ? "−" : "+"}
                      {rupee(e.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
