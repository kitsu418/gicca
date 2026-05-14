// Detail body for a card (codes, secrets, notes, info rows, activity,
// photos). Renders without page chrome — both the standalone CardDetail
// route and the inline expansion on CardList compose it after their own
// hero MerchantCard.

import { useState } from 'react';
import { Button } from './ui';
import { Barcode } from './Barcode';
import { TransactionsPanel } from './TransactionsPanel';
import { AttachmentGallery } from './AttachmentGallery';
import { getMerchant } from '../core/merchants';
import type { CardRecord, CodeKind } from '../core/types';

type Props = {
  card: CardRecord;
  /** Called after activity changes balance / status; parent re-fetches. */
  onRefresh?: () => void;
};

export function CardDetailBody({ card, onRefresh }: Props) {
  const [fullscreen, setFullscreen] = useState<{ kind: CodeKind; value: string } | null>(null);
  const codes = resolveCodes(card);

  async function copy(s: string) {
    try {
      await navigator.clipboard.writeText(s);
    } catch {
      // ignore — iOS PWAs sometimes block clipboard without a clear gesture
    }
  }

  return (
    <>
      {codes.length > 0 && (
        <div className="space-y-3">
          {codes.map((c) => (
            <button
              key={c.kind}
              type="button"
              onClick={() => setFullscreen(c)}
              className="block w-full text-left"
              title="Tap to enlarge"
            >
              <Barcode kind={c.kind} value={c.value} scale={2} />
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <ValueField label="Card number" value={card.cardNumber} onCopy={() => copy(card.cardNumber)} />
        {card.pin && <ValueField label="PIN" value={card.pin} onCopy={() => copy(card.pin!)} />}
        {card.note && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs text-slate-500 mb-1">Notes</div>
            <p className="text-sm whitespace-pre-wrap">{card.note}</p>
          </div>
        )}
      </div>

      <div className="space-y-2 text-sm text-slate-400">
        {card.expiresAt && <InfoRow label="Expires" value={new Date(card.expiresAt).toLocaleDateString()} />}
        <InfoRow label="Added" value={new Date(card.createdAt).toLocaleDateString()} />
      </div>

      <TransactionsPanel cardId={card.id} onAfterChange={onRefresh} />

      <AttachmentGallery cardId={card.id} />

      {fullscreen && (
        <FullscreenCode
          kind={fullscreen.kind}
          value={fullscreen.value}
          onClose={() => setFullscreen(null)}
        />
      )}
    </>
  );
}

function FullscreenCode({ kind, value, onClose }: { kind: CodeKind; value: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 cursor-pointer animate-[gicca-modal-in_0.25s_cubic-bezier(0.2,0.85,0.3,1)_both]"
      onClick={onClose}
    >
      <Barcode kind={kind} value={value} scale={5} className="!bg-white !p-0" />
      <p className="mt-6 text-slate-700 font-mono tabular-nums text-lg break-all">{value}</p>
      <p className="mt-3 text-slate-500 text-xs">Tap anywhere to close</p>
    </div>
  );
}

function resolveCodes(card: CardRecord): { kind: CodeKind; value: string }[] {
  const out: { kind: CodeKind; value: string }[] = [];
  if (card.barcode) out.push({ kind: 'barcode', value: card.barcode });
  if (card.qrcode) out.push({ kind: 'qrcode', value: card.qrcode });
  if (out.length === 0) {
    const merchant = getMerchant(card.merchantId);
    const hint = merchant?.cardFormat?.codeType;
    if (hint && card.cardNumber) {
      out.push({ kind: hint, value: card.cardNumber });
    }
  }
  return out;
}

function ValueField({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono tabular-nums break-all text-slate-100">{value}</span>
        <button
          onClick={onCopy}
          className="shrink-0 text-xs text-sky-400 hover:text-sky-300"
          title="Copy"
        >
          Copy
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}

// Note: Button is intentionally re-exported reference so callers can still
// pass it in as a slot if the body's chrome ever needs a primary action.
export { Button };
