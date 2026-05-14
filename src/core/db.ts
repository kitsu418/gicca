import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { MetaKeys } from './types';

const DB_NAME = 'gicca';
// v4 — every domain store now holds opaque { id, blob } rows; the
// service layer encrypts on write and decrypts on read. Pre-v4 stores
// kept full typed records with secondary indexes; we drop the index
// paths on upgrade because they no longer match the new shape.
const DB_VERSION = 4;

export type EncryptedRow = { id: string; blob: Uint8Array };

interface GiccaSchema extends DBSchema {
  cards: { key: string; value: EncryptedRow };
  merchants: { key: string; value: EncryptedRow };
  attachments: { key: string; value: EncryptedRow };
  transactions: { key: string; value: EncryptedRow };
  meta: { key: string; value: { key: string; value: unknown } };
}

let dbPromise: Promise<IDBPDatabase<GiccaSchema>> | null = null;

export function getDb(): Promise<IDBPDatabase<GiccaSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<GiccaSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Going to v4 wipes every domain store. Older records were
        // plaintext (and any pre-v2 ciphertext was already orphaned
        // when encryption was first removed); there's no reasonable
        // way to migrate them without the user's new passphrase, and
        // the user opting in to encryption has consented to that.
        for (const name of [
          'cards',
          'merchants',
          'attachments',
          'transactions',
          'vault',
          'meta',
        ] as const) {
          if (db.objectStoreNames.contains(name as never)) {
            db.deleteObjectStore(name as never);
          }
        }
        db.createObjectStore('cards', { keyPath: 'id' });
        db.createObjectStore('merchants', { keyPath: 'id' });
        db.createObjectStore('attachments', { keyPath: 'id' });
        db.createObjectStore('transactions', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'key' });
        void oldVersion; // silence linter — version-specific paths intentionally not branched
      },
    });
  }
  return dbPromise;
}

// ─── Raw encrypted-row access ────────────────────────────────────────────

export const rawCards = {
  async get(id: string): Promise<EncryptedRow | undefined> {
    return (await getDb()).get('cards', id);
  },
  async list(): Promise<EncryptedRow[]> {
    return (await getDb()).getAll('cards');
  },
  async put(row: EncryptedRow): Promise<void> {
    await (await getDb()).put('cards', row);
  },
  async delete(id: string): Promise<void> {
    await (await getDb()).delete('cards', id);
  },
};

export const rawMerchants = {
  async get(id: string): Promise<EncryptedRow | undefined> {
    return (await getDb()).get('merchants', id);
  },
  async list(): Promise<EncryptedRow[]> {
    return (await getDb()).getAll('merchants');
  },
  async put(row: EncryptedRow): Promise<void> {
    await (await getDb()).put('merchants', row);
  },
  async delete(id: string): Promise<void> {
    await (await getDb()).delete('merchants', id);
  },
};

export const rawAttachments = {
  async get(id: string): Promise<EncryptedRow | undefined> {
    return (await getDb()).get('attachments', id);
  },
  async list(): Promise<EncryptedRow[]> {
    return (await getDb()).getAll('attachments');
  },
  async put(row: EncryptedRow): Promise<void> {
    await (await getDb()).put('attachments', row);
  },
  async delete(id: string): Promise<void> {
    await (await getDb()).delete('attachments', id);
  },
};

export const rawTransactions = {
  async get(id: string): Promise<EncryptedRow | undefined> {
    return (await getDb()).get('transactions', id);
  },
  async list(): Promise<EncryptedRow[]> {
    return (await getDb()).getAll('transactions');
  },
  async put(row: EncryptedRow): Promise<void> {
    await (await getDb()).put('transactions', row);
  },
  async delete(id: string): Promise<void> {
    await (await getDb()).delete('transactions', id);
  },
};

// ─── Meta (typed key-value, plaintext) ───────────────────────────────────

export const meta = {
  async get<K extends keyof MetaKeys>(key: K): Promise<MetaKeys[K] | undefined> {
    const row = await (await getDb()).get('meta', key);
    return row?.value as MetaKeys[K] | undefined;
  },
  async set<K extends keyof MetaKeys>(key: K, value: MetaKeys[K]): Promise<void> {
    await (await getDb()).put('meta', { key, value });
  },
  async delete<K extends keyof MetaKeys>(key: K): Promise<void> {
    await (await getDb()).delete('meta', key);
  },
};

export async function wipeAll(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(
    ['cards', 'merchants', 'attachments', 'transactions', 'meta'],
    'readwrite',
  );
  await Promise.all([
    tx.objectStore('cards').clear(),
    tx.objectStore('merchants').clear(),
    tx.objectStore('attachments').clear(),
    tx.objectStore('transactions').clear(),
    tx.objectStore('meta').clear(),
  ]);
  await tx.done;
}
