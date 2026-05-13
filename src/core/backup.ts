// Plain JSON backup export/import (.gicca file).
//
// Now that there's no encryption, the file is a straight dump of every
// store: cards, transactions, attachments, user merchants, meta.
// Treat it like any other unencrypted sensitive file — store it
// somewhere only you can reach.

import { meta, getDb, wipeAll } from './db';
import type {
  Attachment,
  CardRecord,
  MerchantDefinition,
  Transaction,
} from './types';

const MAGIC = 'gicca';
const VERSION = 2;

type Payload = {
  cards: CardRecord[];
  transactions: Transaction[];
  attachments: Attachment[];
  userMerchants: MerchantDefinition[];
  meta: { key: string; value: unknown }[];
};

type BackupFile = {
  magic: string;
  version: number;
  exportedAt: string;
  payload: Payload;
};

// Binary fields (attachment.data) are encoded as { "$u8": "<base64>" } so
// the file stays grep-able and JSON-tooling-friendly.
function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) return { $u8: bytesToBase64(value) };
  return value;
}

function reviver(_key: string, value: unknown): unknown {
  if (
    value &&
    typeof value === 'object' &&
    '$u8' in value &&
    typeof (value as { $u8: unknown }).$u8 === 'string'
  ) {
    return base64ToBytes((value as { $u8: string }).$u8);
  }
  return value;
}

export async function exportBackup(): Promise<Blob> {
  const db = await getDb();
  const tx = db.transaction(
    ['cards', 'transactions', 'attachments', 'merchants', 'meta'],
    'readonly',
  );
  const [cards, transactions, attachments, userMerchants, metaRows] = await Promise.all([
    tx.objectStore('cards').getAll(),
    tx.objectStore('transactions').getAll(),
    tx.objectStore('attachments').getAll(),
    tx.objectStore('merchants').getAll(),
    tx.objectStore('meta').getAll(),
  ]);

  const file: BackupFile = {
    magic: MAGIC,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    payload: { cards, transactions, attachments, userMerchants, meta: metaRows },
  };
  const json = JSON.stringify(file, replacer);
  return new Blob([json], { type: 'application/json' });
}

export function suggestedBackupFilename(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `gicca-backup-${stamp}.gicca`;
}

export async function downloadBackup(): Promise<void> {
  const blob = await exportBackup();
  const filename = suggestedBackupFilename();

  const shareNav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (shareNav.canShare) {
    try {
      const file = new File([blob], filename, { type: 'application/json' });
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

export async function readBackup(file: File): Promise<BackupFile> {
  const text = await file.text();
  let parsed: BackupFile;
  try {
    parsed = JSON.parse(text, reviver) as BackupFile;
  } catch {
    throw new Error('File is not valid JSON');
  }
  if (parsed?.magic !== MAGIC) throw new Error('File does not look like a Gicca backup');
  if (parsed.version !== VERSION) {
    throw new Error(`Unsupported backup version: ${parsed.version}`);
  }
  return parsed;
}

export async function importBackupReplacing(file: File): Promise<ImportSummary> {
  const data = await readBackup(file);
  await wipeAll();

  const db = await getDb();
  const tx = db.transaction(
    ['cards', 'transactions', 'attachments', 'merchants', 'meta'],
    'readwrite',
  );

  for (const row of data.payload.cards) tx.objectStore('cards').put(row);
  for (const row of data.payload.transactions) tx.objectStore('transactions').put(row);
  for (const row of data.payload.attachments) tx.objectStore('attachments').put(row);
  for (const row of data.payload.userMerchants) tx.objectStore('merchants').put(row);
  for (const row of data.payload.meta) tx.objectStore('meta').put(row);
  await tx.done;

  return {
    cards: data.payload.cards.length,
    transactions: data.payload.transactions.length,
    attachments: data.payload.attachments.length,
    userMerchants: data.payload.userMerchants.length,
  };
}
