import { Link, useNavigate } from 'react-router-dom';
import { Button, Screen } from '../components/ui';
import { MerchantBadge } from '../components/MerchantBadge';
import { useCards } from '../core/cards';
import { lockSession } from '../core/vault/session';
import type { CardRecord } from '../core/types';

export default function CardList() {
  const cards = useCards();
  const navigate = useNavigate();

  return (
    <Screen>
      <div className="max-w-md mx-auto p-6 space-y-5">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Gicca</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/backup')} aria-label="Backup">
              Backup
            </Button>
            <Button variant="ghost" onClick={() => navigate('/settings')} aria-label="Settings">
              Settings
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                lockSession();
                navigate('/unlock');
              }}
              aria-label="Lock"
            >
              Lock
            </Button>
          </div>
        </header>

        {cards.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2">
            {cards.map((c) => (
              <li key={c.id}>
                <CardListItem card={c} />
              </li>
            ))}
          </ul>
        )}

        <Link
          to="/cards/new"
          className="fixed bottom-6 right-6 left-6 max-w-md mx-auto inline-flex items-center justify-center rounded-2xl bg-sky-500 hover:bg-sky-400 text-white px-4 py-3 font-medium shadow-lg shadow-sky-500/20"
        >
          + Add gift card
        </Link>
      </div>
    </Screen>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-12 text-center space-y-2">
      <p className="text-slate-300">No gift cards yet</p>
      <p className="text-sm text-slate-500">Tap the button below to add your first one</p>
    </div>
  );
}

function CardListItem({ card }: { card: CardRecord }) {
  return (
    <Link
      to={`/cards/${card.id}`}
      className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 px-3 py-3 transition"
    >
      <MerchantBadge merchant={card.merchantSnapshot} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium truncate">{card.merchantSnapshot.name}</span>
          {card.balance != null && (
            <span className="text-sm font-medium tabular-nums shrink-0">
              {formatMoney(card.balance, card.currency)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {card.status !== 'active' && <StatusPill status={card.status} />}
          {card.expiresAt && <ExpiryHint date={card.expiresAt} />}
        </div>
      </div>
    </Link>
  );
}

function StatusPill({ status }: { status: CardRecord['status'] }) {
  const labels: Record<CardRecord['status'], string> = {
    active: '',
    used_up: 'Used up',
    expired: 'Expired',
    lost: 'Lost',
    disabled: 'Disabled',
  };
  if (!labels[status]) return null;
  return (
    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-400">
      {labels[status]}
    </span>
  );
}

function ExpiryHint({ date }: { date: string }) {
  const ms = new Date(date).getTime() - Date.now();
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days < 0) {
    return <span className="text-rose-400">Expired {-days}d ago</span>;
  }
  if (days <= 30) {
    return <span className="text-amber-400">Expires in {days}d</span>;
  }
  return <span>Expires {new Date(date).toLocaleDateString()}</span>;
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
