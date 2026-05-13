// Encrypted backup export/import (.gicca file).
//
// A backup is a JSON file containing the entire IndexedDB snapshot — vault
// wraps included. Every card secret and attachment is already AES-GCM
// encrypted with the DEK; the DEK itself only exists as PBKDF2-/PRF-derived
// wraps inside the file. The user therefore needs the master password (or
// recovery code, or a re-registered biometric on the destination device) to
// decrypt anything after import.
//
// Format (v1):
//   {
//     magic: "gicca",
//     version: 1,
//     exportedAt: ISOString,
//     payload: {
//       vault: VaultWrap[],
//       cards: CardRecord[],
//       transactions: Transaction[],
//       attachments: Attachment[],
//       userMerchants: MerchantDefinition[],
//       meta: { key, value }[]
//     }
//   }
//
// Binary fields (Uint8Array) are encoded as `{"$u8": "<base64>"}` envelopes
// so a future jq-piping user can still understand the shape.

import { meta, getDb, wipeAll } from './db';
import {
  bytesToBase64,
  base64ToBytes,
} from './vault/crypto';

const MAGIC = 'gicca';
const VERSION = 1;

type Payload = {
  vault: unknown[];
  cards: unknown[];
  transactions: unknown[];
  attachments: unknown[];
  userMerchants: unknown[];
  meta: unknown[];
};

type BackupFile = {
  magic: string;
  version: number;
  exportedAt: string;
  payload: Payload;
};

// ─── Serialisation helpers ────────────────────────────────────────────────

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return { $u8: bytesToBase64(value) };
  }
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

// ─── Export ───────────────────────────────────────────────────────────────

export async function exportBackup(): Promise<Blob> {
  const db = await getDb();
  const tx = db.transaction(
    ['cards', 'transactions', 'attachments', 'merchants', 'vault', 'meta'],
    'readonly',
  );
  const [cards, transactions, attachments, userMerchants, vault, metaRows] = await Promise.all([
    tx.objectStore('cards').getAll(),
    tx.objectStore('transactions').getAll(),
    tx.objectStore('attachments').getAll(),
    tx.objectStore('merchants').getAll(),
    tx.objectStore('vault').getAll(),
    tx.objectStore('meta').getAll(),
  ]);

  const file: BackupFile = {
    magic: MAGIC,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    payload: {
      vault,
      cards,
      transactions,
      attachments,
      userMerchants,
      meta: metaRows,
    },
  };
  const json = JSON.stringify(file, replacer);
  return new Blob([json], { type: 'application/json' });
}

export function suggestedBackupFilename(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19); // 2026-05-12T15-30-00
  return `gicca-backup-${stamp}.gicca`;
}

/**
 * Triggers a download or share. iOS Safari surfaces the share sheet (so the
 * user can pick AirDrop / Mail / iMessage / etc.); desktop browsers fall back
 * to a regular download.
 */
export async function downloadBackup(): Promise<void> {
  const blob = await exportBackup();
  const filename = suggestedBackupFilename();

  // Prefer Web Share if it can handle files (iOS Safari, Android Chrome).
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

// ─── Import ───────────────────────────────────────────────────────────────

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

/**
 * Replaces all local state with the contents of `file`. Use only when the
 * user has explicitly accepted the wipe: existing cards, attachments, and
 * the local vault will all be overwritten.
 *
 * The imported vault wraps are preserved as-is, so unlocking after import
 * requires whatever credential (master password / recovery code / biometric
 * registered on the originating device) the source vault was set up with.
 */
export async function importBackupReplacing(file: File): Promise<ImportSummary> {
  const data = await readBackup(file);
  await wipeAll();

  const db = await getDb();
  const tx = db.transaction(
    ['cards', 'transactions', 'attachments', 'merchants', 'vault', 'meta'],
    'readwrite',
  );

  for (const row of data.payload.cards as never[]) tx.objectStore('cards').put(row);
  for (const row of data.payload.transactions as never[])
    tx.objectStore('transactions').put(row);
  for (const row of data.payload.attachments as never[])
    tx.objectStore('attachments').put(row);
  for (const row of data.payload.userMerchants as never[])
    tx.objectStore('merchants').put(row);
  for (const row of data.payload.vault as never[]) tx.objectStore('vault').put(row);
  for (const row of data.payload.meta as never[]) tx.objectStore('meta').put(row);
  await tx.done;

  // Make sure hasSetup is on so the router treats us as ready.
  await meta.set('hasSetup', true);

  return {
    cards: data.payload.cards.length,
    transactions: data.payload.transactions.length,
    attachments: data.payload.attachments.length,
    userMerchants: data.payload.userMerchants.length,
  };
}
