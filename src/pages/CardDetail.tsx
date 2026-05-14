import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Screen } from '../components/ui';
import { MerchantCard } from '../components/MerchantCard';
import { Barcode } from '../components/Barcode';
import { AttachmentGallery } from '../components/AttachmentGallery';
import { TransactionsPanel } from '../components/TransactionsPanel';
import { deleteCard, getCard } from '../core/cards';
import { getMerchant } from '../core/merchants';
import type { CardRecord, CodeKind } from '../core/types';

export default function CardDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<CardRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState<{ kind: CodeKind; value: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await getCard(id);
        if (!c) {
          setError('Card not found');
          return;
        }
        if (cancelled) return;
        setCard(c);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load card');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleDelete() {
    if (!window.confirm('Delete this gift card?')) return;
    await deleteCard(id);
    navigate('/', { replace: true });
  }

  async function copy(s: string) {
    try {
      await navigator.clipboard.writeText(s);
    } catch {
      // ignore
    }
  }

  if (error) {
    return (
      <Screen>
        <div className="max-w-md mx-auto p-6 space-y-4">
          <p className="text-rose-400">{error}</p>
          <Link to="/" className="text-sky-400 text-sm">
            Back to home
          </Link>
        </div>
      </Screen>
    );
  }

  if (!card) {
    return (
      <Screen>
        <div className="max-w-md mx-auto p-6 text-slate-500 text-sm">Loading…</div>
      </Screen>
    );
  }

  const codes = resolveCodes(card);

  return (
    <Screen>
      <div className="max-w-md mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-slate-100">
            ← Back
          </button>
          <div className="flex gap-2">
            <Link
              to={`/cards/${id}/edit`}
              className="text-sm text-slate-400 hover:text-slate-100"
            >
              Edit
            </Link>
            <button
              onClick={handleDelete}
              className="text-sm text-rose-400 hover:text-rose-300"
            >
              Delete
            </button>
          </div>
        </div>

        <MerchantCard card={card} />

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
          <ValueField
            label="Card number"
            value={card.cardNumber}
            onCopy={() => copy(card.cardNumber)}
          />
          {card.pin && (
            <ValueField label="PIN" value={card.pin} onCopy={() => copy(card.pin!)} />
          )}
          {card.note && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-xs text-slate-500 mb-1">Notes</div>
              <p className="text-sm whitespace-pre-wrap">{card.note}</p>
            </div>
          )}
        </div>

        <div className="space-y-2 text-sm text-slate-400">
          {card.currency && <InfoRow label="Currency" value={card.currency} />}
          {card.expiresAt && <InfoRow label="Expires" value={new Date(card.expiresAt).toLocaleDateString()} />}
          <InfoRow label="Added" value={new Date(card.createdAt).toLocaleDateString()} />
        </div>

        <TransactionsPanel
          cardId={card.id}
          currency={card.currency}
          onAfterChange={async () => {
            const fresh = await getCard(id);
            if (fresh) setCard(fresh);
          }}
        />

        <AttachmentGallery cardId={card.id} />
      </div>

      {fullscreen && (
        <FullscreenCode
          kind={fullscreen.kind}
          value={fullscreen.value}
          onClose={() => setFullscreen(null)}
        />
      )}
    </Screen>
  );
}

function FullscreenCode({
  kind,
  value,
  onClose,
}: {
  kind: CodeKind;
  value: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 cursor-pointer"
      onClick={onClose}
    >
      <Barcode kind={kind} value={value} scale={5} className="!bg-white !p-0" />
      <p className="mt-6 text-slate-700 font-mono tabular-nums text-lg break-all">
        {value}
      </p>
      <p className="mt-3 text-slate-500 text-xs">Tap anywhere to close</p>
    </div>
  );
}

function resolveCodes(card: CardRecord): { kind: CodeKind; value: string }[] {
  const out: { kind: CodeKind; value: string }[] = [];
  if (card.barcode) out.push({ kind: 'barcode', value: card.barcode });
  if (card.qrcode) out.push({ kind: 'qrcode', value: card.qrcode });
  if (out.length === 0) {
    // Fall back to the merchant hint + card number when neither code is
    // explicitly stored — covers legacy cards and the common case where
    // the card number IS the scannable value.
    const merchant = getMerchant(card.merchantId);
    const hint = merchant?.cardFormat?.codeType;
    if (hint && card.cardNumber) {
      out.push({ kind: hint, value: card.cardNumber });
    }
  }
  return out;
}

function ValueField({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
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
