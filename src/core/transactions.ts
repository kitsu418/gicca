// Per-card usage history — plaintext, no encryption.

import { cards as cardsStore, transactions as txStore } from './db';
import type { CardRecord, Transaction } from './types';

export type TxInput = {
  amount: number; // cents — negative spend, positive top-up
  date?: string;
};

export async function addTransaction(cardId: string, input: TxInput): Promise<Transaction> {
  const card = await cardsStore.get(cardId);
  if (!card) throw new Error(`card ${cardId} not found`);

  const now = new Date().toISOString();
  const tx: Transaction = {
    id: crypto.randomUUID(),
    cardId,
    date: input.date ?? now,
    amount: Math.round(input.amount),
    createdAt: now,
  };
  await txStore.put(tx);

  await cardsStore.put({
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
  const tx = await txStore.get(id);
  if (!tx) return;
  await txStore.delete(id);
  const card = await cardsStore.get(tx.cardId);
  if (!card) return;
  await cardsStore.put({
    ...card,
    balance: (card.balance ?? 0) - tx.amount,
    transactionIds: card.transactionIds.filter((tid) => tid !== id),
    updatedAt: new Date().toISOString(),
  });
}

export async function listTransactions(cardId: string): Promise<Transaction[]> {
  const rows = await txStore.byCard(cardId);
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return rows;
}
