import type { LucideIcon } from "lucide-react";
import { Bell, Settings2, Wifi, WifiOff } from "lucide-react";
import { motion } from "framer-motion";
import { Brand } from "@/components/Brand";
import { SettingsSheet } from "@/components/SettingsSheet";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { useOnline } from "@/hooks";
import { cn } from "@/lib/utils";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface Props {
  title: string;
  items: NavItem[];
  active: string;
  onSelect: (id: string) => void;
  role: "enterprise" | "officer";
  onSwitchRole: () => void;
  onReset?: () => void;
  onExit?: () => void;
  notifCount?: number;
  onNotif?: () => void;
  children: React.ReactNode;
}

function OnlineChip({ hint = false }: { hint?: boolean }) {
  const { t } = useI18n();
  const online = useOnline();
  if (hint && !online) {
    // sidebar footer, offline: show the actionable hint
    return (
      <div className="flex items-start gap-1.5 rounded-xl bg-tight-soft px-2.5 py-1.5 text-[11px] font-medium text-tight">
        <WifiOff className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {t("net.offline")}
          <span className="block font-normal opacity-90">{t("net.offline_hint")}</span>
        </span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        online ? "bg-brand-soft text-forest" : "bg-tight-soft text-tight",
      )}
    >
      {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
      <span className={hint ? "" : "hidden sm:inline"}>
        {online ? t("net.online") : t("net.offline")}
      </span>
    </div>
  );
}

export function AppShell({
  title,
  items,
  active,
  onSelect,
  role,
  onSwitchRole,
  onReset,
  onExit,
  notifCount = 0,
  onNotif,
  children,
}: Props) {
  return (
    <div className="min-h-[100dvh] bg-muted/40 md:flex">
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-[100dvh] w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <div className="px-2 py-3">
          <Brand />
        </div>
        <nav className="mt-4 flex flex-col gap-1">
          {items.map((it) => {
            const Icon = it.icon;
            const on = active === it.id;
            return (
              <button
                key={it.id}
                onClick={() => onSelect(it.id)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[15px] font-medium transition-colors",
                  on
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-forest",
                )}
              >
                <Icon className="size-5" />
                <span className="flex-1 text-left">{it.label}</span>
                {!!it.badge && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-deficit text-[11px] font-bold text-white">
                    {it.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center justify-between gap-2 px-1">
          <OnlineChip hint />
          <SettingsSheet role={role} onSwitchRole={onSwitchRole} onReset={onReset} onExit={onExit}>
            <Button variant="ghost" size="icon-sm" aria-label="Settings">
              <Settings2 className="size-5" />
            </Button>
          </SettingsSheet>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden">
          <Brand compact />
          <div className="flex items-center gap-1.5">
            <OnlineChip />
            {onNotif && (
              <button
                onClick={onNotif}
                className="relative rounded-full p-2 text-muted-foreground hover:bg-muted"
                aria-label="Alerts"
              >
                <Bell className="size-5" />
                {notifCount > 0 && (
                  <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-deficit text-[10px] font-bold text-white">
                    {notifCount}
                  </span>
                )}
              </button>
            )}
            <SettingsSheet role={role} onSwitchRole={onSwitchRole} onReset={onReset} onExit={onExit}>
              <button
                className="rounded-full p-2 text-muted-foreground hover:bg-muted"
                aria-label="Settings"
              >
                <Settings2 className="size-5" />
              </button>
            </SettingsSheet>
          </div>
        </header>

        {/* desktop top bar */}
        <header className="sticky top-0 z-30 hidden items-center justify-between border-b border-border bg-background/80 px-8 py-4 backdrop-blur md:flex">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          {onNotif && (
            <button
              onClick={onNotif}
              className="relative rounded-full p-2 text-muted-foreground hover:bg-muted"
              aria-label="Alerts"
            >
              <Bell className="size-5" />
              {notifCount > 0 && (
                <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-deficit text-[10px] font-bold text-white">
                  {notifCount}
                </span>
              )}
            </button>
          )}
        </header>

        <motion.main
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-4 md:px-8 md:pb-10"
        >
          {children}
        </motion.main>

        {/* mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur md:hidden">
          {items.map((it) => {
            const Icon = it.icon;
            const on = active === it.id;
            return (
              <button
                key={it.id}
                onClick={() => onSelect(it.id)}
                className="relative flex flex-1 flex-col items-center gap-1 py-1.5"
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full px-4 py-1 transition-colors",
                    on ? "bg-brand-soft text-forest" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span
                  className={cn(
                    "text-[10.5px]",
                    on ? "font-semibold text-forest" : "text-muted-foreground",
                  )}
                >
                  {it.label}
                </span>
                {!!it.badge && (
                  <span className="absolute right-[22%] top-0 flex size-4 items-center justify-center rounded-full bg-deficit text-[9px] font-bold text-white">
                    {it.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
