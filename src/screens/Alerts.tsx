import { motion } from "framer-motion";
import {
  CalendarDays,
  Droplets,
  Lightbulb,
  ShieldCheck,
  Thermometer,
  CloudRain,
  IndianRupee,
  Sun,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { useEnterprise } from "@/store/useEnterprise";
import { rupee } from "@/util";
import type { StringKey } from "@/i18n/strings";
import type { RiskFlag } from "@/engine/types";
import { districtAlerts, type LiveAlert, type LiveAlertKind } from "@/engine/districtAlerts";
import { districtName } from "@/data/locations";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LIVE_ICON: Record<LiveAlertKind, typeof Thermometer> = {
  heat: Thermometer,
  rain: CloudRain,
  market: IndianRupee,
  dry: Sun,
};

// Real, live-data alert (weather + market), distinct from the forecast flags.
function LiveAlertCard({ alert, index }: { alert: LiveAlert; index: number }) {
  const { t } = useI18n();
  const red = alert.severity === "red";
  const Icon = LIVE_ICON[alert.kind];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
      <Card className={cn("overflow-hidden border-l-4", red ? "border-l-deficit" : "border-l-tight")}>
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <span className={cn("flex size-8 items-center justify-center rounded-full", red ? "bg-deficit-soft text-deficit" : "bg-tight-soft text-tight")}>
              <Icon className="size-4" />
            </span>
            <Badge variant={red ? "deficit" : "tight"}>{red ? t("alerts.sev_red") : t("alerts.sev_amber")}</Badge>
          </div>
          <div className="mt-2.5 text-[17px] font-bold leading-snug text-foreground">
            {t(alert.titleKey as StringKey, alert.titleParams)}
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-brand-soft/60 p-3.5">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-forest" />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-forest/70">{t("alerts.suggestion")}</div>
              <div className="mt-0.5 text-sm text-foreground/90">{t(alert.actionKey as StringKey)}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AlertCard({ flag, index }: { flag: RiskFlag; index: number }) {
  const { t } = useI18n();
  const red = flag.severity === "red";
  const cause = t(flag.causeKey as StringKey, {
    ...flag.causeParams,
    eventKey: flag.causeParams?.eventKey ? t(flag.causeParams.eventKey as StringKey) : "",
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
      <Card className={cn("overflow-hidden border-l-4", red ? "border-l-deficit" : "border-l-tight")}>
        <CardContent className="p-5">
          <Badge variant={red ? "deficit" : "tight"}>{red ? t("alerts.sev_red") : t("alerts.sev_amber")}</Badge>
          <div className="mt-2.5 text-[17px] font-bold leading-snug text-foreground">{cause}</div>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" />
              <b className="font-semibold text-foreground">
                {flag.gapWeek === 0 ? t("alerts.now") : t("home.week_n", { n: flag.gapWeek + 1 })}
              </b>
            </span>
            <span className="flex items-center gap-1.5">
              <Droplets className="size-4" />
              <b className="tnum font-semibold text-foreground">
                {t("alerts.gap_amount", { amt: rupee(flag.gapAmount).replace("₹", "") })}
              </b>
            </span>
          </div>

          <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-brand-soft/60 p-3.5">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-forest" />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-forest/70">{t("alerts.suggestion")}</div>
              <div className="mt-0.5 text-sm text-foreground/90">{t(flag.actionKey as StringKey)}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function Alerts() {
  const { t } = useI18n();
  const { profile, useForecast } = useEnterprise();
  const { flags } = useForecast();
  const live = profile ? districtAlerts(profile.districtId, profile.sector) : [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight md:hidden">{t("alerts.title")}</h1>

      {/* Live district conditions - real weather + market */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          {t("live.section", { district: profile ? districtName(profile.districtId) : "" })}
        </h2>
        {live.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <ShieldCheck className="size-5 text-surplus" />
              <p className="text-sm text-muted-foreground">{t("live.none")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {live.map((a, i) => (
              <LiveAlertCard key={a.id} alert={a} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Forecast-driven risk flags */}
      {flags.length > 0 && (
        <div className="space-y-3">
          {flags.map((f, i) => (
            <AlertCard key={f.id} flag={f} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
