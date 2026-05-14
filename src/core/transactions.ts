// Per-card usage history. Both transactions and the card's running
// balance live in encrypted rows; this layer encrypts on write and
// decrypts on read so callers stay record-shaped.

import { decryptJson, encryptJson } from './crypto';
import { rawCards, rawTransactions } from './db';
import type { CardRecord, Transaction } from './types';
import { getKey } from './vault';

export type TxInput = {
  amount: number; // cents — negative spend, positive top-up
  date?: string;
};

async function readCard(id: string): Promise<CardRecord | undefined> {
  const row = await rawCards.get(id);
  if (!row) return undefined;
  return decryptJson<CardRecord>(getKey(), row.blob);
}

async function writeCard(card: CardRecord): Promise<void> {
  await rawCards.put({ id: card.id, blob: await encryptJson(getKey(), card) });
}

async function readTx(id: string): Promise<Transaction | undefined> {
  const row = await rawTransactions.get(id);
  if (!row) return undefined;
  return decryptJson<Transaction>(getKey(), row.blob);
}

async function writeTx(tx: Transaction): Promise<void> {
  await rawTransactions.put({ id: tx.id, blob: await encryptJson(getKey(), tx) });
}

export async function addTransaction(cardId: string, input: TxInput): Promise<Transaction> {
  const card = await readCard(cardId);
  if (!card) throw new Error(`card ${cardId} not found`);

  const now = new Date().toISOString();
  const tx: Transaction = {
    id: crypto.randomUUID(),
    cardId,
    date: input.date ?? now,
    amount: Math.round(input.amount),
    createdAt: now,
  };
  await writeTx(tx);

  await writeCard({
    ...card,
    balance: (card.balance ?? 0) + tx.amount,
    transactionIds: [...card.transactionIds, tx.id],
    status: maybeAutoStatus(card, (card.balance ?? 0) + tx.amount),
    updatedAt: now,
  });

  return tx;
}

function maybeAutoStatus(card: CardRecord, nextBalance: number): CardRecord['status'] {
  if (card.status === 'active' && nextBalance <= 0) return 'used_up';
  if (card.status === 'used_up' && nextBalance > 0) return 'active';
  return card.status;
}

export async function deleteTransaction(id: string): Promise<void> {
  const tx = await readTx(id);
  if (!tx) return;
  await rawTransactions.delete(id);
  const card = await readCard(tx.cardId);
  if (!card) return;
  await writeCard({
    ...card,
    balance: (card.balance ?? 0) - tx.amount,
    transactionIds: card.transactionIds.filter((tid) => tid !== id),
    updatedAt: new Date().toISOString(),
  });
}

export async function listTransactions(cardId: string): Promise<Transaction[]> {
  const rows = await rawTransactions.list();
  const decoded = await Promise.all(
    rows.map((r) => decryptJson<Transaction>(getKey(), r.blob)),
  );
  const filtered = decoded.filter((t) => t.cardId === cardId);
  filtered.sort((a, b) => b.date.localeCompare(a.date));
  return filtered;
}
