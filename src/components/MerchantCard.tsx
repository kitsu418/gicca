// Gift-card tile.
//
// Skeuomorphic credit-card-aspect panel. Layout from top to bottom:
//   1. Header row — merchant wordmark on the left, balance block on the right.
//   2. Middle band — the card number, space-grouped every 4 chars.
//      No masking; whatever the user entered is what's shown.
//   3. Footer row — status label on the left, expiry on the right.

import type { CardRecord } from '../core/types';

type Props = {
  card: CardRecord;
  className?: string;
};

export function MerchantCard({ card, className = '' }: Props) {
  const bg = card.merchantSnapshot.color ?? '#475569';
  const balanceText = card.balance != null ? formatMoney(card.balance) : null;
  const faceValueText =
    card.initialValue != null ? formatMoney(card.initialValue) : null;
  const showFaceAlongside =
    balanceText != null && faceValueText != null && balanceText !== faceValueText;
  const formattedNumber = formatCardNumber(card.cardNumber);

  return (
    <div
      className={`relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-xl shadow-black/40 text-white ${className}`}
      style={{ backgroundColor: bg }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 35%, rgba(0,0,0,0.25) 100%)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.30) 100%)',
        }}
      />
      <div className="absolute top-0 inset-x-0 h-px bg-white/30 pointer-events-none" />

      <div className="relative h-full p-5 flex flex-col">
        {/* Header — merchant + balance */}
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

        {/* Middle — masked card number */}
        <div className="flex-1 flex items-center">
          <div className="font-mono text-base sm:text-lg tracking-[0.14em] break-all text-white/95 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]">
            {formattedNumber}
          </div>
        </div>

        {/* Footer — status + expiry */}
        <div className="flex items-end justify-between gap-3 text-xs">
          <div className="min-w-0">
            <div className="text-[9px] text-white/55 uppercase tracking-widest">
              Status
            </div>
            <div className="text-white/90">{statusLabel(card.status)}</div>
          </div>
          {card.expiresAt && (
            <div className="text-right">
              <div className="text-[9px] text-white/55 uppercase tracking-widest">
                Expires
              </div>
              <div className="text-white/90 tabular-nums">
                {formatExpiry(card.expiresAt)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatCardNumber(raw: string): string {
  if (!raw) return '';
  // Strip whitespace + dashes, then re-group into space-separated 4-char
  // chunks so long numbers wrap cleanly.
  const clean = raw.replace(/[\s-]/g, '');
  return clean.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${yy}`;
}

function statusLabel(status: CardRecord['status']): string {
  return {
    active: 'Active',
    used_up: 'Used up',
    expired: 'Expired',
  }[status];
}

function formatMoney(cents: number): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}
