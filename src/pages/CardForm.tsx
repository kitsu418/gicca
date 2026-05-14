// Shared form used by Add and Edit. Pre-fills from `initial` when editing;
// submits go through `onSubmit`.

import { useEffect, useState } from 'react';
import { Button, Input } from '../components/ui';
import { MerchantPicker } from '../components/MerchantPicker';
import { BarcodeScanner } from '../components/BarcodeScanner';
import type { CardRecord, CodeKind, MerchantDefinition } from '../core/types';
import { getMerchant } from '../core/merchants';

export type CardFormValues = {
  merchant: MerchantDefinition | null;
  cardNumber: string;
  pin: string;
  note: string;
  initialValue: string;
  balance: string;
  currency: string;
  expiresAt: string;
  barcode: string;
  qrcode: string;
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
  barcode: '',
  qrcode: '',
};

export type SubmittedCard = {
  merchant: MerchantDefinition;
  cardNumber: string;
  pin?: string;
  note?: string;
  barcode?: string;
  qrcode?: string;
  initialValue?: number;
  balance?: number;
  currency?: string;
  expiresAt?: string;
};

type Props = {
  initial?: CardRecord;
  submitLabel: string;
  onSubmit: (values: SubmittedCard) => Promise<void>;
  prefill?: Partial<CardFormValues>;
};

export function CardForm({ initial, submitLabel, onSubmit, prefill }: Props) {
  const [values, setValues] = useState<CardFormValues>(empty);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanTarget, setScanTarget] = useState<CodeKind | null>(null);

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
      cardNumber: initial.cardNumber,
      pin: initial.pin ?? '',
      note: initial.note ?? '',
      initialValue: initial.initialValue != null ? (initial.initialValue / 100).toString() : '',
      balance: initial.balance != null ? (initial.balance / 100).toString() : '',
      currency: initial.currency ?? '',
      expiresAt: isoToExpiry(initial.expiresAt),
      barcode: initial.barcode ?? '',
      qrcode: initial.qrcode ?? '',
    });
  }, [initial]);

  useEffect(() => {
    if (!prefill) return;
    setValues((v) => ({ ...v, ...prefill }));
  }, [prefill]);

  function update<K extends keyof CardFormValues>(key: K, val: CardFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  function pickMerchant(m: MerchantDefinition) {
    setValues((v) => ({
      ...v,
      merchant: m,
      currency: v.currency || m.defaultCurrency || '',
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
    const trimmedExpiry = values.expiresAt.trim();
    const expiresIso = trimmedExpiry ? expiryToIso(trimmedExpiry) : undefined;
    if (trimmedExpiry && !expiresIso) {
      setError('Expires must be MM/YYYY');
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        merchant: values.merchant,
        cardNumber: values.cardNumber.trim(),
        pin: values.pin.trim() || undefined,
        note: values.note.trim() || undefined,
        barcode: values.barcode.trim() || undefined,
        qrcode: values.qrcode.trim() || undefined,
        initialValue: parseMoney(values.initialValue),
        balance: parseMoney(values.balance),
        currency: values.currency.trim() || values.merchant.defaultCurrency || undefined,
        expiresAt: expiresIso,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  const merchantHints = values.merchant?.cardFormat;

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

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <h3 className="text-sm font-medium text-slate-200">Codes</h3>
        <CodeField
          label="Barcode (1D)"
          value={values.barcode}
          onChange={(v) => update('barcode', v)}
          onScan={() => setScanTarget('barcode')}
          suggested={merchantHints?.codeType === 'barcode'}
        />
        <CodeField
          label="QR code"
          value={values.qrcode}
          onChange={(v) => update('qrcode', v)}
          onScan={() => setScanTarget('qrcode')}
          suggested={merchantHints?.codeType === 'qrcode'}
        />
      </div>

      {scanTarget && (
        <BarcodeScanner
          onDetected={(value) => {
            // Anything scanned goes into whichever field opened the scanner;
            // detected kind is informational only — the user picked the slot.
            update(scanTarget, value);
            setScanTarget(null);
          }}
          onClose={() => setScanTarget(null)}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Currency"
          value={values.currency}
          onChange={(e) => update('currency', e.target.value.toUpperCase())}
          maxLength={3}
          placeholder="USD"
        />
        <Input
          label="Expires"
          inputMode="numeric"
          value={values.expiresAt}
          onChange={(e) => update('expiresAt', formatExpiryInput(e.target.value))}
          placeholder="MM/YYYY"
          maxLength={7}
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

function CodeField({
  label,
  value,
  onChange,
  onScan,
  suggested,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onScan: () => void;
  suggested?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-slate-400">{label}</span>
        {suggested && (
          <span className="text-[10px] text-sky-400 uppercase tracking-wide">
            suggested
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="Type or scan"
          className="flex-1 min-w-0 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        />
        <Button type="button" variant="secondary" onClick={onScan}>
          Scan
        </Button>
      </div>
    </div>
  );
}

function parseMoney(s: string): number | undefined {
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n * 100);
}

// Strip everything but digits and auto-insert "/" after MM so the field
// reads MM/YYYY as the user types — iOS's native date input is too wide
// for the form grid on narrow phones, and a controlled text input also
// gives us the format validation the user asked for.
function formatExpiryInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function expiryToIso(s: string): string | undefined {
  const m = s.match(/^(\d{2})\/(\d{4})$/);
  if (!m) return undefined;
  const mm = Number(m[1]);
  const yyyy = Number(m[2]);
  if (mm < 1 || mm > 12) return undefined;
  // Settle on the last day of the month so an "Expires 05/2026" card is
  // considered valid through May 31.
  const lastDay = new Date(yyyy, mm, 0).getDate();
  return new Date(yyyy, mm - 1, lastDay).toISOString();
}

function isoToExpiry(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
