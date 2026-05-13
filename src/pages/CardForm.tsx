// Shared form used by the Add and Edit pages. Pre-fills from `initial` when
// editing; on submit calls `onSubmit(values, secrets)` and lets the caller
// decide whether to create or update.

import { useEffect, useState } from 'react';
import { Button, Input } from '../components/ui';
import { MerchantPicker } from '../components/MerchantPicker';
import type {
  BarcodeFormat,
  CardRecord,
  CardSecrets,
  MerchantDefinition,
} from '../core/types';
import { getMerchant } from '../core/merchants';

type BarcodeChoice = '' | BarcodeFormat;

const BARCODE_OPTIONS: { value: BarcodeChoice; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'CODE128', label: 'Code 128' },
  { value: 'CODE39', label: 'Code 39' },
  { value: 'EAN13', label: 'EAN-13' },
  { value: 'UPCA', label: 'UPC-A' },
  { value: 'QR', label: 'QR Code' },
  { value: 'PDF417', label: 'PDF417' },
  { value: 'AZTEC', label: 'Aztec' },
  { value: 'DATAMATRIX', label: 'Data Matrix' },
];

export type CardFormValues = {
  merchant: MerchantDefinition | null;
  cardNumber: string;
  pin: string;
  note: string;
  initialValue: string;
  balance: string;
  currency: string;
  expiresAt: string;
  barcodeFormat: BarcodeChoice;
  barcodeValue: string;
};

const empty: CardFormValues = {
  merchant: null,
  cardNumber: '',
  pin: '',
  note: '',
  initialValue: '',
  balance: '',
  currency: '',
  expiresAt: '',
  barcodeFormat: '',
  barcodeValue: '',
};

type Props = {
  initial?: CardRecord;
  initialSecrets?: CardSecrets;
  submitLabel: string;
  onSubmit: (values: SubmittedCard) => Promise<void>;
};

export type SubmittedCard = {
  merchant: MerchantDefinition;
  secrets: CardSecrets;
  initialValue?: number;
  balance?: number;
  currency?: string;
  expiresAt?: string;
};

