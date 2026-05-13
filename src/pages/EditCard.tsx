import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '../components/ui';
import { CardForm, type SubmittedCard } from './CardForm';
import { getCard, getCardSecrets, updateCard } from '../core/cards';
import type { CardRecord, CardSecrets } from '../core/types';

export default function EditCard() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<CardRecord | null>(null);
  const [secrets, setSecrets] = useState<CardSecrets | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await getCard(id);
        if (!c) {
          setError('找不到这张卡');
          return;
        }
        const s = await getCardSecrets(c);
        if (cancelled) return;
        setCard(c);
        setSecrets(s);
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit(v: SubmittedCard) {
    await updateCard(id, {
      merchant: v.merchant,
      secrets: v.secrets,
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
            ← 返回
          </button>
          <h1 className="text-xl font-semibold">编辑礼品卡</h1>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        {card && secrets && (
          <CardForm
            initial={card}
            initialSecrets={secrets}
            submitLabel="保存修改"
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </Screen>
  );
}
