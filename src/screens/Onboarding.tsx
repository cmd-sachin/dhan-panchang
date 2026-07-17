import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Sparkles, WifiOff, TrendingUp, Bell } from "lucide-react";
import { useI18n, LANGUAGES, type LangCode } from "@/i18n";
import { useEnterprise } from "@/store/useEnterprise";
import { SECTOR_LIST } from "@/engine/sectors";
import { STATES, districtsOf } from "@/data/locations";
import { BUSINESS_GROUPS, businessType } from "@/data/businessTypes";
import type { SectorId } from "@/engine/types";
import type { StringKey } from "@/i18n/strings";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";
import { SECTOR_ICON } from "@/sectorMeta";
import { rupee } from "@/util";
import { cn } from "@/lib/utils";

function LangPicker() {
  const { lang, setLang } = useI18n();
  const current = LANGUAGES.find((l) => l.code === lang)!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="soft" size="sm">
          <Globe className="size-4" /> {current.native}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem key={l.code} onClick={() => setLang(l.code as LangCode)}>
            <span className="font-medium">{l.native}</span>
            <span className="text-xs text-muted-foreground">{l.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Onboarding({ onExit }: { onExit?: () => void }) {
  const { t } = useI18n();
  const { setup, loadDemo } = useEnterprise();
  const [step, setStep] = useState<0 | 1>(0);
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [btId, setBtId] = useState("broiler");
  const [otherText, setOtherText] = useState("");
  const [otherSector, setOtherSector] = useState<SectorId>("rural_retail");
  const [stateId, setStateId] = useState("maharashtra");
  const [district, setDistrict] = useState("nashik");
  const [balance, setBalance] = useState(8000);
  const stateDistricts = districtsOf(stateId);

  const isOther = btId === "other";
  const chosen = businessType(btId);
  const sector: SectorId = isOther ? otherSector : chosen?.sector ?? "rural_retail";
  const businessLabel = isOther ? otherText.trim() : chosen?.label ?? "";
  const nameValid = name.trim().length >= 2;
  const otherValid = !isOther || otherText.trim().length >= 2;
  const canSubmit = nameValid && otherValid;

  const submit = () => {
    setNameTouched(true);
    if (!canSubmit) return;
    setup({
      name: name.trim(),
      sector,
      businessType: businessLabel || undefined,
      districtId: district,
      openingBalance: balance,
      createdWeek: 0,
    });
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-1.5">
          {onExit && (
            <button
              onClick={onExit}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Back to home"
            >
              <ArrowLeft className="size-5" />
            </button>
          )}
          <Brand compact />
        </div>
        <LangPicker />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8">
        {step === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-1 flex-col"
          >
            {/* lime hero */}
            <div className="relative overflow-hidden rounded-[32px] bg-brand p-7 pt-9">
              <div className="absolute -right-10 -top-10 size-40 rounded-full bg-brand-strong/40 blur-2xl" />
              <h1 className="relative text-[34px] font-extrabold leading-[1.05] tracking-tight text-forest">
                {t("onb.headline")}
              </h1>
              <p className="relative mt-4 max-w-xs text-[15px] leading-relaxed text-forest/75">
                {t("onb.subtitle")}
              </p>
            </div>

            <div className="mt-6 grid gap-3">
              {[
                { icon: TrendingUp, text: t("onb.subtitle").split("—")[0] },
                { icon: Bell, text: t("home.next_flag") },
                { icon: WifiOff, text: t("net.offline") },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-forest">
                    <f.icon className="size-4.5" />
                  </span>
                  <span className="text-sm text-foreground/80">{f.text}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto flex flex-col gap-3 pt-8">
              <Button size="lg" onClick={() => setStep(1)}>
                {t("onb.get_started")} <ArrowRight className="size-5" />
              </Button>
              <Button variant="soft" size="lg" onClick={loadDemo}>
                <Sparkles className="size-5" /> {t("onb.use_demo")}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-1 flex-col"
          >
            <h2 className="mt-2 text-2xl font-bold tracking-tight">{t("onb.setup_title")}</h2>

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <Label>{t("onb.name_label")}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setNameTouched(true)}
                  placeholder={t("onb.name_ph")}
                  className={nameTouched && !nameValid ? "border-deficit focus-visible:ring-deficit/40" : ""}
                />
                {nameTouched && !nameValid && (
                  <p className="text-xs text-deficit">{t("onb.name_error")}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t("onb.sector_label")}</Label>
                <Select value={btId} onValueChange={setBtId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("onb.pick_business")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {BUSINESS_GROUPS.map((g) => (
                      <SelectGroup key={g.sector}>
                        <SelectLabel>{g.label}</SelectLabel>
                        {g.types.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                    <SelectGroup>
                      <SelectItem value="other">{t("onb.other_business")}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>

                {isOther && (
                  <div className="space-y-2 rounded-2xl bg-muted p-3">
                    <Input
                      value={otherText}
                      onChange={(e) => setOtherText(e.target.value)}
                      placeholder={t("onb.other_ph")}
                      className={nameTouched && !otherValid ? "border-deficit" : ""}
                    />
                    <p className="text-[11px] text-muted-foreground">{t("onb.other_like")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SECTOR_LIST.map((s) => {
                        const Icon = SECTOR_ICON[s.id];
                        return (
                          <button
                            key={s.id}
                            onClick={() => setOtherSector(s.id)}
                            className={cn(
                              "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                              otherSector === s.id
                                ? "border-brand bg-brand-soft font-semibold text-forest"
                                : "border-border",
                            )}
                          >
                            <Icon className="size-3.5" />
                            {t(s.labelKey as StringKey)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("loc.state")}</Label>
                  <Select
                    value={stateId}
                    onValueChange={(s) => {
                      setStateId(s);
                      setDistrict(districtsOf(s)[0].id);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATES.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("loc.district")}</Label>
                  <Select value={district} onValueChange={setDistrict}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stateDistricts.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <Label>{t("onb.balance_label")}</Label>
                  <span className="tnum text-lg font-extrabold text-forest">{rupee(balance)}</span>
                </div>
                <Slider
                  min={0}
                  max={100000}
                  step={500}
                  value={[balance]}
                  onValueChange={([v]) => setBalance(v)}
                />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>₹0</span>
                  <span>₹1,00,000+</span>
                </div>
              </div>
            </div>

            <div className="mt-auto flex flex-col gap-3 pt-8">
              <Button size="lg" onClick={submit} disabled={!canSubmit}>
                {t("onb.start")} <ArrowRight className="size-5" />
              </Button>
              <Button variant="ghost" onClick={() => setStep(0)}>
                ←
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
