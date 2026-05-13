// Per-card usage history.
//
// Each transaction carries a signed integer `amount` in minor units:
// negative = spend, positive = top-up. The amount stays plaintext so the
// total deduction can be summarised without decrypting anything; the
// optional note is encrypted with the session DEK because it may carry
// merchant/order details the user thought of as private.

import { cards as cardsStore, transactions as txStore } from './db';
import { requireDek } from './vault/session';
import { aesGcmDecrypt, aesGcmEncrypt } from './vault/crypto';
import type { CardRecord, EncryptedEnvelope, Transaction } from './types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function encryptNote(note: string): Promise<EncryptedEnvelope> {
  return aesGcmEncrypt(requireDek(), encoder.encode(note));
}

async function decryptNote(env: EncryptedEnvelope): Promise<string> {
  return decoder.decode(await aesGcmDecrypt(requireDek(), env));
}

export type TxInput = {
  amount: number; // cents — negative spend, positive top-up
  date?: string; // ISO; defaults to now
  location?: string;
  note?: string;
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
    location: input.location || undefined,
    encrypted: input.note ? await encryptNote(input.note) : undefined,
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
    balance: (card.balance ?? 0) - tx.amount, // reverse the effect
    transactionIds: card.transactionIds.filter((tid) => tid !== id),
    updatedAt: new Date().toISOString(),
  });
}

export type ResolvedTransaction = Transaction & { decryptedNote?: string };

export async function listTransactions(cardId: string): Promise<ResolvedTransaction[]> {
  const rows = await txStore.byCard(cardId);
  rows.sort((a, b) => b.date.localeCompare(a.date));
  const resolved: ResolvedTransaction[] = [];
  for (const t of rows) {
    let decryptedNote: string | undefined;
    if (t.encrypted) {
      try {
        decryptedNote = await decryptNote(t.encrypted);
      } catch {
        decryptedNote = undefined;
      }
    }
    resolved.push({ ...t, decryptedNote });
  }
  return resolved;
}