export function CardForm({ initial, initialSecrets, submitLabel, onSubmit }: Props) {
  const [values, setValues] = useState<CardFormValues>(empty);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Track whether the user has touched the barcode controls manually. If they
  // haven't, swapping merchants should refresh the suggested format.
  const [barcodeTouched, setBarcodeTouched] = useState(false);

  useEffect(() => {
    if (!initial) return;
    const merchant = getMerchant(initial.merchantId) ?? {
      id: initial.merchantId,
      name: initial.merchantSnapshot.name,
      color: initial.merchantSnapshot.color,
      category: 'other' as const,
      version: 1,
      source: 'user' as const,
    };
    setValues({
      merchant,
      cardNumber: initialSecrets?.cardNumber ?? '',
      pin: initialSecrets?.pin ?? '',
      note: initialSecrets?.note ?? '',
      initialValue: initial.initialValue != null ? (initial.initialValue / 100).toString() : '',
      balance: initial.balance != null ? (initial.balance / 100).toString() : '',
      currency: initial.currency ?? '',
      expiresAt: initial.expiresAt?.slice(0, 10) ?? '',
      barcodeFormat: initialSecrets?.barcode?.format ?? '',
      barcodeValue:
        initialSecrets?.barcode && initialSecrets.barcode.value !== initialSecrets.cardNumber
          ? initialSecrets.barcode.value
          : '',
    });
    setBarcodeTouched(true);
  }, [initial, initialSecrets]);

  function update<K extends keyof CardFormValues>(key: K, val: CardFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  function pickMerchant(m: MerchantDefinition) {
    setValues((v) => ({
      ...v,
      merchant: m,
      currency: v.currency || m.defaultCurrency || '',
      barcodeFormat: barcodeTouched ? v.barcodeFormat : (m.cardFormat?.barcodeFormat ?? ''),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!values.merchant) {
      setError('Pick a merchant');
      return;
    }
    if (!values.cardNumber.trim()) {
      setError('Card number is required');
      return;
    }
    setBusy(true);
    try {
      const cardNumber = values.cardNumber.trim();
      const barcodeValue = values.barcodeValue.trim() || cardNumber;
      const secrets: CardSecrets = {
        cardNumber,
        ...(values.pin.trim() && { pin: values.pin.trim() }),
        ...(values.note.trim() && { note: values.note.trim() }),
        ...(values.barcodeFormat && {
          barcode: { format: values.barcodeFormat, value: barcodeValue },
        }),
      };
      await onSubmit({
        merchant: values.merchant,
        secrets,
        initialValue: parseMoney(values.initialValue),
        balance: parseMoney(values.balance),
        currency: values.currency.trim() || values.merchant.defaultCurrency || undefined,
        expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  const merchantHints = values.merchant?.cardFormat;
  const merchantSuggestsBarcode = Boolean(merchantHints?.barcodeFormat);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-slate-200">Merchant</span>
        <MerchantPicker value={values.merchant} onChange={pickMerchant} />
      </div>

      <Input
        label="Card number"
        value={values.cardNumber}
        onChange={(e) => update('cardNumber', e.target.value)}
        autoComplete="off"
        spellCheck={false}
        hint={
          merchantHints?.cardNumberLength?.length
            ? `Typically ${merchantHints.cardNumberLength.join(' / ')} characters`
            : undefined
        }
      />

      {(merchantHints?.pinRequired !== false || values.pin) && (
        <Input
          label={merchantHints?.pinRequired ? 'PIN' : 'PIN (optional)'}
          value={values.pin}
          onChange={(e) => update('pin', e.target.value)}
          autoComplete="off"
          spellCheck={false}
          hint={
            merchantHints?.pinLength?.length
              ? `Typically ${merchantHints.pinLength.join(' / ')} digits`
              : undefined
          }
        />
      )}

      <fieldset className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <legend className="px-2 text-sm font-medium text-slate-200">Barcode</legend>
        <label className="block space-y-1.5">
          <span className="block text-xs text-slate-400">
            Format
            {merchantSuggestsBarcode && !barcodeTouched && (
              <span className="ml-2 text-slate-500">
                (suggested by {values.merchant?.name})
              </span>
            )}
          </span>
          <select
            value={values.barcodeFormat}
            onChange={(e) => {
              update('barcodeFormat', e.target.value as BarcodeChoice);
              setBarcodeTouched(true);
            }}
            className="block w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          >
            {BARCODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {values.barcodeFormat && (
          <Input
            label="Barcode value"
            value={values.barcodeValue}
            onChange={(e) => {
              update('barcodeValue', e.target.value);
              setBarcodeTouched(true);
            }}
            autoComplete="off"
            spellCheck={false}
            placeholder="Leave blank to use the card number"
            hint="Some cards have a separate scannable code printed on the back."
          />
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Face value"
          inputMode="decimal"
          value={values.initialValue}
          onChange={(e) => update('initialValue', e.target.value)}
          placeholder="100"
        />
        <Input
          label="Balance"
          inputMode="decimal"
          value={values.balance}
          onChange={(e) => update('balance', e.target.value)}
          placeholder="Defaults to face value"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Currency"
          value={values.currency}
          onChange={(e) => update('currency', e.target.value.toUpperCase())}
          maxLength={3}
          placeholder="USD"
        />
        <Input
          label="Expires"
          type="date"
          value={values.expiresAt}
          onChange={(e) => update('expiresAt', e.target.value)}
        />
      </div>

      <label htmlFor="note" className="block space-y-1.5">
        <span className="block text-sm font-medium text-slate-200">Notes</span>
        <textarea
          id="note"
          value={values.note}
          onChange={(e) => update('note', e.target.value)}
          rows={3}
          className="block w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          placeholder="Restrictions, gift from, order reference…"
        />
      </label>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}

function parseMoney(s: string): number | undefined {
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n * 100);
}
