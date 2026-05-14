// Cards service — plaintext, no encryption layer.

import { useEffect, useSyncExternalStore } from 'react';
import { cards as cardsStore } from './db';
import type { CardRecord, MerchantDefinition } from './types';

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

export type CardInput = {
  merchant: MerchantDefinition;
  cardNumber: string;
  pin?: string;
  activationCode?: string;
  barcode?: string;
  qrcode?: string;
  note?: string;
  initialValue?: number;
  balance?: number;
  purchasePrice?: number;
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
  const record: CardRecord = {
    id: crypto.randomUUID(),
    merchantId: input.merchant.id,
    merchantSnapshot: {
      name: input.merchant.name,
      color: input.merchant.color,
    },
    cardNumber: input.cardNumber,
    pin: input.pin,
    activationCode: input.activationCode,
    barcode: input.barcode,
    qrcode: input.qrcode,
    note: input.note,
    initialValue: input.initialValue,
    balance: input.balance,
    purchasePrice: input.purchasePrice,
    acquiredAt: input.acquiredAt,
    activatedAt: input.activatedAt,
    expiresAt: input.expiresAt,
    status: input.status ?? 'active',
    format: input.format,
    source: input.source,
    giverName: input.giverName,
    orderRef: input.orderRef,
    region: input.region,
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
  patch: Partial<CardInput> & { merchant?: MerchantDefinition },
): Promise<CardRecord> {
  const existing = await cardsStore.get(id);
  if (!existing) throw new Error(`card ${id} not found`);

  const next: CardRecord = {
    ...existing,
    ...(patch.merchant && {
      merchantId: patch.merchant.id,
      merchantSnapshot: {
        name: patch.merchant.name,
        color: patch.merchant.color,
      },
    }),
    cardNumber: patch.cardNumber ?? existing.cardNumber,
    pin: patch.pin ?? existing.pin,
    activationCode: patch.activationCode ?? existing.activationCode,
    barcode: patch.barcode !== undefined ? patch.barcode || undefined : existing.barcode,
    qrcode: patch.qrcode !== undefined ? patch.qrcode || undefined : existing.qrcode,
    note: patch.note ?? existing.note,
    initialValue: patch.initialValue ?? existing.initialValue,
    balance: patch.balance ?? existing.balance,
    purchasePrice: patch.purchasePrice ?? existing.purchasePrice,
    acquiredAt: patch.acquiredAt ?? existing.acquiredAt,
    activatedAt: patch.activatedAt ?? existing.activatedAt,
    expiresAt: patch.expiresAt ?? existing.expiresAt,
    status: patch.status ?? existing.status,
    format: patch.format ?? existing.format,
    source: patch.source ?? existing.source,
    giverName: patch.giverName ?? existing.giverName,
    orderRef: patch.orderRef ?? existing.orderRef,
    region: patch.region ?? existing.region,
    updatedAt: new Date().toISOString(),
  };
  await cardsStore.put(next);
  await refresh();
  return next;
}

export async function deleteCard(id: string): Promise<void> {
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
