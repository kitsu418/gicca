import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '../components/ui';
import { CardForm, type SubmittedCard } from './CardForm';
import { getCard, updateCard } from '../core/cards';
import type { CardRecord } from '../core/types';

export default function EditCard() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<CardRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSubmit(v: SubmittedCard) {
    await updateCard(id, {
      merchant: v.merchant,
      cardNumber: v.cardNumber,
      pin: v.pin,
      note: v.note,
      barcode: v.barcode,
      initialValue: v.initialValue,
      balance: v.balance,
      currency: v.currency,
      expiresAt: v.expiresAt,
    });
    navigate(`/cards/${id}`, { replace: true });
  }

  return (
    <Screen>
      <div className="max-w-md mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-slate-100">
            ← Back
          </button>
          <h1 className="text-xl font-semibold">Edit gift card</h1>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        {card && (
          <CardForm
            initial={card}
            submitLabel="Save changes"
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </Screen>
  );
}
