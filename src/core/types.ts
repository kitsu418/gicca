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

/**
 * The two user-facing code kinds. We've collapsed every 1D scannable
 * format into "barcode" (rendered as Code 128) and every 2D matrix
 * format into "qrcode" — see Barcode.tsx for the render mapping.
 */
export type CodeKind = 'barcode' | 'qrcode';

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
  /** 1D barcode payload (rendered as Code 128). */
  barcode?: string;
  /** QR code payload. */
  qrcode?: string;
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
  date: string;
  amount: number;
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
  data: Uint8Array;
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
    /** Which code kind this merchant's cards typically carry. */
    codeType?: CodeKind;
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
