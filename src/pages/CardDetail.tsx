// Direct-link card detail page. The CardList already does inline expansion
// for the typical in-app flow; this route stays so refresh / shared URLs
// continue to work.

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Screen } from '../components/ui';
import { MerchantCard } from '../components/MerchantCard';
import { CardDetailBody } from '../components/CardDetailBody';
import { deleteCard, getCard } from '../core/cards';
import type { CardRecord } from '../core/types';

export default function CardDetail() {
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
        if (!cancelled) setCard(c);
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

  return (
    <Screen>
      <div className="max-w-md mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-slate-100">
            ← Back
          </button>
          <div className="flex gap-2">
            <Link to={`/cards/${id}/edit`} className="text-sm text-slate-400 hover:text-slate-100">
              Edit
            </Link>
            <button onClick={handleDelete} className="text-sm text-rose-400 hover:text-rose-300">
              Delete
            </button>
          </div>
        </div>

        <div style={{ viewTransitionName: `mc-${card.id}` } as React.CSSProperties}>
          <MerchantCard card={card} />
        </div>

        <CardDetailBody
          card={card}
          onRefresh={async () => {
            const fresh = await getCard(id);
            if (fresh) setCard(fresh);
          }}
        />
      </div>
    </Screen>
  );
}
