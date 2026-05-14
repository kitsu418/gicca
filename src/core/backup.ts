// Encrypted backup export/import (.gicca file).
//
// Wire format (after the magic header line):
//   magic line: "gicca-backup v3\n"
//   salt:       16 bytes — Argon2id salt used to derive the file key
//   ciphertext: AES-GCM packed (IV || ct || tag) of the JSON payload
//
// The payload itself is plaintext JSON (cards, transactions, attachments,
// user merchants). On import we re-encrypt each record under the current
// device's vault key, so a backup is portable across vaults — the only
// thing you need to carry from the source device is the passphrase it
// was exported with.

import {
  decryptBytes,
  decryptJson,
  decryptPacked,
  deriveKey,
  encryptBytes,
  encryptJson,
  encryptPacked,
  randomSalt,
} from './crypto';
import {
  getDb,
  meta,
  rawAttachments,
  rawCards,
  rawMerchants,
  rawTransactions,
  wipeAll,
} from './db';
import type { Attachment, CardRecord, MerchantDefinition, Transaction } from './types';
import { getKey } from './vault';

const MAGIC = 'gicca-backup v3';

type AttachmentMeta = Omit<Attachment, 'data'>;

type Payload = {
  exportedAt: string;
  cards: CardRecord[];
  transactions: Transaction[];
  // Attachment binary data is base64'd here so the payload stays a
  // single JSON string for export-side encryption.
  attachments: (AttachmentMeta & { dataB64: string })[];
  userMerchants: MerchantDefinition[];
};

function bytesToBase64(bytes: Uint8Array): string {
  // Chunked conversion — applying spread to a 1 MB photo blows the
  // String.fromCharCode argument stack.
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function readAllCards(): Promise<CardRecord[]> {
  const rows = await rawCards.list();
  return Promise.all(rows.map((r) => decryptJson<CardRecord>(getKey(), r.blob)));
}

async function readAllTransactions(): Promise<Transaction[]> {
  const rows = await rawTransactions.list();
  return Promise.all(rows.map((r) => decryptJson<Transaction>(getKey(), r.blob)));
}

async function readAllAttachments(): Promise<Attachment[]> {
  const rows = await rawAttachments.list();
  return Promise.all(
    rows.map(async (r) => {
      const { meta: m, data } = await decryptPacked<AttachmentMeta>(getKey(), r.blob);
      return { ...m, data } as Attachment;
    }),
  );
}

async function readAllUserMerchants(): Promise<MerchantDefinition[]> {
  const rows = await rawMerchants.list();
  return Promise.all(rows.map((r) => decryptJson<MerchantDefinition>(getKey(), r.blob)));
}

export async function exportBackup(passphrase: string): Promise<Blob> {
  if (!passphrase) throw new Error('Passphrase is required to export');

  const [cards, transactions, attachments, userMerchants] = await Promise.all([
    readAllCards(),
    readAllTransactions(),
    readAllAttachments(),
    readAllUserMerchants(),
  ]);

  const payload: Payload = {
    exportedAt: new Date().toISOString(),
    cards,
    transactions,
    attachments: attachments.map((a) => {
      const { data, ...m } = a;
      return { ...m, dataB64: bytesToBase64(data) };
    }),
    userMerchants,
  };

  const salt = randomSalt();
  const key = await deriveKey(passphrase, salt);
  const cipher = await encryptBytes(
    key,
    new TextEncoder().encode(JSON.stringify(payload)),
  );

  // [magic line]\n[salt 16 bytes][ciphertext]
  const header = new TextEncoder().encode(MAGIC + '\n');
  const out = new Uint8Array(header.length + salt.length + cipher.length);
  out.set(header, 0);
  out.set(salt, header.length);
  out.set(cipher, header.length + salt.length);
  return new Blob([out as BlobPart], { type: 'application/octet-stream' });
}

export function suggestedBackupFilename(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `gicca-backup-${stamp}.gicca`;
}

export async function downloadBackup(passphrase: string): Promise<void> {
  const blob = await exportBackup(passphrase);
  const filename = suggestedBackupFilename();

  const shareNav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (shareNav.canShare) {
    try {
      const file = new File([blob], filename, { type: 'application/octet-stream' });
      if (shareNav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        await meta.set('lastBackupAt', new Date().toISOString());
        return;
      }
    } catch {
      // Fall through to download.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  await meta.set('lastBackupAt', new Date().toISOString());
}

export type ImportSummary = {
  cards: number;
  transactions: number;
  attachments: number;
  userMerchants: number;
};

async function readEnvelope(file: File): Promise<{ salt: Uint8Array; cipher: Uint8Array }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const newline = bytes.indexOf(0x0a); // '\n'
  if (newline < 0) throw new Error('File does not look like a Gicca backup');
  const magic = new TextDecoder().decode(bytes.subarray(0, newline));
  if (magic !== MAGIC) throw new Error(`Unsupported backup file: ${magic}`);
  const rest = bytes.subarray(newline + 1);
  if (rest.length < 16 + 12 + 16) throw new Error('Backup file is truncated');
  return { salt: rest.subarray(0, 16), cipher: rest.subarray(16) };
}

export async function importBackupReplacing(
  file: File,
  passphrase: string,
): Promise<ImportSummary> {
  const { salt, cipher } = await readEnvelope(file);
  const fileKey = await deriveKey(passphrase, salt);
  let payload: Payload;
  try {
    const plain = await decryptBytes(fileKey, cipher);
    payload = JSON.parse(new TextDecoder().decode(plain)) as Payload;
  } catch {
    throw new Error('Wrong passphrase or corrupted backup file');
  }

  // Replace local data. We wipe everything except the vault rows in
  // meta (vaultSalt / vaultSentinel) — those belong to *this* device's
  // current vault, which is what we'll re-encrypt the imported records
  // under.
  await wipeAllExceptVault();

  const currentKey = getKey();
  for (const card of payload.cards) {
    await rawCards.put({ id: card.id, blob: await encryptJson(currentKey, card) });
  }
  for (const tx of payload.transactions) {
    await rawTransactions.put({ id: tx.id, blob: await encryptJson(currentKey, tx) });
  }
  for (const a of payload.attachments) {
    const data = base64ToBytes(a.dataB64);
    const { dataB64: _, ...rest } = a;
    const m: AttachmentMeta = rest;
    const blob = await encryptPacked(currentKey, m, data);
    await rawAttachments.put({ id: m.id, blob });
  }
  for (const m of payload.userMerchants) {
    await rawMerchants.put({ id: m.id, blob: await encryptJson(currentKey, m) });
  }

  return {
    cards: payload.cards.length,
    transactions: payload.transactions.length,
    attachments: payload.attachments.length,
    userMerchants: payload.userMerchants.length,
  };
}

async function wipeAllExceptVault(): Promise<void> {
  // wipeAll clears meta too. Preserve this device's vault rows so the
  // user doesn't have to re-enter the passphrase after an import.
  const db = await getDb();
  const [saltRow, sentinelRow] = await Promise.all([
    db.get('meta', 'vaultSalt'),
    db.get('meta', 'vaultSentinel'),
  ]);
  await wipeAll();
  if (saltRow) await db.put('meta', saltRow);
  if (sentinelRow) await db.put('meta', sentinelRow);
}
