// Gift-card tile.
//
// Three render modes:
//   - default   : skeuomorphic — gradient sheen, drop shadow, rounded-2xl,
//                 brand color fills the whole panel.
//   - brutalist : flat brand color, 3px white outer border, zero radius,
//                 no shadow, no sheen, mono balance numerals.
//   - newsprint : structural shift, not a re-skin. Vertical-RL serif
//                 headline running down the left "spine" of the card,
//                 horizontal balance lede on the right, classifieds-style
//                 metadata footer, category eyebrow at top. Stacks in a
//                 two-column newspaper grid (driven by CardList).
//
// useTheme drives the structural switch — newsprint mode needs a different
// markup layout, not just a class flip.

import type { CardRecord, MerchantCategory } from '../core/types';
import { useTheme } from '../hooks/useTheme';
import { getMerchant } from '../core/merchants';

type Props = {
  card: CardRecord;
  className?: string;
};

export function MerchantCard({ card, className = '' }: Props) {
  const theme = useTheme();
  if (theme === 'newsprint') return <NewsprintCard card={card} className={className} />;
  return <DefaultOrBrutalistCard card={card} className={className} />;
}

// ─── Newsprint — vertical headline + classifieds metadata ─────────────────

const CATEGORY_LABELS: Record<MerchantCategory, string> = {
  food: 'Dining',
  retail: 'Retail',
  entertainment: 'Leisure',
  transport: 'Transit',
  service: 'Service',
  other: 'Misc',
};

