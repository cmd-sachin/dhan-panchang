import { useI18n } from "@/i18n";

function Mark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="3" y="3" width="16" height="16" rx="5" fill="var(--forest)" />
      <rect x="13" y="13" width="16" height="16" rx="5" fill="var(--brand)" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2.5">
      <Mark className="size-8" />
      <div className="leading-tight">
        <div className="font-bold tracking-tight">{t("app.name")}</div>
        {!compact && (
          <div className="text-[11px] text-muted-foreground">{t("app.tagline")}</div>
        )}
      </div>
    </div>
  );
}
