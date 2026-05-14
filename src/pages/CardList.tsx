import { useEffect, useMemo, useState } from 'react';
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

        <Controls
          query={query}
          onQueryChange={setQuery}
          status={status}
          onStatusChange={setStatus}
          sort={sort}
          onSortChange={setSort}
          disabled={cards.length === 0}
        />

        {cards.length === 0 ? (
          <EmptyState />
        ) : visible.length === 0 ? (
          <NoMatches onClear={() => { setQuery(''); setStatus('all'); }} />
        ) : (
          <WalletStack cards={visible} />
        )}

        <Link
          to="/cards/new"
          className="fixed bottom-6 right-6 left-6 max-w-md mx-auto inline-flex items-center justify-center rounded-2xl bg-sky-500 hover:bg-sky-400 text-white px-4 py-3 font-medium shadow-lg shadow-sky-500/20 brutalist:rounded-none brutalist:bg-yellow-300 brutalist:text-black brutalist:border-2 brutalist:border-white brutalist:shadow-none brutalist:uppercase brutalist:tracking-wider"
        >
          + Add gift card
        </Link>
      </div>
    </Screen>
  );
}

// ─── Wallet stack ─────────────────────────────────────────────────────────

/**
 * Cards stack overlapping like a real wallet — only the top ~80px of each
 * lower card peeks below the one above it. On first mount we trigger a
 * "deal out" animation: the cards start tightly stacked and slide down
 * into their staggered peek positions with a small per-card delay so the
 * effect reads as a hand being splayed.
 */
function WalletStack({ cards }: { cards: readonly CardRecord[] }) {
  // True wallet metaphor: the NEWEST card (sorted first) is the front of
  // the wallet — fully visible at the BOTTOM of the visible stack. Older
  // cards stack on top of it with only their top ~50px peeking out (the
  // merchant name + balance band).
  //
  // We render the reversed array so the newest card is the last DOM child,
  // giving it the highest z-index naturally; every card after the first
  // overlaps its predecessor by (cardHeight − PEEK), so even with just
  // two cards you see the stacking effect.
  // Peek = cardHeight + OVERLAP_DEALT (negative). On the typical max-w-md
  // (card height ~252px) -170 gives an ~82px peek, enough room for the
  // merchant + balance row to be readable on each tucked card.
  const OVERLAP_DEALT = -170;
  const OVERLAP_TIGHT = -245;
  const stack = useMemo(() => [...cards].reverse(), [cards]);
  const [dealtOut, setDealtOut] = useState(false);

  useEffect(() => {
    // Two RAFs — first commits the pre-state, the second triggers the
    // transition. Without this React batches the initial render and the
    // dealtOut=true update together and the animation never plays.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setDealtOut(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);

  return (
    <ul className="relative pt-2">
      {stack.map((c, i) => (
        <li
          key={c.id}
          className="relative transition-[margin-top] duration-700 ease-[cubic-bezier(0.2,0.85,0.3,1)] will-change-[margin-top]"
          style={{
            // Card 0 (oldest, top of stack) sits at the top.
            // Every subsequent card overlaps its predecessor so only the
            // predecessor's top peek remains visible.
            marginTop: i === 0 ? 0 : dealtOut ? OVERLAP_DEALT : OVERLAP_TIGHT,
            // Later cards cover earlier ones' bodies; the LAST card has
            // the highest z and is fully visible as the front.
            zIndex: i + 1,
            transitionDelay: `${i * 55}ms`,
          }}
        >
          <Link
            to={`/cards/${c.id}`}
            className="block transition-transform duration-200 ease-out hover:-translate-y-1.5 active:scale-[0.99] active:translate-y-0"
            style={{
              animation: `wallet-card-in 0.55s cubic-bezier(0.2,0.85,0.3,1) ${i * 55}ms backwards`,
            }}
          >
            <MerchantCard card={c} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Controls({
  query,
  onQueryChange,
  status,
  onStatusChange,
  sort,
  onSortChange,
  disabled,
}: {
  query: string;
  onQueryChange: (s: string) => void;
  status: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
  sort: Sort;
  onSortChange: (s: Sort) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`space-y-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`} aria-hidden={disabled}>
      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by merchant or note…"
          disabled={disabled}
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 brutalist:rounded-none brutalist:border-2 brutalist:border-white brutalist:bg-black brutalist:focus:border-yellow-300 brutalist:focus:ring-0 brutalist:placeholder-white/40"
        />
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as Sort)}
          disabled={disabled}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 brutalist:rounded-none brutalist:border-2 brutalist:border-white brutalist:bg-black brutalist:focus:border-yellow-300 brutalist:focus:ring-0"
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
            disabled={disabled}
            className={`shrink-0 rounded-full px-3 py-1 text-xs border transition brutalist:rounded-none brutalist:border-2 brutalist:transition-none brutalist:uppercase brutalist:tracking-wider ${
              status === c.value
                ? 'bg-sky-500 border-sky-400 text-white brutalist:bg-yellow-300 brutalist:text-black brutalist:border-white'
                : 'border-slate-700 text-slate-300 hover:bg-slate-800 brutalist:border-white brutalist:text-white brutalist:hover:bg-white brutalist:hover:text-black'
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
