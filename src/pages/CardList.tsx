import { useEffect, useMemo, useRef, useState } from 'react';
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

// Pixel thresholds for the in-stack gestures.
const SWIPE_LEFT_DISMISS = 80; // px left → trigger delete confirmation
const SWIPE_UP_OPEN = 50; // px up → open the card
const AXIS_LOCK_DELTA = 10; // px in either direction → commit to an axis
const DRAG_DOWN_CLOSE = 120; // px down on hero → collapse back to stack

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

  async function handleDeleteConfirm(card: CardRecord) {
    const ok = window.confirm(
      `Delete the ${card.merchantSnapshot.name} card? This cannot be undone.`,
    );
    if (!ok) return;
    withTransition(() => {
      // useCards re-fetches on mutation; the row just disappears with the
      // root cross-fade.
      void deleteCard(card.id);
    });
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
            onDeleteConfirm={handleDeleteConfirm}
          />
        )}

        <button
          type="button"
          onClick={() => withTransition(() => setAdding(true))}
          className="fixed bottom-6 right-6 left-6 max-w-md mx-auto inline-flex items-center justify-center rounded-2xl bg-sky-500 hover:bg-sky-400 text-white px-4 py-3 font-medium shadow-lg shadow-sky-500/20 brutalist:rounded-none brutalist:bg-yellow-300 brutalist:text-black brutalist:border-2 brutalist:border-white brutalist:shadow-none brutalist:uppercase brutalist:tracking-wider"
        >
          + Add gift card
        </button>
      </div>
    </Screen>
  );
}

// ─── Inline expanded view (drag-down to close) ────────────────────────────

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
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ active: boolean; startY: number }>({
    active: false,
    startY: 0,
  });

  async function handleDelete() {
    if (!window.confirm(`Delete the ${card.merchantSnapshot.name} card?`)) return;
    await deleteCard(card.id);
    onDeleted();
  }

  function onPointerDown(e: React.PointerEvent) {
    dragRef.current.active = true;
    dragRef.current.startY = e.clientY;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current.active) return;
    const dy = e.clientY - dragRef.current.startY;
    if (dy >= 0) setDragY(dy);
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
    const releasedAt = dragY;
    setDragging(false);
    setDragY(0);
    if (releasedAt > DRAG_DOWN_CLOSE) onClose();
  }

  const transform = dragY > 0
    ? `translateY(${dragY}px) scale(${Math.max(0.85, 1 - dragY / 1500)})`
    : undefined;
  const opacity = dragY > 0 ? Math.max(0.3, 1 - dragY / 700) : 1;

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

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="cursor-grab active:cursor-grabbing select-none"
          style={
            {
              transform,
              opacity,
              touchAction: 'pan-y',
              transition: dragging
                ? undefined
                : 'transform 0.3s cubic-bezier(0.2, 0.85, 0.3, 1), opacity 0.3s ease',
              viewTransitionName: `mc-${card.id}`,
            } as React.CSSProperties
          }
        >
          <MerchantCard card={card} />
        </div>

        <p className="text-center text-xs text-slate-500 -mt-1 select-none">
          Pull the card down to put it back
        </p>

        <CardDetailBody card={card} onRefresh={onRefresh} />
      </div>
    </Screen>
  );
}

// ─── Wallet stack with per-card gestures ──────────────────────────────────

function WalletStack({
  cards,
  onOpen,
  onDeleteConfirm,
}: {
  cards: readonly CardRecord[];
  onOpen: (id: string) => void;
  onDeleteConfirm: (card: CardRecord) => void;
}) {
  const OVERLAP_DEALT = -170;
  const OVERLAP_TIGHT = -245;
  const stack = useMemo(() => [...cards].reverse(), [cards]);
  const [dealtOut, setDealtOut] = useState(false);

  useEffect(() => {
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
            marginTop: i === 0 ? 0 : dealtOut ? OVERLAP_DEALT : OVERLAP_TIGHT,
            zIndex: i + 1,
            transitionDelay: `${i * 55}ms`,
          }}
        >
          <CardRow
            card={c}
            index={i}
            onOpen={() => onOpen(c.id)}
            onDeleteConfirm={() => onDeleteConfirm(c)}
          />
        </li>
      ))}
    </ul>
  );
}

// Each card in the stack handles its own gestures:
//   - tap          → open (full view transition morph)
//   - drag up      → open (same morph)
//   - drag left    → confirm delete (window.confirm)
// Pointer events are axis-locked after AXIS_LOCK_DELTA so a tiny touch
// shake doesn't accidentally trigger either swipe.
function CardRow({
  card,
  index,
  onOpen,
  onDeleteConfirm,
}: {
  card: CardRecord;
  index: number;
  onOpen: () => void;
  onDeleteConfirm: () => void;
}) {
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    active: boolean;
    x0: number;
    y0: number;
    axis: 'x' | 'y' | null;
  }>({ active: false, x0: 0, y0: 0, axis: null });
  const suppressClickRef = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    dragRef.current = { active: true, x0: e.clientX, y0: e.clientY, axis: null };
    setDragging(true);
    suppressClickRef.current = false;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.x0;
    const dy = e.clientY - dragRef.current.y0;
    if (!dragRef.current.axis) {
      if (Math.abs(dx) > AXIS_LOCK_DELTA) dragRef.current.axis = 'x';
      else if (Math.abs(dy) > AXIS_LOCK_DELTA) dragRef.current.axis = 'y';
    }
    if (dragRef.current.axis === 'x' && dx < 0) {
      setDragX(dx);
    } else if (dragRef.current.axis === 'y' && dy < 0) {
      setDragY(dy);
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!dragRef.current.active) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const axis = dragRef.current.axis;
    const finalDx = dragX;
    const finalDy = dragY;
    dragRef.current.active = false;
    dragRef.current.axis = null;
    setDragging(false);
    setDragX(0);
    setDragY(0);
    if (axis === 'x' && finalDx <= -SWIPE_LEFT_DISMISS) {
      suppressClickRef.current = true;
      onDeleteConfirm();
    } else if (axis === 'y' && finalDy <= -SWIPE_UP_OPEN) {
      suppressClickRef.current = true;
      onOpen();
    }
  }
  function onClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onOpen();
  }

  // Red "delete" affordance peeks from the right as the user swipes left.
  const showDeleteAffordance = dragX < 0;
  const dragTransform =
    dragX !== 0 || dragY !== 0
      ? `translate(${dragX}px, ${dragY}px)`
      : undefined;

  return (
    <div className="relative">
      {/* Delete affordance behind the card, revealed during left-swipe */}
      <div
        className="absolute inset-0 rounded-2xl bg-rose-600/90 brutalist:rounded-none brutalist:border-2 brutalist:border-white brutalist:bg-rose-600 flex items-center justify-end pr-6 pointer-events-none"
        style={{ opacity: showDeleteAffordance ? Math.min(1, -dragX / 80) : 0 }}
      >
        <span className="text-white text-sm font-semibold uppercase tracking-wider">
          Delete
        </span>
      </div>

      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
        className="block w-full text-left transition-transform duration-200 ease-out hover:-translate-y-1.5 select-none"
        style={
          {
            animation: `wallet-card-in 0.55s cubic-bezier(0.2,0.85,0.3,1) ${index * 55}ms backwards`,
            transform: dragTransform,
            transition: dragging
              ? undefined
              : 'transform 0.25s cubic-bezier(0.2, 0.85, 0.3, 1)',
            touchAction: 'pan-y',
            viewTransitionName: `mc-${card.id}`,
          } as React.CSSProperties
        }
      >
        <MerchantCard card={card} />
      </button>
    </div>
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
