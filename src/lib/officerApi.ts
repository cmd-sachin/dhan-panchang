import { PORTFOLIO, type PortfolioMember } from "@/data/portfolio";
import { stateOfDistrict } from "@/data/locations";

// ── Officer data layer (MongoDB-backed CRUD) ─────────────────────────────────
// The officer's loan-decision workflow persists to MongoDB via the sync server.
// A localStorage mirror keeps everything working offline; the two reconcile on
// the next successful call.

const SYNC_URL: string =
  (import.meta.env?.VITE_SYNC_URL as string | undefined) ?? "http://localhost:8787";
const LS_DECISIONS = "dp.decisions";

export type DecisionStatus = "recommended" | "approved" | "hold" | "declined";

export interface LoanDecision {
  enterpriseId: string;
  enterpriseName?: string;
  sector?: string;
  status: DecisionStatus;
  amount: number;
  note?: string;
  updatedAt?: string;
}

async function api(path: string, init?: RequestInit): Promise<any | null> {
  if (!navigator.onLine) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`${SYNC_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Local mirror ──────────────────────────────────────────────────────────
function readLocal(): Record<string, LoanDecision> {
  try {
    return JSON.parse(localStorage.getItem(LS_DECISIONS) ?? "{}");
  } catch {
    return {};
  }
}
function writeLocal(map: Record<string, LoanDecision>) {
  localStorage.setItem(LS_DECISIONS, JSON.stringify(map));
}

// Push the officer's book into MongoDB so it can be read/updated/deleted.
export async function seedPortfolio(
  members: PortfolioMember[] = PORTFOLIO,
): Promise<boolean> {
  const payload = members.map((m) => ({
    id: m.id,
    profile: { ...m.profile, stateId: stateOfDistrict(m.profile.districtId) },
    ledger: m.ledger,
  }));
  const r = await api("/api/portfolio/seed", {
    method: "POST",
    body: JSON.stringify({ members: payload }),
  });
  return !!r?.ok;
}

// READ - server first, fall back to local mirror.
export async function listDecisions(): Promise<Record<string, LoanDecision>> {
  const r = await api("/api/decisions");
  if (r?.decisions) {
    const map: Record<string, LoanDecision> = {};
    for (const d of r.decisions) map[d.enterpriseId] = d;
    writeLocal(map);
    return map;
  }
  return readLocal();
}

// CREATE / UPDATE - optimistic local write, then server.
export async function saveDecision(d: LoanDecision): Promise<Record<string, LoanDecision>> {
  const map = readLocal();
  map[d.enterpriseId] = { ...d, updatedAt: new Date().toISOString() };
  writeLocal(map);
  await api(`/api/decisions/${d.enterpriseId}`, { method: "PUT", body: JSON.stringify(d) });
  return { ...map };
}

// DELETE.
export async function deleteDecision(enterpriseId: string): Promise<Record<string, LoanDecision>> {
  const map = readLocal();
  delete map[enterpriseId];
  writeLocal(map);
  await api(`/api/decisions/${enterpriseId}`, { method: "DELETE" });
  return { ...map };
}
