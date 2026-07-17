import { useState, useMemo } from "react";
import {
  RotateCcw,
  TrendingUp,
  TrendingDown,
  HandCoins,
  CircleCheck,
  CircleAlert,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { useEnterprise } from "@/store/useEnterprise";
import { CashFlowChart } from "@/components/charts/CashFlowChart";
import { rupee } from "@/util";
import type { ShockId } from "@/engine/types";
import { checkLoan } from "@/engine/model";
import { SECTORS } from "@/engine/sectors";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// "Can I afford a loan?" - repayment-capacity stress test over the forecast.
function LoanCheck({ weeks }: { weeks: ReturnType<ReturnType<typeof useEnterprise>["useForecast"]>["weeks"] }) {
  const { t } = useI18n();
  const [amount, setAmount] = useState("50000");
  const [emi, setEmi] = useState("5000");
  const [verdict, setVerdict] = useState<ReturnType<typeof checkLoan> | null>(null);

  const run = () => {
    const a = Number(amount);
    const e = Number(emi);
    if (!a || !e) return;
    setVerdict(checkLoan(weeks, a, e));
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-forest">
            <HandCoins className="size-4" />
          </span>
          <h2 className="font-bold tracking-tight">{t("loan.title")}</h2>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">{t("loan.subtitle")}</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("loan.amount_label")}</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setVerdict(null);
              }}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("loan.emi_label")}</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={emi}
              onChange={(e) => {
                setEmi(e.target.value);
                setVerdict(null);
              }}
              className="h-10"
            />
          </div>
        </div>

        <Button size="sm" className="mt-4" onClick={run} disabled={!Number(amount) || !Number(emi)}>
          {t("loan.check")}
        </Button>

        {verdict && (
          <div
            className={`mt-4 flex items-start gap-3 rounded-2xl p-4 ${
              verdict.affordable ? "bg-surplus-soft" : "bg-deficit-soft"
            }`}
          >
            {verdict.affordable ? (
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-surplus" />
            ) : (
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-deficit" />
            )}
            <div>
              <div className={`font-bold ${verdict.affordable ? "text-surplus" : "text-deficit"}`}>
                {verdict.affordable ? t("loan.ok_title") : t("loan.risk_title")}
              </div>
              <p className="mt-0.5 text-sm text-foreground/80">
                {verdict.affordable
                  ? t("loan.ok_body", {
                      week: t("home.week_n", { n: verdict.tightestWeek + 1 }),
                      amt: rupee(verdict.tightestBalance),
                    })
                  : t("loan.risk_body", {
                      amt: rupee(Math.abs(verdict.tightestBalance)),
                      week: t("home.week_n", { n: verdict.tightestWeek + 1 }),
                    })}
              </p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">{t("loan.note")}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface Knob {
  id: ShockId;
  labelKey: "whatif.feed_price" | "whatif.monsoon" | "whatif.demand" | "whatif.fuel";
  lowKey: "whatif.low" | "whatif.weak";
  highKey: "whatif.high" | "whatif.strong";
}

const KNOBS: Knob[] = [
  { id: "feed_price", labelKey: "whatif.feed_price", lowKey: "whatif.low", highKey: "whatif.high" },
  { id: "monsoon", labelKey: "whatif.monsoon", lowKey: "whatif.weak", highKey: "whatif.strong" },
  { id: "demand", labelKey: "whatif.demand", lowKey: "whatif.low", highKey: "whatif.high" },
  { id: "fuel", labelKey: "whatif.fuel", lowKey: "whatif.low", highKey: "whatif.high" },
];

const NEUTRAL = { feed_price: 1, monsoon: 1, demand: 1, fuel: 1 };

export function WhatIf() {
  const { t } = useI18n();
  const { useForecast, profile } = useEnterprise();
  const [shocks, setShocks] = useState<Record<ShockId, number>>({ ...NEUTRAL });

  // Only offer sliders the sector is actually exposed to - a dead slider that
  // moves nothing only causes confusion.
  const sectorId = profile!.sector;
  const knobs = useMemo(() => {
    const relevant = new Set<ShockId>();
    for (const ev of SECTORS[sectorId].events) {
      for (const k of Object.keys(ev.sensitivity ?? {})) relevant.add(k as ShockId);
    }
    return KNOBS.filter((k) => relevant.has(k.id));
  }, [sectorId]);

  // "Feed price" reads oddly for a food processor - it's their input produce.
  const knobLabel = (k: Knob) =>
    k.id === "feed_price" && sectorId === "food_processing"
      ? t("whatif.input_price")
      : t(k.labelKey);

  const base = useForecast();
  // Sliders layer on top of the district's current Signal Pack, so 0% = today.
  const override = useMemo(() => {
    const s = base.signal.shocks;
    return {
      feed_price: s.feed_price * shocks.feed_price,
      monsoon: s.monsoon * shocks.monsoon,
      demand: s.demand * shocks.demand,
      fuel: s.fuel * shocks.fuel,
    };
  }, [base.signal.shocks, shocks]);
  const shocked = useForecast(override);
  const delta = shocked.summary.endBalance - base.summary.endBalance;
  const dirty = Object.values(shocks).some((v) => Math.abs(v - 1) > 0.001);
  const better = delta >= 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:hidden">{t("whatif.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("whatif.subtitle")}</p>
      </div>

      <Card>
        <CardContent className="p-5">
          <CashFlowChart weeks={shocked.weeks} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">{t("whatif.impact")}</div>
              <div
                className={`tnum flex items-center gap-1.5 text-3xl font-extrabold ${
                  better ? "text-surplus" : "text-deficit"
                }`}
              >
                {better ? <TrendingUp className="size-6" /> : <TrendingDown className="size-6" />}
                {better ? "+" : "−"}
                {rupee(Math.abs(delta)).replace("−", "")}
                <span className="text-sm font-medium">{better ? t("whatif.better") : t("whatif.worse")}</span>
              </div>
            </div>
            {dirty && (
              <Button variant="outline" size="sm" onClick={() => setShocks({ ...NEUTRAL })}>
                <RotateCcw className="size-4" /> {t("whatif.reset")}
              </Button>
            )}
          </div>

          <div className="mt-6 space-y-6">
            {knobs.map((k) => {
              const pct = Math.round((shocks[k.id] - 1) * 100);
              return (
                <div key={k.id}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium">{knobLabel(k)}</span>
                    <span
                      className={`tnum font-bold ${
                        pct === 0 ? "text-muted-foreground" : pct > 0 ? "text-forest" : "text-deficit"
                      }`}
                    >
                      {pct > 0 ? "+" : ""}
                      {pct}%
                    </span>
                  </div>
                  <Slider
                    min={0.7}
                    max={1.3}
                    step={0.01}
                    value={[shocks[k.id]]}
                    onValueChange={([v]) => setShocks((s) => ({ ...s, [k.id]: v }))}
                  />
                  <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                    <span>{t(k.lowKey)}</span>
                    <span>{t(k.highKey)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <LoanCheck weeks={base.weeks} />
    </div>
  );
}
