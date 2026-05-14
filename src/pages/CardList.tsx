import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Screen } from '../components/ui';
import { MerchantCard } from '../components/MerchantCard';
import { BackupReminder } from '../components/BackupReminder';
import { useCards } from '../core/cards';
import type { CardRecord, CardStatus } from '../core/types';

type StatusFilter = 'all' | CardStatus;

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'used_up', label: 'Used up' },
  { value: 'expired', label: 'Expired' },
];

type Sort =
  | 'recently_updated'
  | 'recently_added'
  | 'balance_desc'
  | 'balance_asc'
  | 'expires_soonest'
  | 'name_az';

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: 'recently_updated', label: 'Recently updated' },
  { value: 'recently_added', label: 'Recently added' },
  { value: 'balance_desc', label: 'Balance: high → low' },
  { value: 'balance_asc', label: 'Balance: low → high' },
  { value: 'expires_soonest', label: 'Expires soonest' },
  { value: 'name_az', label: 'Merchant A → Z' },
];

export default function CardList() {
  const cards = useCards();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<Sort>('recently_updated');

  const visible = useMemo(
    () => applyFilters(cards, query, status, sort),
    [cards, query, status, sort],
  );

  return (
    <Screen>
      <div className="max-w-md mx-auto p-6 space-y-5 pb-24">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Gicca</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/backup')}>
              Backup
            </Button>
            <Button variant="ghost" onClick={() => navigate('/settings')}>
              Settings
            </Button>
          </div>
        </header>

        <BackupReminder hasCards={cards.length > 0} />

        {cards.length > 0 && (
          <Controls
            query={query}
            onQueryChange={setQuery}
            status={status}
            onStatusChange={setStatus}
            sort={sort}
            onSortChange={setSort}
          />
        )}

        {cards.length === 0 ? (
          <EmptyState />
        ) : visible.length === 0 ? (
          <NoMatches onClear={() => { setQuery(''); setStatus('all'); }} />
        ) : (
          <ul className="space-y-4">
            {visible.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/cards/${c.id}`}
                  className="block transition-transform active:scale-[0.98] hover:-translate-y-0.5"
                >
                  <MerchantCard card={c} />
                </Link>
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

function Controls({
  query,
  onQueryChange,
  status,
  onStatusChange,
  sort,
  onSortChange,
}: {
  query: string;
  onQueryChange: (s: string) => void;
  status: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
  sort: Sort;
  onSortChange: (s: Sort) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by merchant or note…"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        />
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as Sort)}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          aria-label="Sort"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STATUS_CHIPS.map((c) => (
          <button
            key={c.value}
            onClick={() => onStatusChange(c.value)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs border transition ${
              status === c.value
                ? 'bg-sky-500 border-sky-400 text-white'
                : 'border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function applyFilters(
  cards: readonly CardRecord[],
  query: string,
  status: StatusFilter,
  sort: Sort,
): CardRecord[] {
  const q = query.trim().toLowerCase();
  let out = cards.slice();
  if (status !== 'all') {
    out = out.filter((c) => c.status === status);
  }
  if (q) {
    out = out.filter((c) => {
      const haystack = [
        c.merchantSnapshot.name,
        c.note ?? '',
        c.giverName ?? '',
        c.orderRef ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }
  out.sort(sorters[sort]);
  return out;
}

const sorters: Record<Sort, (a: CardRecord, b: CardRecord) => number> = {
  recently_updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  recently_added: (a, b) => b.createdAt.localeCompare(a.createdAt),
  balance_desc: (a, b) => (b.balance ?? 0) - (a.balance ?? 0),
  balance_asc: (a, b) => (a.balance ?? 0) - (b.balance ?? 0),
  expires_soonest: (a, b) => {
    const av = a.expiresAt ?? '￿';
    const bv = b.expiresAt ?? '￿';
    return av.localeCompare(bv);
  },
  name_az: (a, b) => a.merchantSnapshot.name.localeCompare(b.merchantSnapshot.name),
};

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-12 text-center space-y-2">
      <p className="text-slate-300">No gift cards yet</p>
      <p className="text-sm text-slate-500">Tap the button below to add your first one</p>
    </div>
  );
}

function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-12 text-center space-y-3">
      <p className="text-slate-300">No cards match your filters</p>
      <Button variant="secondary" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}
