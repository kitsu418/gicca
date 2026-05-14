// Spend / top-up logger + history list shown on CardDetail.

import { useEffect, useState } from 'react';
import { Button, Input } from './ui';
import {
  addTransaction,
  deleteTransaction,
  listTransactions,
} from '../core/transactions';
import type { Transaction } from '../core/types';

type Props = {
  cardId: string;
  currency?: string;
  onAfterChange?: () => void;
};

type Mode = 'list' | 'spend' | 'topup';

export function TransactionsPanel({ cardId, currency, onAfterChange }: Props) {
  const [items, setItems] = useState<Transaction[]>([]);
  const [mode, setMode] = useState<Mode>('list');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setItems(await listTransactions(cardId));
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  function reset() {
    setAmount('');
    setNote('');
    setLocation('');
    setError(null);
    setMode('list');
  }

  async function submit() {
    setError(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a positive amount');
      return;
    }
    setBusy(true);
    try {
      const cents = Math.round(value * 100);
      await addTransaction(cardId, {
        amount: mode === 'spend' ? -cents : cents,
        note: note.trim() || undefined,
        location: location.trim() || undefined,
      });
      await refresh();
      onAfterChange?.();
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this entry? The balance will be rolled back.')) return;
    await deleteTransaction(id);
    await refresh();
    onAfterChange?.();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-200">Activity</span>
        {mode === 'list' && (
          <div className="flex gap-4 text-sm font-medium">
            <button
              type="button"
              onClick={() => setMode('spend')}
              className="text-rose-300 hover:text-rose-200"
            >
              − Spend
            </button>
            <button
              type="button"
              onClick={() => setMode('topup')}
              className="text-emerald-300 hover:text-emerald-200"
            >
              + Top-up
            </button>
          </div>
        )}
      </div>

      {mode !== 'list' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <Input
            label={mode === 'spend' ? 'Amount spent' : 'Amount added'}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={currency ? `Amount in ${currency}` : 'Amount'}
            autoFocus
          />
          <Input
            label="Location (optional)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Store, city…"
          />
          <Input
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What you bought"
          />
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset}>
              Cancel
            </Button>
            <Button className="flex-1" disabled={busy} onClick={submit}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        mode === 'list' && (
          <p className="text-xs text-slate-500">No activity yet</p>
        )
      ) : (
        <ul className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900/40">
          {items.map((t) => (
            <li key={t.id} className="px-3 py-2.5 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`tabular-nums font-medium ${
                      t.amount < 0 ? 'text-rose-300' : 'text-emerald-300'
                    }`}
                  >
                    {t.amount < 0 ? '−' : '+'}
                    {formatMoney(Math.abs(t.amount), currency)}
                  </span>
                  <span className="text-xs text-slate-500 shrink-0">
                    {new Date(t.date).toLocaleDateString()}
                  </span>
                </div>
                {(t.location || t.note) && (
                  <div className="text-xs text-slate-400 mt-0.5 truncate">
                    {[t.location, t.note].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDelete(t.id)}
                className="text-xs text-slate-500 hover:text-rose-400 shrink-0"
                title="Delete"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatMoney(cents: number, currency?: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: currency ? 'currency' : 'decimal',
      currency: currency || undefined,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return (cents / 100).toFixed(2);
  }
}
