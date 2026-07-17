import { ArrowUpRight, ArrowDownRight, Plus, NotebookPen } from "lucide-react";
import { useI18n } from "@/i18n";
import { useEnterprise } from "@/store/useEnterprise";
import { SECTORS } from "@/engine/sectors";
import { rupee } from "@/util";
import type { StringKey } from "@/i18n/strings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function Ledger({ onAdd }: { onAdd: () => void }) {
  const { t } = useI18n();
  const { profile, ledger } = useEnterprise();
  const sector = SECTORS[profile!.sector];
  const rows = [...ledger].sort((a, b) => b.ts - a.ts || b.weekOffset - a.weekOffset);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("ledger.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("ledger.learn_note")}</p>
        </div>
        <Button onClick={onAdd} className="hidden md:inline-flex">
          <Plus className="size-5" /> {t("ledger.add")}
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-forest">
              <NotebookPen className="size-7" />
            </span>
            <p className="max-w-xs text-sm text-muted-foreground">{t("ledger.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-2 sm:p-4">
            {rows.map((e, i) => {
              const ev = sector.events.find((x) => x.id === e.category);
              return (
                <div key={e.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center gap-3 px-2 py-3">
                    <span
                      className={`flex size-10 items-center justify-center rounded-full ${
                        e.type === "income" ? "bg-surplus-soft text-surplus" : "bg-deficit-soft text-deficit"
                      }`}
                    >
                      {e.type === "income" ? <ArrowUpRight className="size-5" /> : <ArrowDownRight className="size-5" />}
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
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* mobile FAB */}
      <button
        onClick={onAdd}
        className="fixed bottom-24 right-5 z-30 flex size-14 items-center justify-center rounded-full bg-brand text-forest shadow-lg shadow-brand/40 transition-transform active:scale-95 md:hidden"
        aria-label={t("ledger.add")}
      >
        <Plus className="size-7" />
      </button>
    </div>
  );
}
