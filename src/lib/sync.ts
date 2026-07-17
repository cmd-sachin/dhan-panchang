import type { EnterpriseProfile, LedgerEntry, SignalPack } from "@/engine/types";
import type { SavingsGoal } from "@/engine/model";
import { stateOfDistrict } from "@/data/locations";

// ── Cloud backup (MongoDB via the sync server) ───────────────────────────────
// Offline-first contract: localStorage is the source of truth on the device.
// This module pushes a structured copy to the sync server whenever the device
// is online. Every failure is silent - the app never depends on the network.

const SYNC_URL: string =
  (import.meta.env?.VITE_SYNC_URL as string | undefined) ?? "http://localhost:8787";

const LS_DEVICE = "dp.deviceId";
const LS_LAST_SYNC = "dp.lastSync";

// Stable per-device id, doubling as the enterprise _id in MongoDB.
export function deviceId(): string {
  let id = localStorage.getItem(LS_DEVICE);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(LS_DEVICE, id);
  }
  return id;
}

export function lastSyncAt(): number | null {
  const raw = localStorage.getItem(LS_LAST_SYNC);
  return raw ? Number(raw) : null;
}

export interface SyncPayload {
  profile: EnterpriseProfile;
  goal: SavingsGoal | null;
  lang: string;
  ledger: LedgerEntry[];
  signal: SignalPack;
}

async function request(path: string, init: RequestInit): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${SYNC_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export async function pushState(payload: SyncPayload): Promise<boolean> {
  const body = JSON.stringify({
    ...payload,
    profile: {
      ...payload.profile,
      stateId: stateOfDistrict(payload.profile.districtId),
    },
  });
  const ok = await request(`/api/enterprises/${deviceId()}`, { method: "PUT", body });
  if (ok) localStorage.setItem(LS_LAST_SYNC, String(Date.now()));
  return ok;
}

export async function pushDelete(): Promise<boolean> {
  const ok = await request(`/api/enterprises/${deviceId()}`, { method: "DELETE" });
  if (ok) localStorage.removeItem(LS_LAST_SYNC);
  return ok;
}

// Debounced scheduler: rapid edits collapse into one push.
let timer: ReturnType<typeof setTimeout> | undefined;
export function scheduleSync(build: () => SyncPayload | null, onDone?: (ok: boolean) => void) {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const payload = build();
    if (!payload) return;
    const ok = await pushState(payload);
    onDone?.(ok);
  }, 1200);
}
