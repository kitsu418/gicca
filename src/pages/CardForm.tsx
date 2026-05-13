// Shared form used by the Add and Edit pages. Pre-fills from `initial` when
// editing; on submit calls `onSubmit(values, secrets)` and lets the caller
// decide whether to create or update.

import { useEffect, useState } from 'react';
import { Button, Input } from '../components/ui';
import { MerchantPicker } from '../components/MerchantPicker';
import type { CardRecord, CardSecrets, MerchantDefinition } from '../core/types';
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
    });
  }, [initial, initialSecrets]);

  function update<K extends keyof CardFormValues>(key: K, val: CardFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!values.merchant) {
      setError('请先选择商户');
      return;
    }
    if (!values.cardNumber.trim()) {
      setError('请填写卡号');
      return;
    }
    setBusy(true);
    try {
      const secrets: CardSecrets = {
        cardNumber: values.cardNumber.trim(),
        ...(values.pin.trim() && { pin: values.pin.trim() }),
        ...(values.note.trim() && { note: values.note.trim() }),
        ...(values.merchant.cardFormat?.barcodeFormat && {
          barcode: {
            format: values.merchant.cardFormat.barcodeFormat,
            value: values.cardNumber.trim(),
          },
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
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  const merchantHints = values.merchant?.cardFormat;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-slate-200">商户</span>
        <MerchantPicker
          value={values.merchant}
          onChange={(m) =>
            setValues((v) => ({
              ...v,
              merchant: m,
              currency: v.currency || m.defaultCurrency || '',
            }))
          }
        />
      </div>

      <Input
        label="卡号"
        value={values.cardNumber}
        onChange={(e) => update('cardNumber', e.target.value)}
        autoComplete="off"
        spellCheck={false}
        hint={merchantHints?.cardNumberLength?.length
          ? `通常 ${merchantHints.cardNumberLength.join(' / ')} 位`
          : undefined}
      />

      {(merchantHints?.pinRequired !== false) && (
        <Input
          label={merchantHints?.pinRequired ? 'PIN' : 'PIN（可选）'}
          value={values.pin}
          onChange={(e) => update('pin', e.target.value)}
          autoComplete="off"
          spellCheck={false}
          hint={merchantHints?.pinLength?.length
            ? `通常 ${merchantHints.pinLength.join(' / ')} 位`
            : undefined}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="面值"
          inputMode="decimal"
          value={values.initialValue}
          onChange={(e) => update('initialValue', e.target.value)}
          placeholder="100"
        />
        <Input
          label="余额"
          inputMode="decimal"
          value={values.balance}
          onChange={(e) => update('balance', e.target.value)}
          placeholder="若空则等于面值"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="币种"
          value={values.currency}
          onChange={(e) => update('currency', e.target.value.toUpperCase())}
          maxLength={3}
          placeholder="USD / CNY"
        />
        <Input
          label="过期日期"
          type="date"
          value={values.expiresAt}
          onChange={(e) => update('expiresAt', e.target.value)}
        />
      </div>

      <label htmlFor="note" className="block space-y-1.5">
        <span className="block text-sm font-medium text-slate-200">备注</span>
        <textarea
          id="note"
          value={values.note}
          onChange={(e) => update('note', e.target.value)}
          rows={3}
          className="block w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          placeholder="使用条件、赠送人、关联订单号…"
        />
      </label>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? '保存中…' : submitLabel}
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
