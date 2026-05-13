// Domain types for Gicca.
//
// IndexedDB layout (see db.ts):
//   cards         — full card records, flat plaintext fields
//   merchants     — user-defined merchants (builtins ship as JSON)
//   attachments   — image blobs
//   transactions  — usage history rows
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

export type MerchantSnapshot = {
  name: string;
  color?: string;
  logo?: string;
};

export type CardRecord = {
  id: string;
  merchantId: string;
  merchantSnapshot: MerchantSnapshot;

  // Card identifiers
  cardNumber: string;
  pin?: string;
  activationCode?: string;
  barcode?: { format: BarcodeFormat; value: string };
  note?: string;

  // Value (in minor units, e.g. cents)
  initialValue?: number;
  balance?: number;
  purchasePrice?: number;
  currency?: string;

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
  location?: string;
  note?: string;
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
  data: Uint8Array; // raw compressed image bytes
  createdAt: string;
};

export type MerchantDefinition = {
  id: string;
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

export type MetaKeys = {
  schemaVersion: number;
  lastBackupAt: string;
  preferredCurrency: string;
};
