import { useEffect, useMemo, useState } from "react";
import {
  Home as HomeIcon,
  LineChart,
  SlidersHorizontal,
  Bell,
  WalletMinimal,
  ListChecks,
  ChartColumnBig,
  ChartPie,
  Landmark,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { useEnterprise } from "@/store/useEnterprise";
import { AppShell, type NavItem } from "@/components/AppShell";
import { AddEntrySheet } from "@/components/AddEntrySheet";
import { Onboarding } from "@/screens/Onboarding";
import { Home } from "@/screens/Home";
import { Forecast } from "@/screens/Forecast";
import { WhatIf } from "@/screens/WhatIf";
import { Alerts } from "@/screens/Alerts";
import { Ledger } from "@/screens/Ledger";
import { OfficerTriage, OfficerMonitor, OfficerDetail, OfficerSetup } from "@/screens/Officer";
import { OfficerAnalytics } from "@/screens/OfficerAnalytics";
import { OfficerLoans } from "@/screens/OfficerLoans";
import { Landing } from "@/screens/Landing";
import { analysePortfolio, detectClusters, portfolioTotals } from "@/engine/portfolio";
import { districtPortfolio } from "@/data/portfolio";
import { refreshSignalPack } from "@/engine/signals";
import { districtName } from "@/data/locations";
import type { SectorId } from "@/engine/types";
import { seedPortfolio } from "@/lib/officerApi";

type Role = "enterprise" | "officer";
type EntTab = "home" | "forecast" | "whatif" | "alerts" | "ledger";
type OffTab = "triage" | "analytics" | "loans" | "monitor";

const LS_ROLE = "dp.role";
const LS_ENTERED = "dp.entered";
const LS_OFF_DISTRICT = "dp.officerDistrict";

export default function App() {
  const { t } = useI18n();
  const { profile, useForecast, reset } = useEnterprise();
  const [role, setRole] = useState<Role>(() => (localStorage.getItem(LS_ROLE) as Role) || "enterprise");
  const [entered, setEntered] = useState(() => localStorage.getItem(LS_ENTERED) === "1");
  const [entTab, setEntTab] = useState<EntTab>("home");
  const [offTab, setOffTab] = useState<OffTab>("triage");
  const [selected, setSelected] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const enter = (r: Role) => {
    setRole(r);
    localStorage.setItem(LS_ROLE, r);
    setEntered(true);
    localStorage.setItem(LS_ENTERED, "1");
    setSelected(null);
    setEntTab("home");
    setOffTab("triage");
  };
  const exitHome = () => {
    setEntered(false);
    localStorage.removeItem(LS_ENTERED);
  };
  const switchRole = () => {
    const next: Role = role === "enterprise" ? "officer" : "enterprise";
    setRole(next);
    localStorage.setItem(LS_ROLE, next);
    setSelected(null);
  };

  // ── Public landing / guest entry ─────────────────────────────────────────
  if (!entered) {
    return <Landing onEnterprise={() => enter("enterprise")} onOfficer={() => enter("officer")} />;
  }

  // ── Onboarding (enterprise, no profile) ─────────────────────────────────
  if (role === "enterprise" && !profile) {
    return <Onboarding onExit={exitHome} />;
  }

  // ── Officer mode ────────────────────────────────────────────────────────
  if (role === "officer") {
    return <OfficerApp offTab={offTab} setOffTab={setOffTab} selected={selected} setSelected={setSelected} switchRole={switchRole} exitHome={exitHome} />;
  }

  // ── Enterprise mode ───────────────────────────────────────────────────────
  const { flags } = useForecast();
  const items: NavItem[] = [
    { id: "home", label: t("nav.home"), icon: HomeIcon },
    { id: "forecast", label: t("nav.forecast"), icon: LineChart },
    { id: "whatif", label: t("nav.whatif"), icon: SlidersHorizontal },
    { id: "alerts", label: t("nav.alerts"), icon: Bell, badge: flags.length || undefined },
    { id: "ledger", label: t("nav.ledger"), icon: WalletMinimal },
  ];
  const titleMap: Record<EntTab, string> = {
    home: t("nav.home"),
    forecast: t("nav.forecast"),
    whatif: t("whatif.title"),
    alerts: t("alerts.title"),
    ledger: t("ledger.title"),
  };

  return (
    <>
      <AppShell
        title={titleMap[entTab]}
        items={items}
        active={entTab}
        onSelect={(id) => setEntTab(id as EntTab)}
        role={role}
        onSwitchRole={switchRole}
        onReset={reset}
        onExit={exitHome}
        notifCount={flags.length}
        onNotif={() => setEntTab("alerts")}
      >
        {entTab === "home" && (
          <Home
            goForecast={() => setEntTab("forecast")}
            goAlerts={() => setEntTab("alerts")}
            goLedger={() => setEntTab("ledger")}
            onAdd={() => setAddOpen(true)}
          />
        )}
        {entTab === "forecast" && <Forecast />}
        {entTab === "whatif" && <WhatIf />}
        {entTab === "alerts" && <Alerts />}
        {entTab === "ledger" && <Ledger onAdd={() => setAddOpen(true)} />}
      </AppShell>
      <AddEntrySheet open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}

function OfficerApp({
  offTab,
  setOffTab,
  selected,
  setSelected,
  switchRole,
  exitHome,
}: {
  offTab: OffTab;
  setOffTab: (t: OffTab) => void;
  selected: string | null;
  setSelected: (id: string | null) => void;
  switchRole: () => void;
  exitHome: () => void;
}) {
  const { t } = useI18n();
  const [district, setDistrict] = useState<string | null>(
    () => localStorage.getItem(LS_OFF_DISTRICT),
  );

  // one officer = one district: pick jurisdiction before the book loads
  const pickDistrict = (d: string) => {
    localStorage.setItem(LS_OFF_DISTRICT, d);
    setDistrict(d);
    setSelected(null);
    setOffTab("triage");
  };

  const members = useMemo(() => (district ? districtPortfolio(district) : []), [district]);

  // Fetch the district's LIVE signals (weather + the dominant sector's commodity)
  // so the officer's conditions & alerts are real.
  useEffect(() => {
    if (!district || !members.length) return;
    const counts: Record<string, number> = {};
    for (const m of members) counts[m.profile.sector] = (counts[m.profile.sector] ?? 0) + 1;
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as
      | SectorId
      | undefined;
    void refreshSignalPack(district, dominant);
  }, [district, members]);
  const analyses = useMemo(() => analysePortfolio(members), [members]);
  const clusters = useMemo(() => detectClusters(analyses), [analyses]);
  const totals = portfolioTotals(analyses);
  const current = analyses.find((a) => a.member.id === selected) ?? null;

  // Populate MongoDB with the officer's book so it can be read/updated/deleted.
  useEffect(() => {
    if (members.length) void seedPortfolio(members);
  }, [members]);

  if (!district) {
    return (
      <div className="shell mx-auto min-h-[100dvh] max-w-md px-5">
        <OfficerSetup onPick={pickDistrict} />
      </div>
    );
  }

  const titleMap: Record<OffTab, string> = {
    triage: t("off.portfolio_title"),
    analytics: t("an.title"),
    loans: t("loans.title"),
    monitor: t("off.dashboard_title"),
  };

  const items: NavItem[] = [
    { id: "triage", label: t("off.nav_portfolio"), icon: ListChecks, badge: totals.risk + totals.watch || undefined },
    { id: "analytics", label: t("off.nav_analytics"), icon: ChartPie },
    { id: "loans", label: t("off.nav_loans"), icon: Landmark, badge: totals.loanReady || undefined },
    { id: "monitor", label: t("off.nav_dashboard"), icon: ChartColumnBig, badge: clusters.length || undefined },
  ];

  const changeDistrict = () => {
    localStorage.removeItem(LS_OFF_DISTRICT);
    setDistrict(null);
  };

  return (
    <AppShell
      title={`${districtName(district)} · ${current ? t("off.profile_title") : titleMap[offTab]}`}
      items={items}
      active={offTab}
      onSelect={(id) => {
        setSelected(null);
        setOffTab(id as OffTab);
      }}
      role="officer"
      onSwitchRole={switchRole}
      onExit={exitHome}
    >
      {current ? (
        <OfficerDetail a={current} onBack={() => setSelected(null)} />
      ) : offTab === "triage" ? (
        <OfficerTriage
          analyses={analyses}
          onOpen={setSelected}
          districtId={district}
          onChangeDistrict={changeDistrict}
        />
      ) : offTab === "analytics" ? (
        <OfficerAnalytics analyses={analyses} />
      ) : offTab === "loans" ? (
        <OfficerLoans analyses={analyses} />
      ) : (
        <OfficerMonitor analyses={analyses} clusters={clusters} />
      )}
    </AppShell>
  );
}
