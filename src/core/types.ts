// Domain types for Gicca.
//
// IndexedDB layout (see db.ts):
//   cards         — full card records (sensitive fields under `encrypted`)
//   merchants     — user-defined merchants (builtins ship as JSON, see merchants/)
//   attachments   — encrypted blobs (photos, screenshots)
//   transactions  — usage history rows (amounts plaintext, notes encrypted)
//   vault         — wrapped DEKs (password / biometric / recovery)
//   meta          — key-value app state

export type CardStatus = 'active' | 'used_up' | 'expired' | 'lost' | 'disabled';
export type CardFormat = 'physical' | 'digital' | 'app';
export type CardSource = 'self' | 'gift' | 'promo' | 'refund' | 'other';

export type BarcodeFormat =
  | 'CODE128'
  | 'CODE39'
  | 'EAN13'
  | 'UPCA'
  | 'QR'
  | 'PDF417'
  | 'AZTEC'
  | 'DATAMATRIX';

export type MerchantCategory =
  | 'food'
  | 'retail'
  | 'entertainment'
  | 'transport'
  | 'service'
  | 'other';

// Sensitive payload — only exists in memory after decrypt.
export type CardSecrets = {
  cardNumber: string;
  pin?: string;
  activationCode?: string;
  barcode?: {
    format: BarcodeFormat;
    value: string; // often == cardNumber, but allowed to differ
  };
  note?: string;
};

// Envelope written to IndexedDB.
export type EncryptedEnvelope = {
  iv: Uint8Array; // 12 bytes (AES-GCM nonce)
  ciphertext: Uint8Array; // includes 16-byte GCM tag
};

export type MerchantSnapshot = {
  name: string;
  color?: string;
  logo?: string; // path or emoji
};

export type CardRecord = {
  id: string;
  merchantId: string;
  merchantSnapshot: MerchantSnapshot;

  // Value (plaintext, in minor units e.g. cents)
  initialValue?: number;
  balance?: number;
  purchasePrice?: number;
  currency?: string; // ISO 4217

  // Dates (ISO strings)
  acquiredAt?: string;
  activatedAt?: string;
  expiresAt?: string;

  // Classification
  status: CardStatus;
  format?: CardFormat;
  source?: CardSource;
  giverName?: string;
  orderRef?: string;
  region?: string;

  // Encrypted sensitive payload (CardSecrets after decrypt)
  encrypted: EncryptedEnvelope;

  attachmentIds: string[];
  transactionIds: string[];

  // Lifecycle
  createdAt: string;
  updatedAt: string;
  deletedAt?: string; // soft delete for sync
};

export type Transaction = {
  id: string;
  cardId: string;
  date: string; // ISO
  amount: number; // negative = spend, positive = top-up
  location?: string; // plaintext
  encrypted?: EncryptedEnvelope; // optional encrypted note
  createdAt: string;
};

export type AttachmentKind =
  | 'card_front'
  | 'card_back'
  | 'receipt'
  | 'screenshot'
  | 'logo'
  | 'other';

export type Attachment = {
  id: string;
  cardId: string;
  kind: AttachmentKind;
  mimeType: string;
  width?: number;
  height?: number;
  // AES-GCM-encrypted bytes of the (already compressed) image
  encrypted: EncryptedEnvelope;
  createdAt: string;
};

export type MerchantDefinition = {
  id: string; // stable identifier, e.g. 'starbucks'
  name: string;
  aliases?: string[];
  logo?: string;
  color?: string;
  category: MerchantCategory;
  region?: string[];
  defaultCurrency?: string;
  cardFormat?: {
    cardNumberPattern?: string;
    cardNumberLength?: number[];
    pinRequired?: boolean;
    pinLength?: number[];
    barcodeFormat?: BarcodeFormat;
    barcodeFromCardNumber?: 'direct' | 'card_pin' | 'custom';
  };
  balanceCheckUrl?: string;
  customerServicePhone?: string;
  version: number;
  source: 'builtin' | 'user';
};

// Wraps over the Data Encryption Key (DEK).
export type WrapKind = 'password' | 'biometric' | 'recovery';

export type VaultWrap = {
  id: string; // 'password' | `biometric:${credentialId}` | 'recovery'
  kind: WrapKind;
  label?: string; // e.g. "iPhone Face ID"
  // Password / recovery: PBKDF2 params
  salt?: Uint8Array;
  iterations?: number;
  // Biometric: WebAuthn metadata
  credentialId?: Uint8Array;
  prfSalt?: Uint8Array;
  // Common envelope
  iv: Uint8Array;
  wrappedDek: Uint8Array; // AES-GCM(wrapKey, DEK)
  createdAt: string;
};

export type MetaRecord = {
  key: string;
  value: unknown;
};

// Type-safe meta keys.
export type MetaKeys = {
  schemaVersion: number;
  hasSetup: boolean;
  recoveryAcknowledged: boolean;
  dictVersion: number;
  lastBackupAt: string;
  autoLockMs: number;
  preferredCurrency: string;
};
