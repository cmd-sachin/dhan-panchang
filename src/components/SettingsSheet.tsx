import { Globe, Sun, Moon, UserCog, User, RotateCcw, Check, Home, CloudUpload } from "lucide-react";
import { useI18n, LANGUAGES, type LangCode } from "@/i18n";
import { useEnterprise } from "@/store/useEnterprise";
import { useTheme } from "@/hooks";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function SettingsSheet({
  role,
  onSwitchRole,
  onReset,
  onExit,
  children,
}: {
  role: "enterprise" | "officer";
  onSwitchRole: () => void;
  onReset?: () => void;
  onExit?: () => void;
  children: React.ReactNode;
}) {
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const { syncedAt } = useEnterprise();

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Globe className="size-5" /> Language / भाषा
          </SheetTitle>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-2.5">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code as LangCode)}
              className={cn(
                "flex items-center justify-between rounded-2xl border p-3.5 text-left transition-colors",
                l.code === lang
                  ? "border-brand bg-brand-soft"
                  : "border-border hover:bg-muted",
              )}
            >
              <span>
                <span className="block font-semibold text-forest">{l.native}</span>
                <span className="block text-xs text-muted-foreground">{l.label}</span>
              </span>
              {l.code === lang && <Check className="size-4 text-forest" />}
            </button>
          ))}
        </div>

        <Separator className="my-5" />

        <div className="flex flex-col gap-2.5">
          <Button variant="secondary" onClick={onSwitchRole} className="justify-start">
            {role === "officer" ? (
              <>
                <User className="size-5" /> {t("role.switch_enterprise")}
              </>
            ) : (
              <>
                <UserCog className="size-5" /> {t("role.switch_officer")}
              </>
            )}
          </Button>

          <Button variant="outline" onClick={toggle} className="justify-start">
            {theme === "light" ? (
              <>
                <Moon className="size-5" /> Dark mode
              </>
            ) : (
              <>
                <Sun className="size-5" /> Light mode
              </>
            )}
          </Button>

          {onExit && (
            <Button variant="outline" onClick={onExit} className="justify-start">
              <Home className="size-5" /> Back to home page
            </Button>
          )}

          {onReset && (
            <Button
              variant="ghost"
              onClick={() => {
                if (confirm(t("common.confirm_reset"))) onReset();
              }}
              className="justify-start text-muted-foreground"
            >
              <RotateCcw className="size-5" /> {t("common.reset_app")}
            </Button>
          )}

          <div className="flex items-center gap-2 px-1 pt-1 text-[11px] text-muted-foreground">
            <CloudUpload className="size-3.5" />
            {syncedAt
              ? t("sync.done", { time: new Date(syncedAt).toLocaleTimeString() })
              : t("sync.never")}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
