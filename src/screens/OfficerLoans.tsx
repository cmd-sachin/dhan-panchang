import { useEffect, useMemo, useState } from "react";
import {
  Wand2,
  CircleCheck,
  PauseCircle,
  XCircle,
  Trash2,
  CloudCheck,
} from "lucide-react";
import { useI18n } from "@/i18n";
import type { StringKey } from "@/i18n/strings";
import { rupee } from "@/util";
import { allocateLoans, type MemberAnalysis } from "@/engine/portfolio";
import { SECTORS } from "@/engine/sectors";
import { SECTOR_ICON } from "@/sectorMeta";
import { bandColor } from "@/engine/credit";
import { districtName } from "@/data/locations";
import {
  listDecisions,
  saveDecision,
  deleteDecision,
  type LoanDecision,
  type DecisionStatus,
} from "@/lib/officerApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<DecisionStatus, StringKey> = {
  recommended: "loans.status_recommended",
  approved: "loans.status_approved",
  hold: "loans.status_hold",
  declined: "loans.status_declined",
};
const STATUS_VARIANT: Record<DecisionStatus, "surplus" | "tight" | "deficit" | "default"> = {
  approved: "surplus",
  recommended: "default",
  hold: "tight",
  declined: "deficit",
};

export function OfficerLoans({ analyses }: { analyses: MemberAnalysis[] }) {
  const { t } = useI18n();
  const [budget, setBudget] = useState("100000");
  const [committed, setCommitted] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, LoanDecision>>({});

  useEffect(() => {
    listDecisions().then(setDecisions);
  }, []);

  const plan = useMemo(() => allocateLoans(analyses, Number(budget) || 0), [analyses, budget]);
  const byId = useMemo(() => new Map(analyses.map((a) => [a.member.id, a])), [analyses]);

  const bookAll = async () => {
    let map = decisions;
    for (const alloc of plan.allocations) {
      map = await saveDecision({
        enterpriseId: alloc.analysis.member.id,
        enterpriseName: alloc.analysis.member.profile.name,
        sector: alloc.analysis.member.profile.sector,
        status: "approved",
        amount: alloc.amount,
      });
    }
    setDecisions(map);
    setCommitted(true);
    setTimeout(() => setCommitted(false), 2500);
  };

  const setStatus = async (d: LoanDecision, status: DecisionStatus) => {
    setDecisions(await saveDecision({ ...d, status }));
  };
  const remove = async (id: string) => setDecisions(await deleteDecision(id));

  const committedList = Object.values(decisions).sort((a, b) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
  );
  const budgetNum = Number(budget) || 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:hidden">{t("loans.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("loans.subtitle")}</p>
      </div>

      {/* budget + allocation */}
      <Card>
        <CardContent className="p-5">
          <Label className="text-xs">{t("loans.budget")}</Label>
          <div className="mt-1.5 flex gap-2">
            <Input
              type="number"
              inputMode="numeric"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="h-11"
            />
          </div>

          {/* quick budget chips */}
          <div className="mt-2.5 flex gap-2">
            {[50000, 100000, 250000, 500000].map((b) => (
              <button
                key={b}
                onClick={() => setBudget(String(b))}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  budgetNum === b ? "border-brand bg-brand-soft text-forest" : "border-border text-muted-foreground",
                )}
              >
                {rupee(b)}
              </button>
            ))}
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Wand2 className="size-3.5" /> {t("loans.playground_hint")}
          </p>

          {/* allocation summary */}
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-muted p-3.5">
            <div>
              <div className="text-xs text-muted-foreground">{t("loans.used")}</div>
              <div className="tnum text-lg font-extrabold">
                {rupee(plan.used)}{" "}
                <span className="text-sm font-medium text-muted-foreground">
                  {t("loans.of")} {rupee(budgetNum)}
                </span>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              {t("loans.reached", { n: plan.reached })}
            </div>
          </div>

          {/* allocation list */}
          <div className="mt-3 space-y-2">
            {plan.allocations.map((alloc) => {
              const a = alloc.analysis;
              const Icon = SECTOR_ICON[a.member.profile.sector];
              return (
                <div key={a.member.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                  <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-forest">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.member.profile.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {districtName(a.member.profile.districtId)}
                    </div>
                  </div>
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background: `color-mix(in srgb, ${bandColor[a.credit.band]} 16%, transparent)`, color: bandColor[a.credit.band] }}
                  >
                    {a.credit.score}
                  </span>
                  <span className="tnum w-20 shrink-0 text-right text-sm font-bold">{rupee(alloc.amount)}</span>
                </div>
              );
            })}
          </div>

          {plan.allocations.length > 0 && (
            <Button className="mt-4 w-full" onClick={bookAll}>
              {committed ? (
                <>
                  <CloudCheck className="size-5" /> {t("sync.done", { time: "" }).replace("{time}", "").trim()}
                </>
              ) : (
                <>
                  <CircleCheck className="size-5" /> {t("loans.commit")}
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* committed loans - full CRUD */}
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 font-bold tracking-tight">{t("loans.committed")}</h2>
          {committedList.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("loans.none_committed")}</p>
          ) : (
            <div className="space-y-3">
              {committedList.map((d) => {
                const a = byId.get(d.enterpriseId);
                const Icon = a ? SECTOR_ICON[a.member.profile.sector] : SECTOR_ICON.rural_retail;
                return (
                  <div key={d.enterpriseId} className="rounded-2xl border border-border p-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-full bg-muted text-forest">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{d.enterpriseName ?? d.enterpriseId}</div>
                        {d.sector && (
                          <div className="text-[11px] text-muted-foreground">
                            {t(SECTORS[d.sector as keyof typeof SECTORS]?.labelKey as StringKey)}
                          </div>
                        )}
                      </div>
                      <span className="tnum text-sm font-bold">{rupee(d.amount)}</span>
                      <Badge variant={STATUS_VARIANT[d.status]}>{t(STATUS_LABEL[d.status])}</Badge>
                    </div>
                    <div className="mt-2.5 flex gap-1.5">
                      <button
                        onClick={() => setStatus(d, "approved")}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-surplus-soft py-1.5 text-xs font-semibold text-surplus"
                      >
                        <CircleCheck className="size-3.5" /> {t("loans.approve")}
                      </button>
                      <button
                        onClick={() => setStatus(d, "hold")}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-tight-soft py-1.5 text-xs font-semibold text-tight"
                      >
                        <PauseCircle className="size-3.5" /> {t("loans.hold")}
                      </button>
                      <button
                        onClick={() => setStatus(d, "declined")}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-deficit-soft py-1.5 text-xs font-semibold text-deficit"
                      >
                        <XCircle className="size-3.5" /> {t("loans.decline")}
                      </button>
                      <button
                        onClick={() => remove(d.enterpriseId)}
                        className="flex items-center justify-center rounded-lg border border-border px-2.5 text-muted-foreground hover:bg-muted"
                        aria-label={t("loans.remove")}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
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