function NewsprintCard({ card, className = '' }: Props) {
  const merchant = getMerchant(card.merchantId);
  const section = merchant ? CATEGORY_LABELS[merchant.category] : CATEGORY_LABELS.other;
  const balanceText =
    card.balance != null ? formatMoney(card.balance, card.currency) : null;
  const faceValueText =
    card.initialValue != null ? formatMoney(card.initialValue, card.currency) : null;
  const showFaceAlongside =
    balanceText != null && faceValueText != null && balanceText !== faceValueText;
  const accent = card.merchantSnapshot.color ?? '#161310';
  const lastFour = card.cardNumber.slice(-4).padStart(4, '•');
  const expiry = card.expiresAt ? expiryFragment(card.expiresAt) : null;

  return (
    <article
      className={`relative bg-[#f4f1ea] text-[#161310] h-full min-h-[200px] flex flex-col ${className}`}
    >
      {/* Section eyebrow */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-[#161310] text-[9px] uppercase tracking-[0.3em] font-mono">
        <span>{section}</span>
        <span className="text-[#161310]/60">{shortDate(card.createdAt)}</span>
      </div>

      <div className="flex-1 flex gap-3 px-3 py-3">
        {/* Vertical serif merchant headline running top-to-bottom on the left */}
        <h3
          className="font-serif text-2xl font-black uppercase tracking-wider whitespace-nowrap"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          {card.merchantSnapshot.name}
        </h3>

        {/* Horizontal lede + metadata on the right */}
        <div className="flex-1 flex flex-col justify-between text-right min-w-0">
          <div>
            {(balanceText || faceValueText) && (
              <>
                <div className="text-[9px] uppercase tracking-[0.3em] font-mono text-[#161310]/70">
                  {balanceText ? 'Balance' : 'Face value'}
                </div>
                <div className="font-serif font-black text-2xl tabular-nums leading-tight">
                  {balanceText ?? faceValueText}
                </div>
                {showFaceAlongside && (
                  <div className="text-[10px] tabular-nums italic text-[#161310]/70 mt-0.5">
                    of {faceValueText}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="space-y-1 text-[10px] font-mono uppercase tracking-[0.2em]">
            <div className="tabular-nums">•••• {lastFour}</div>
            {expiry && (
              <div className={expiry.tone === 'bad' ? 'text-[#c8202c] font-bold' : expiry.tone === 'warn' ? 'text-[#c8202c]' : 'text-[#161310]/70'}>
                {expiry.text}
              </div>
            )}
            {card.status !== 'active' && (
              <div className="italic">{statusLabel(card.status)}</div>
            )}
          </div>
        </div>
      </div>

      {/* Brand color vertical bar on the very left, like a magazine bookmark */}
      <span
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: accent }}
        aria-hidden="true"
      />
    </article>
  );
}

function expiryFragment(date: string): { text: string; tone: 'normal' | 'warn' | 'bad' } {
  const d = new Date(date);
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: 'Expired', tone: 'bad' };
  if (days <= 30) return { text: `${days}d left`, tone: 'warn' };
  return { text: `Exp ${shortDate(date)}`, tone: 'normal' };
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}.${day}`;
}

// ─── Default + brutalist — brand-color panel ──────────────────────────────

function DefaultOrBrutalistCard({ card, className = '' }: Props) {
  const bg = card.merchantSnapshot.color ?? '#475569';
  const balanceText = card.balance != null ? formatMoney(card.balance, card.currency) : null;
  const faceValueText =
    card.initialValue != null ? formatMoney(card.initialValue, card.currency) : null;
  const showFaceAlongside =
    balanceText != null && faceValueText != null && balanceText !== faceValueText;

  return (
    <div
      className={`relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-xl shadow-black/40 text-white brutalist:rounded-none brutalist:shadow-none brutalist:border-2 brutalist:border-white ${className}`}
      style={{ backgroundColor: bg }}
    >
      <div
        className="absolute inset-0 pointer-events-none brutalist:hidden"
        style={{
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 35%, rgba(0,0,0,0.22) 100%)',
        }}
      />
      <div className="absolute top-0 inset-x-0 h-px bg-white/30 pointer-events-none brutalist:hidden" />

      <div className="relative h-full p-5 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <span className="text-xl font-extrabold uppercase tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)] truncate max-w-[60%] brutalist:drop-shadow-none brutalist:tracking-tighter">
            {card.merchantSnapshot.name}
          </span>
          {(balanceText || faceValueText) && (
            <div className="text-right shrink-0">
              <div className="text-[10px] text-white/70 uppercase tracking-widest brutalist:text-white">
                {balanceText ? 'Balance' : 'Face value'}
              </div>
              <div className="text-2xl font-semibold tabular-nums leading-tight brutalist:font-mono">
                {balanceText ?? faceValueText}
              </div>
              {showFaceAlongside && (
                <div className="text-[10px] text-white/60 mt-0.5 tabular-nums brutalist:text-white/80 brutalist:font-mono">
                  of {faceValueText}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-end justify-between gap-3 text-xs">
          <div className="min-w-0">
            {card.status !== 'active' && (
              <div className="text-white/75 brutalist:text-white">{statusLabel(card.status)}</div>
            )}
          </div>
          {card.expiresAt && <ExpiryBadge date={card.expiresAt} />}
        </div>
      </div>
    </div>
  );
}

function ExpiryBadge({ date }: { date: string }) {
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
  let text: string;
  let tone: 'normal' | 'warn' | 'bad' = 'normal';
  if (days < 0) {
    text = `Expired ${-days}d ago`;
    tone = 'bad';
  } else if (days <= 30) {
    text = `Expires ${days}d`;
    tone = 'warn';
  } else {
    text = new Date(date).toLocaleDateString();
  }
  const toneClass =
    tone === 'bad'
      ? 'bg-rose-500/30 text-white brutalist:bg-rose-500 brutalist:text-white'
      : tone === 'warn'
      ? 'bg-amber-400/30 text-white brutalist:bg-yellow-300 brutalist:text-black'
      : 'bg-white/15 text-white/85 brutalist:bg-white brutalist:text-black';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] backdrop-blur-sm brutalist:rounded-none brutalist:backdrop-blur-none brutalist:px-1.5 brutalist:font-mono brutalist:uppercase ${toneClass}`}
    >
      {text}
    </span>
  );
}

function statusLabel(status: CardRecord['status']): string {
  return {
    active: 'Active',
    used_up: 'Used up',
    expired: 'Expired',
  }[status];
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
