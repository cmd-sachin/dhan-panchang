import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type {
  EnterpriseProfile,
  LedgerEntry,
  ShockId,
} from "../engine/types";
import { getSignalPack, refreshSignalPack } from "../engine/signals";
import { computeForecast, forecastSummary, type ForecastInput } from "../engine/forecast";
import { detectFlags } from "../engine/anomaly";
import { SEED_PROFILE, SEED_LEDGER } from "../data/seed";
import type { SavingsGoal } from "../engine/model";
import { scheduleSync, pushDelete, lastSyncAt } from "../lib/sync";
import { useI18n } from "../i18n";

const LS_PROFILE = "dp.profile";
const LS_LEDGER = "dp.ledger";
const LS_DEMO = "dp.isDemo";
const LS_GOAL = "dp.goal";

interface State {
  profile: EnterpriseProfile | null;
  isDemo: boolean;
}

function load(): State {
  try {
    const p = localStorage.getItem(LS_PROFILE);
    return {
      profile: p ? (JSON.parse(p) as EnterpriseProfile) : null,
      isDemo: localStorage.getItem(LS_DEMO) === "1",
    };
  } catch {
    return { profile: null, isDemo: false };
  }
}

function loadLedger(): LedgerEntry[] {
  try {
    const l = localStorage.getItem(LS_LEDGER);
    return l ? (JSON.parse(l) as LedgerEntry[]) : [];
  } catch {
    return [];
  }
}

interface EnterpriseCtx {
  profile: EnterpriseProfile | null;
  ledger: LedgerEntry[];
  isDemo: boolean;
  goal: SavingsGoal | null;
  setGoal: (g: SavingsGoal | null) => void;
  syncedAt: number | null;
  setup: (p: EnterpriseProfile) => void;
  loadDemo: () => void;
  reset: () => void;
  addEntry: (e: Omit<LedgerEntry, "id" | "ts" | "weekOffset">) => void;
  // Derived, with optional what-if shock overrides.
  useForecast: (override?: Partial<Record<ShockId, number>>) => {
    weeks: ReturnType<typeof computeForecast>;
    summary: ReturnType<typeof forecastSummary>;
    flags: ReturnType<typeof detectFlags>;
    signal: ReturnType<typeof getSignalPack>;
    input: ForecastInput;
  };
}

const Ctx = createContext<EnterpriseCtx | null>(null);

function loadGoal(): SavingsGoal | null {
  try {
    const raw = localStorage.getItem(LS_GOAL);
    return raw ? (JSON.parse(raw) as SavingsGoal) : null;
  } catch {
    return null;
  }
}

export function EnterpriseProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const [state, setState] = useState<State>(load);
  const [ledger, setLedger] = useState<LedgerEntry[]>(loadLedger);
  const [goal, setGoalState] = useState<SavingsGoal | null>(loadGoal);
  const [syncedAt, setSyncedAt] = useState<number | null>(lastSyncAt);
  // Bumped when a live signal refresh lands, so forecasts recompute.
  const [signalVersion, setSignalVersion] = useState(0);

  // Cloud backup: push the full structured state to MongoDB (via the sync
  // server) whenever anything changes and we're online. Debounced; silent on
  // failure - the device copy is always the source of truth.
  const profileRef = state.profile;
  useEffect(() => {
    if (!profileRef) return;
    scheduleSync(
      () => ({
        profile: profileRef,
        goal,
        lang,
        ledger,
        signal: getSignalPack(profileRef.districtId),
      }),
      (ok) => {
        if (ok) setSyncedAt(Date.now());
      },
    );
  }, [profileRef, ledger, goal, lang, signalVersion]);

  // Refresh the district signal pack (live weather + this business's commodity)
  // whenever we're online and the profile's district or sector changes.
  const districtId = state.profile?.districtId;
  const sector = state.profile?.sector;
  useEffect(() => {
    if (!districtId) return;
    let cancelled = false;
    refreshSignalPack(districtId, sector).then((updated) => {
      if (updated && !cancelled) setSignalVersion((v) => v + 1);
    });
    const onOnline = () => {
      refreshSignalPack(districtId, sector).then((updated) => {
        if (updated && !cancelled) setSignalVersion((v) => v + 1);
      });
    };
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [districtId, sector]);

  const setGoal = useCallback((g: SavingsGoal | null) => {
    setGoalState(g);
    if (g) localStorage.setItem(LS_GOAL, JSON.stringify(g));
    else localStorage.removeItem(LS_GOAL);
  }, []);

  const persistLedger = useCallback((next: LedgerEntry[]) => {
    setLedger(next);
    localStorage.setItem(LS_LEDGER, JSON.stringify(next));
  }, []);

  const setup = useCallback((p: EnterpriseProfile) => {
    localStorage.setItem(LS_PROFILE, JSON.stringify(p));
    localStorage.setItem(LS_DEMO, "0");
    localStorage.setItem(LS_LEDGER, "[]");
    setState({ profile: p, isDemo: false });
    setLedger([]);
  }, []);

  const loadDemo = useCallback(() => {
    localStorage.setItem(LS_PROFILE, JSON.stringify(SEED_PROFILE));
    localStorage.setItem(LS_DEMO, "1");
    localStorage.setItem(LS_LEDGER, JSON.stringify(SEED_LEDGER));
    setState({ profile: SEED_PROFILE, isDemo: true });
    setLedger(SEED_LEDGER);
  }, []);

  const reset = useCallback(() => {
    void pushDelete(); // best-effort cloud cleanup; fine if offline
    localStorage.removeItem(LS_PROFILE);
    localStorage.removeItem(LS_LEDGER);
    localStorage.removeItem(LS_DEMO);
    localStorage.removeItem(LS_GOAL);
    setState({ profile: null, isDemo: false });
    setLedger([]);
    setGoalState(null);
    setSyncedAt(null);
  }, []);

  const addEntry = useCallback<EnterpriseCtx["addEntry"]>(
    (e) => {
      const entry: LedgerEntry = {
        ...e,
        id: `e_${Date.now()}_${Math.round(Math.random() * 1e6)}`,
        ts: Date.now(),
        weekOffset: 0, // new entries land in "this week"
      };
      persistLedger([...ledger, entry]);
    },
    [ledger, persistLedger],
  );

  const useForecast = useCallback<EnterpriseCtx["useForecast"]>(
    (override) => {
      const profile = state.profile!;
      const signal = getSignalPack(profile.districtId);
      const input: ForecastInput = {
        profile,
        ledger,
        signal,
        shockOverride: override,
      };
      const weeks = computeForecast(input);
      return {
        weeks,
        summary: forecastSummary(weeks),
        flags: detectFlags(profile, ledger, weeks, signal),
        signal,
        input,
      };
    },
    // signalVersion invalidates the memo when a live refresh lands.
    [state.profile, ledger, signalVersion],
  );

  const value = useMemo<EnterpriseCtx>(
    () => ({
      profile: state.profile,
      ledger,
      isDemo: state.isDemo,
      goal,
      setGoal,
      syncedAt,
      setup,
      loadDemo,
      reset,
      addEntry,
      useForecast,
    }),
    [state, ledger, goal, setGoal, syncedAt, setup, loadDemo, reset, addEntry, useForecast],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEnterprise(): EnterpriseCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useEnterprise must be used within provider");
  return ctx;
}
