// Skeuomorphic gift-card tile.
//
// Renders a credit-card-aspect panel in the brand color with the
// merchant's uppercase name as the wordmark on top-left. Used on the
// list (as the row content) and on the detail page (as the hero).

import type { CardRecord } from '../core/types';

type Props = {
  card: CardRecord;
  className?: string;
};

export function MerchantCard({ card, className = '' }: Props) {
  const bg = card.merchantSnapshot.color ?? '#475569';
  const balanceText = card.balance != null ? formatMoney(card.balance, card.currency) : null;
  const faceValueText =
    card.initialValue != null ? formatMoney(card.initialValue, card.currency) : null;
  // Only show the "of $X" qualifier when the balance is materially different
  // from the face value — newly-loaded cards have balance === initialValue
  // and the redundant line just adds noise.
  const showFaceAlongside =
    balanceText != null && faceValueText != null && balanceText !== faceValueText;

  return (
    <div
      className={`relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-xl shadow-black/40 text-white ${className}`}
      style={{ backgroundColor: bg }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 35%, rgba(0,0,0,0.22) 100%)',
        }}
      />
      <div className="absolute top-0 inset-x-0 h-px bg-white/30 pointer-events-none" />

      <div className="relative h-full p-5 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <span className="text-xl font-extrabold uppercase tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)] truncate max-w-[60%]">
            {card.merchantSnapshot.name}
          </span>
          {(balanceText || faceValueText) && (
            <div className="text-right shrink-0">
              <div className="text-[10px] text-white/70 uppercase tracking-widest">
                {balanceText ? 'Balance' : 'Face value'}
              </div>
              <div className="text-2xl font-semibold tabular-nums leading-tight">
                {balanceText ?? faceValueText}
              </div>
              {showFaceAlongside && (
                <div className="text-[10px] text-white/60 mt-0.5 tabular-nums">
                  of {faceValueText}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-end justify-between gap-3 text-xs">
          <div className="min-w-0">
            {card.status !== 'active' && (
              <div className="text-white/75">{statusLabel(card.status)}</div>
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
      ? 'bg-rose-500/30 text-white'
      : tone === 'warn'
      ? 'bg-amber-400/30 text-white'
      : 'bg-white/15 text-white/85';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] backdrop-blur-sm ${toneClass}`}>
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
