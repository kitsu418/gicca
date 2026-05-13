import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/ui';
import { CardForm, type SubmittedCard } from './CardForm';
import { createCard } from '../core/cards';

export default function AddCard() {
  const navigate = useNavigate();

  async function handleSubmit(v: SubmittedCard) {
    const card = await createCard({
      merchant: v.merchant,
      secrets: v.secrets,
      initialValue: v.initialValue,
      balance: v.balance ?? v.initialValue,
      currency: v.currency,
      expiresAt: v.expiresAt,
    });
    navigate(`/cards/${card.id}`, { replace: true });
  }

  return (
    <Screen>
      <div className="max-w-md mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-slate-400 hover:text-slate-100"
          >
            ← Back
          </button>
          <h1 className="text-xl font-semibold">Add gift card</h1>
        </div>
        <CardForm submitLabel="Save" onSubmit={handleSubmit} />
      </div>
    </Screen>
  );
}
