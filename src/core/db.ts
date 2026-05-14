import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  Attachment,
  CardRecord,
  MerchantDefinition,
  MetaKeys,
  Transaction,
} from './types';

const DB_NAME = 'gicca';
// v3 splits the previous `barcode: {format, value}` envelope into separate
// `barcode?` and `qrcode?` string fields. The upgrade callback migrates
// existing v2 cards in place.
const DB_VERSION = 3;

interface GiccaSchema extends DBSchema {
  cards: {
    key: string;
    value: CardRecord;
    indexes: {
      byMerchant: string;
      byStatus: string;
      byUpdatedAt: string;
      byExpiresAt: string;
    };
  };
  merchants: {
    key: string;
    value: MerchantDefinition;
  };
  attachments: {
    key: string;
    value: Attachment;
    indexes: { byCard: string };
  };
  transactions: {
    key: string;
    value: Transaction;
    indexes: { byCard: string; byDate: string };
  };
  meta: {
    key: string;
    value: { key: string; value: unknown };
  };
}

let dbPromise: Promise<IDBPDatabase<GiccaSchema>> | null = null;

export function getDb(): Promise<IDBPDatabase<GiccaSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<GiccaSchema>(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, transaction) {
        // v0 → v1 → v2 history is irrelevant here. v1 records were
        // AES-GCM ciphertext (vault era); v2 dropped the encryption
        // layer and wiped the data. Any vault from that era should
        // already have been cleared on the previous app load.

        // Fresh install path: just create the v3 schema.
        if (oldVersion < 2) {
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

          const cards = db.createObjectStore('cards', { keyPath: 'id' });
          cards.createIndex('byMerchant', 'merchantId');
          cards.createIndex('byStatus', 'status');
          cards.createIndex('byUpdatedAt', 'updatedAt');
          cards.createIndex('byExpiresAt', 'expiresAt');

          db.createObjectStore('merchants', { keyPath: 'id' });

          const attachments = db.createObjectStore('attachments', { keyPath: 'id' });
          attachments.createIndex('byCard', 'cardId');

          const transactions = db.createObjectStore('transactions', { keyPath: 'id' });
          transactions.createIndex('byCard', 'cardId');
          transactions.createIndex('byDate', 'date');

          db.createObjectStore('meta', { keyPath: 'key' });
          return;
        }

        // v2 → v3: split barcode envelope into separate barcode/qrcode strings.
        if (oldVersion < 3) {
          const cardsStore = transaction.objectStore('cards');
          let cursor = await cardsStore.openCursor();
          while (cursor) {
            const card = cursor.value as CardRecord & {
              barcode?: unknown;
            };
            const legacy = card.barcode as
              | { format?: string; value?: string }
              | string
              | undefined;
            if (legacy && typeof legacy === 'object' && 'value' in legacy && legacy.value) {
              const fmt = (legacy.format ?? '').toUpperCase();
              const isQr = fmt === 'QR' || fmt === 'AZTEC' || fmt === 'DATAMATRIX' || fmt === 'PDF417';
              const next: CardRecord = {
                ...card,
                barcode: isQr ? undefined : legacy.value,
                qrcode: isQr ? legacy.value : undefined,
              };
              await cursor.update(next);
            }
            cursor = await cursor.continue();
          }
        }
      },
    });
  }
  return dbPromise;
}

// ─── Cards ────────────────────────────────────────────────────────────────

export const cards = {
  async get(id: string): Promise<CardRecord | undefined> {
    return (await getDb()).get('cards', id);
  },
  async list(opts: { includeDeleted?: boolean } = {}): Promise<CardRecord[]> {
    const all = await (await getDb()).getAll('cards');
    return opts.includeDeleted ? all : all.filter((c) => !c.deletedAt);
  },
  async put(card: CardRecord): Promise<void> {
    await (await getDb()).put('cards', card);
  },
  async delete(id: string): Promise<void> {
    await (await getDb()).delete('cards', id);
  },
  async softDelete(id: string): Promise<void> {
    const db = await getDb();
    const existing = await db.get('cards', id);
    if (!existing) return;
    await db.put('cards', {
      ...existing,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },
};

// ─── User merchants ───────────────────────────────────────────────────────

export const userMerchants = {
  async get(id: string): Promise<MerchantDefinition | undefined> {
    return (await getDb()).get('merchants', id);
  },
  async list(): Promise<MerchantDefinition[]> {
    return (await getDb()).getAll('merchants');
  },
  async put(m: MerchantDefinition): Promise<void> {
    await (await getDb()).put('merchants', m);
  },
  async delete(id: string): Promise<void> {
    await (await getDb()).delete('merchants', id);
  },
};

// ─── Attachments ──────────────────────────────────────────────────────────

export const attachments = {
  async get(id: string): Promise<Attachment | undefined> {
    return (await getDb()).get('attachments', id);
  },
  async byCard(cardId: string): Promise<Attachment[]> {
    return (await getDb()).getAllFromIndex('attachments', 'byCard', cardId);
  },
  async put(a: Attachment): Promise<void> {
    await (await getDb()).put('attachments', a);
  },
  async delete(id: string): Promise<void> {
    await (await getDb()).delete('attachments', id);
  },
};

// ─── Transactions ─────────────────────────────────────────────────────────

export const transactions = {
  async get(id: string): Promise<Transaction | undefined> {
    return (await getDb()).get('transactions', id);
  },
  async byCard(cardId: string): Promise<Transaction[]> {
    return (await getDb()).getAllFromIndex('transactions', 'byCard', cardId);
  },
  async put(t: Transaction): Promise<void> {
    await (await getDb()).put('transactions', t);
  },
  async delete(id: string): Promise<void> {
    await (await getDb()).delete('transactions', id);
  },
};

// ─── Meta (typed key-value) ───────────────────────────────────────────────

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
