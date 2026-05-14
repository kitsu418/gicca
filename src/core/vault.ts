// Vault — owns the in-memory CryptoKey and the setup / unlock flow.
//
// State machine:
//   loading  — opening DB, deciding which screen to show
//   setup    — no salt yet, user picks a fresh passphrase
//   locked   — salt + sentinel exist, user must enter passphrase
//   unlocked — key is in memory, app can read/write records
//
// The key is only ever held in memory: closing the tab forgets it.

import { decryptBytes, deriveKey, encryptBytes, randomSalt } from './crypto';
import { getDb } from './db';

type Status = 'loading' | 'setup' | 'locked' | 'unlocked';

// 32 bytes of zeros — a well-known plaintext we re-encrypt on every
// passphrase change so an unlock attempt can prove the key is right
// without the database touching any real card data.
const SENTINEL_PLAIN = new Uint8Array(32);

const listeners = new Set<() => void>();
let status: Status = 'loading';
let cachedKey: CryptoKey | null = null;
let detectInflight: Promise<void> | null = null;

export function getStatus(): Status {
  return status;
}

export function getKey(): CryptoKey {
  if (!cachedKey) throw new Error('Vault is locked');
  return cachedKey;
}

export function isUnlocked(): boolean {
  return cachedKey !== null;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function publish(next: Status) {
  status = next;
  for (const fn of listeners) fn();
}

// Called once on app start. Reads meta to decide whether to show setup
// (no salt yet) or unlock (salt + sentinel present).
export async function detectInitialState(): Promise<void> {
  if (detectInflight) return detectInflight;
  detectInflight = (async () => {
    const db = await getDb();
    const salt = await db.get('meta', 'vaultSalt');
    if (salt?.value) {
      publish('locked');
    } else {
      publish('setup');
    }
  })();
  return detectInflight;
}

// First-time setup: pick a passphrase, derive a key, store the salt and
// an encrypted sentinel so future unlocks can verify the passphrase.
export async function setupVault(passphrase: string): Promise<void> {
  if (!passphrase) throw new Error('Passphrase cannot be empty');
  const salt = randomSalt();
  const key = await deriveKey(passphrase, salt);
  const sentinel = await encryptBytes(key, SENTINEL_PLAIN);
  const db = await getDb();
  const tx = db.transaction('meta', 'readwrite');
  await tx.objectStore('meta').put({ key: 'vaultSalt', value: salt });
  await tx.objectStore('meta').put({ key: 'vaultSentinel', value: sentinel });
  await tx.done;
  cachedKey = key;
  publish('unlocked');
}

// Returns true on success, false on a wrong passphrase. Anything else
// (database error, browser crypto failure) bubbles up as a throw.
export async function unlockVault(passphrase: string): Promise<boolean> {
  const db = await getDb();
  const saltRow = await db.get('meta', 'vaultSalt');
  const sentinelRow = await db.get('meta', 'vaultSentinel');
  if (!saltRow?.value || !sentinelRow?.value) {
    throw new Error('Vault is not set up');
  }
  const salt = saltRow.value as Uint8Array;
  const sentinel = sentinelRow.value as Uint8Array;
  const key = await deriveKey(passphrase, salt);
  try {
    await decryptBytes(key, sentinel);
  } catch {
    return false;
  }
  cachedKey = key;
  publish('unlocked');
  return true;
}

export function lockVault(): void {
  cachedKey = null;
  publish('locked');
}

// Used by wipeAll / DangerZone — resets back to setup mode.
export function resetVaultState(): void {
  cachedKey = null;
  detectInflight = null;
  publish('setup');
}
