// Merchant catalog service.
//
// Builtin merchants ship as one JSON file per merchant under
// `src/data/merchants/`. Vite's `import.meta.glob({ eager: true })` pulls
// them into the bundle at build time, so adding a new merchant is just
// dropping a new JSON file — no manual registration.
//
// User-defined merchants live in IndexedDB. The combined lookup applies a
// "user-wins" override semantic so a user can edit a builtin's logo/color
// without affecting other devices.

import { useEffect, useSyncExternalStore } from 'react';
import { userMerchants } from './db';
import type { MerchantDefinition } from './types';

// ─── Builtin loading ──────────────────────────────────────────────────────

const builtinModules = import.meta.glob<{ default: MerchantDefinition }>(
  '../data/merchants/*.json',
  { eager: true },
);

export const BUILTIN_MERCHANTS: readonly MerchantDefinition[] = Object.values(builtinModules)
  .map((m) => m.default)
  .filter((m) => m && typeof m.id === 'string')
  .sort((a, b) => a.name.localeCompare(b.name));

const BUILTIN_BY_ID = new Map(BUILTIN_MERCHANTS.map((m) => [m.id, m]));

// ─── User store + pub/sub ─────────────────────────────────────────────────

let userCache: MerchantDefinition[] = [];
let loaded = false;
const subscribers = new Set<() => void>();

function notify() {
  for (const fn of subscribers) fn();
}

async function refreshUserCache(): Promise<void> {
  userCache = await userMerchants.list();
  loaded = true;
  notify();
}

export async function ensureMerchantsLoaded(): Promise<void> {
  if (!loaded) await refreshUserCache();
}

// ─── Public lookup API ────────────────────────────────────────────────────

/** All merchants visible to the user (builtin ∪ user, user wins on id). */
export function listAllMerchants(): MerchantDefinition[] {
  const byId = new Map<string, MerchantDefinition>();
  for (const m of BUILTIN_MERCHANTS) byId.set(m.id, m);
  for (const m of userCache) byId.set(m.id, m);
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function getMerchant(id: string): MerchantDefinition | undefined {
  // User wins.
  const user = userCache.find((m) => m.id === id);
  return user ?? BUILTIN_BY_ID.get(id);
}

/** Case-insensitive search across name and aliases. Returns up to `limit`. */
export function searchMerchants(query: string, limit = 50): MerchantDefinition[] {
  const q = query.trim().toLowerCase();
  const all = listAllMerchants();
  if (!q) return all.slice(0, limit);
  const matches: { m: MerchantDefinition; score: number }[] = [];
  for (const m of all) {
    const haystacks = [m.name, ...(m.aliases ?? [])].map((s) => s.toLowerCase());
    let score = 0;
    for (const h of haystacks) {
      if (h === q) {
        score = Math.max(score, 100);
      } else if (h.startsWith(q)) {
        score = Math.max(score, 80);
      } else if (h.includes(q)) {
        score = Math.max(score, 40);
      }
    }
    if (score > 0) matches.push({ m, score });
  }
  matches.sort((a, b) => b.score - a.score || a.m.name.localeCompare(b.m.name));
  return matches.slice(0, limit).map((x) => x.m);
}

// ─── Mutations (user merchants only) ──────────────────────────────────────

export async function saveUserMerchant(m: MerchantDefinition): Promise<void> {
  const record: MerchantDefinition = { ...m, source: 'user' };
  await userMerchants.put(record);
  await refreshUserCache();
}

export async function deleteUserMerchant(id: string): Promise<void> {
  await userMerchants.delete(id);
  await refreshUserCache();
}

// ─── React hook ───────────────────────────────────────────────────────────

function subscribe(listener: () => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

function getSnapshot(): readonly MerchantDefinition[] {
  return userCache;
}

export function useMerchants(): MerchantDefinition[] {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    void ensureMerchantsLoaded();
  }, []);
  return listAllMerchants();
}
