import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Mic } from "lucide-react";
import { useI18n } from "@/i18n";
import { useEnterprise } from "@/store/useEnterprise";
import { SECTORS } from "@/engine/sectors";
import type { FlowType } from "@/engine/types";
import type { StringKey } from "@/i18n/strings";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const LANG_TAG: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
  ta: "ta-IN",
  te: "te-IN",
  bn: "bn-IN",
};

function useVoice(onResult: (t: string) => void) {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const [listening, setListening] = useState(false);
  return {
    supported: !!SR,
    listening,
    start: (lang: string) => {
      if (!SR) return;
      const rec = new SR();
      rec.lang = lang;
      rec.interimResults = false;
      rec.onresult = (e: any) => onResult(e.results[0][0].transcript);
      rec.onend = () => setListening(false);
      setListening(true);
      rec.start();
    },
  };
}

export function AddEntrySheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t, lang } = useI18n();
  const { profile, addEntry } = useEnterprise();
  const [type, setType] = useState<FlowType>("income");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");

  const voice = useVoice((text) => {
    const n = text.replace(/[^0-9]/g, "");
    if (n) setAmount(n);
  });

  if (!profile) return null;
  const sector = SECTORS[profile.sector];
  const cats = sector.events.filter((e) => e.type === type);

  const reset = () => {
    setType("income");
    setAmount("");
    setCategory("");
  };
  const save = () => {
    const amt = Number(amount);
    if (!amt) return;
    addEntry({ type, category: category || "other", amount: amt });
    reset();
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{t("ledger.add")}</SheetTitle>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-2.5">
          {(["income", "expense"] as FlowType[]).map((ty) => (
            <button
              key={ty}
              onClick={() => {
                setType(ty);
                setCategory("");
              }}
              className={cn(
                "flex items-center justify-center gap-2 rounded-2xl border py-3 font-semibold transition-colors",
                type === ty
                  ? ty === "income"
                    ? "border-surplus bg-surplus-soft text-surplus"
                    : "border-deficit bg-deficit-soft text-deficit"
                  : "border-border text-muted-foreground",
              )}
            >
              {ty === "income" ? <ArrowUpRight className="size-5" /> : <ArrowDownRight className="size-5" />}
              {ty === "income" ? t("ledger.income") : t("ledger.expense")}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          <Label>{t("ledger.amount")}</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            {voice.supported && (
              <Button
                variant={voice.listening ? "brand" : "outline"}
                size="icon"
                onClick={() => voice.start(LANG_TAG[lang] ?? "en-IN")}
              >
                <Mic className="size-5" />
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label>{t("ledger.category")}</Label>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={cn(
                  "rounded-full border px-3.5 py-2 text-sm transition-colors",
                  category === c.id
                    ? "border-brand bg-brand-soft font-semibold text-forest"
                    : "border-border hover:bg-muted",
                )}
              >
                {t(c.labelKey as StringKey)}
              </button>
            ))}
            <button
              onClick={() => setCategory("other")}
              className={cn(
                "rounded-full border px-3.5 py-2 text-sm transition-colors",
                category === "other"
                  ? "border-brand bg-brand-soft font-semibold text-forest"
                  : "border-border hover:bg-muted",
              )}
            >
              {t("ledger.other")}
            </button>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            {t("ledger.cancel")}
          </Button>
          <Button className="flex-1" onClick={save} disabled={!Number(amount)}>
            {t("ledger.save")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
