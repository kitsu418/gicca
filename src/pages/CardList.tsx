import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Button, Screen } from '../components/ui';
import { MerchantCard } from '../components/MerchantCard';
import { CardDetailBody } from '../components/CardDetailBody';
import { AddCardSheet } from '../components/AddCardSheet';
import { BackupReminder } from '../components/BackupReminder';
import { deleteCard, getCard, useCards } from '../core/cards';
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

// Once the deal-out flourish has run, later remounts skip it. Without this
// the entry animation re-runs every time we come back from a sub-view and
// fights the View Transitions snapshot at handover.
let walletDealtOnce = false;

export default function CardList() {
  const cards = useCards();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<Sort>('recently_updated');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const visible = useMemo(
    () => applyFilters(cards, query, status, sort),
    [cards, query, status, sort],
  );

  const expandedCard = expandedId ? cards.find((c) => c.id === expandedId) ?? null : null;

  function withTransition(apply: () => void) {
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    if (typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(() => flushSync(apply));
    } else {
      apply();
    }
  }

  if (adding) {
    return (
      <AddCardSheet
        onCreated={(card) => {
          // Smoothly transition from the Add sheet → the new card expanded
          // inline. Single view transition wraps both state changes.
          withTransition(() => {
            setAdding(false);
            setExpandedId(card.id);
          });
        }}
        onClose={() => withTransition(() => setAdding(false))}
      />
    );
  }

  if (expandedCard) {
    return (
      <ExpandedView
        card={expandedCard}
        onClose={() => withTransition(() => setExpandedId(null))}
        onRefresh={async () => {
          await getCard(expandedCard.id);
        }}
        onEdit={() => navigate(`/cards/${expandedCard.id}/edit`)}
        onDeleted={() => {
          flushSync(() => setExpandedId(null));
        }}
      />
    );
  }

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
          <WalletStack
            cards={visible}
            onOpen={(id) => withTransition(() => setExpandedId(id))}
          />
        )}

        <button
          type="button"
          onClick={() => withTransition(() => setAdding(true))}
          className="fixed bottom-6 right-6 left-6 max-w-md mx-auto inline-flex items-center justify-center rounded-2xl bg-sky-500 hover:bg-sky-400 text-white px-4 py-3 font-medium shadow-lg shadow-sky-500/20"
        >
          + Add gift card
        </button>
      </div>
    </Screen>
  );
}

// ─── Inline expanded view ────────────────────────────────────────────────

function ExpandedView({
  card,
  onClose,
  onRefresh,
  onEdit,
  onDeleted,
}: {
  card: CardRecord;
  onClose: () => void;
  onRefresh: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  async function handleDelete() {
    if (!window.confirm(`Delete the ${card.merchantSnapshot.name} card?`)) return;
    await deleteCard(card.id);
    onDeleted();
  }

  return (
    <Screen>
      <div className="max-w-md mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-100">
            ← Back
          </button>
          <div className="flex gap-4 text-sm">
            <button onClick={onEdit} className="text-slate-400 hover:text-slate-100">
              Edit
            </button>
            <button onClick={handleDelete} className="text-rose-400 hover:text-rose-300">
              Delete
            </button>
          </div>
        </div>

        <div style={{ viewTransitionName: `mc-${card.id}` }}>
          <MerchantCard card={card} />
        </div>

        <CardDetailBody card={card} onRefresh={onRefresh} />
      </div>
    </Screen>
  );
}

// ─── Wallet stack with per-card gestures ──────────────────────────────────

function WalletStack({
  cards,
  onOpen,
}: {
  cards: readonly CardRecord[];
  onOpen: (id: string) => void;
}) {
  const OVERLAP_DEALT = -170;
  const OVERLAP_TIGHT = -245;
  const stack = useMemo(() => [...cards].reverse(), [cards]);
  // Only deal-out on the very first WalletStack mount per session. Subsequent
  // mounts (e.g. coming back from the Add sheet or an expanded card) skip the
  // intro flourish — otherwise the live-DOM animation flashes against the
  // View Transitions snapshot during the post-VT handover.
  const firstDeal = !walletDealtOnce;
  const [dealtOut, setDealtOut] = useState(!firstDeal);

  useEffect(() => {
    if (!firstDeal) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        setDealtOut(true);
        walletDealtOnce = true;
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [firstDeal]);

  return (
    <ul className="relative pt-2">
      {stack.map((c, i) => (
        <li
          key={c.id}
          className="relative transition-[margin-top] duration-700 ease-[cubic-bezier(0.2,0.85,0.3,1)] will-change-[margin-top]"
          style={{
            marginTop: i === 0 ? 0 : dealtOut ? OVERLAP_DEALT : OVERLAP_TIGHT,
            zIndex: i + 1,
            transitionDelay: `${i * 55}ms`,
          }}
        >
          <CardRow
            card={c}
            index={i}
            firstDeal={firstDeal}
            onOpen={() => onOpen(c.id)}
          />
        </li>
      ))}
    </ul>
  );
}

// Tap to open. Deletion lives inside the expanded view so the stack
// itself stays free of swipe gestures that fight the browser's own
// edge-swipes for back/forward and the iOS app-switcher.
function CardRow({
  card,
  index,
  firstDeal,
  onOpen,
}: {
  card: CardRecord;
  index: number;
  firstDeal: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full text-left transition-transform duration-200 ease-out hover:-translate-y-1.5"
      style={
        {
          ...(firstDeal && {
            animation: `wallet-card-in 0.55s cubic-bezier(0.2,0.85,0.3,1) ${index * 55}ms backwards`,
          }),
          viewTransitionName: `mc-${card.id}`,
        } as React.CSSProperties
      }
    >
      <MerchantCard card={card} />
    </button>
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
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by merchant or note…"
          disabled={disabled}
          className="w-full min-w-0 sm:flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        />
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as Sort)}
          disabled={disabled}
          className="w-full sm:w-auto min-w-0 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
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
