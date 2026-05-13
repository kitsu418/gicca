// Cards service.
//
// Hides the split between plaintext metadata (always readable) and the
// encrypted secrets envelope (decryptable only with the unlocked DEK).
// Components shouldn't need to touch CardRecord.encrypted directly.

import { useEffect, useSyncExternalStore } from 'react';
import { cards as cardsStore } from './db';
import type { CardRecord, CardSecrets, MerchantDefinition } from './types';
import { decryptCardSecrets, encryptCardSecrets } from './vault/vault';
import { requireDek } from './vault/session';

// ─── In-memory cache + pub/sub ────────────────────────────────────────────

let cache: CardRecord[] = [];
let loaded = false;
const subscribers = new Set<() => void>();

function notify() {
  for (const fn of subscribers) fn();
}

async function refresh(): Promise<void> {
  cache = await cardsStore.list();
  cache.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  loaded = true;
  notify();
}

export async function ensureCardsLoaded(): Promise<void> {
  if (!loaded) await refresh();
}

// ─── Public API ───────────────────────────────────────────────────────────

export function listCardsSync(): readonly CardRecord[] {
  return cache;
}

export async function getCard(id: string): Promise<CardRecord | undefined> {
  return cardsStore.get(id);
}

export async function getCardSecrets(card: CardRecord): Promise<CardSecrets> {
  return decryptCardSecrets(requireDek(), card.encrypted);
}

export type CardInput = {
  merchant: MerchantDefinition;
  secrets: CardSecrets;
  initialValue?: number;
  balance?: number;
  purchasePrice?: number;
  currency?: string;
  acquiredAt?: string;
  activatedAt?: string;
  expiresAt?: string;
  status?: CardRecord['status'];
  format?: CardRecord['format'];
  source?: CardRecord['source'];
  giverName?: string;
  orderRef?: string;
  region?: string;
};

export async function createCard(input: CardInput): Promise<CardRecord> {
  const now = new Date().toISOString();
  const encrypted = await encryptCardSecrets(requireDek(), input.secrets);
  const record: CardRecord = {
    id: crypto.randomUUID(),
    merchantId: input.merchant.id,
    merchantSnapshot: {
      name: input.merchant.name,
      color: input.merchant.color,
      logo: input.merchant.logo,
    },
    initialValue: input.initialValue,
    balance: input.balance,
    purchasePrice: input.purchasePrice,
    currency: input.currency ?? input.merchant.defaultCurrency,
    acquiredAt: input.acquiredAt,
    activatedAt: input.activatedAt,
    expiresAt: input.expiresAt,
    status: input.status ?? 'active',
    format: input.format,
    source: input.source,
    giverName: input.giverName,
    orderRef: input.orderRef,
    region: input.region,
    encrypted,
    attachmentIds: [],
    transactionIds: [],
    createdAt: now,
    updatedAt: now,
  };
  await cardsStore.put(record);
  await refresh();
  return record;
}

export async function updateCard(
  id: string,
  patch: Partial<CardInput> & { secrets?: CardSecrets; merchant?: MerchantDefinition },
): Promise<CardRecord> {
  const existing = await cardsStore.get(id);
  if (!existing) throw new Error(`card ${id} not found`);

  const encrypted = patch.secrets
    ? await encryptCardSecrets(requireDek(), patch.secrets)
    : existing.encrypted;

  const next: CardRecord = {
    ...existing,
    ...(patch.merchant && {
      merchantId: patch.merchant.id,
      merchantSnapshot: {
        name: patch.merchant.name,
        color: patch.merchant.color,
        logo: patch.merchant.logo,
      },
    }),
    initialValue: patch.initialValue ?? existing.initialValue,
    balance: patch.balance ?? existing.balance,
    purchasePrice: patch.purchasePrice ?? existing.purchasePrice,
    currency: patch.currency ?? existing.currency,
    acquiredAt: patch.acquiredAt ?? existing.acquiredAt,
    activatedAt: patch.activatedAt ?? existing.activatedAt,
    expiresAt: patch.expiresAt ?? existing.expiresAt,
    status: patch.status ?? existing.status,
    format: patch.format ?? existing.format,
    source: patch.source ?? existing.source,
    giverName: patch.giverName ?? existing.giverName,
    orderRef: patch.orderRef ?? existing.orderRef,
    region: patch.region ?? existing.region,
    encrypted,
    updatedAt: new Date().toISOString(),
  };
  await cardsStore.put(next);
  await refresh();
  return next;
}

export async function deleteCard(id: string): Promise<void> {
  // Soft delete preserves the row for sync; hard delete is a separate option
  // in settings.
  await cardsStore.softDelete(id);
  await refresh();
}

// ─── React hook ───────────────────────────────────────────────────────────

function subscribe(listener: () => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

function getSnapshot(): readonly CardRecord[] {
  return cache;
}

export function useCards(): readonly CardRecord[] {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    void ensureCardsLoaded();
  }, []);
  return snap;
}
