import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Screen } from '../components/ui';
import { MerchantBadge } from '../components/MerchantBadge';
import { Barcode } from '../components/Barcode';
import { AttachmentGallery } from '../components/AttachmentGallery';
import { TransactionsPanel } from '../components/TransactionsPanel';
import { deleteCard, getCard, getCardSecrets } from '../core/cards';
import { getMerchant } from '../core/merchants';
import type { BarcodeFormat, CardRecord, CardSecrets } from '../core/types';

export default function CardDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<CardRecord | null>(null);
  const [secrets, setSecrets] = useState<CardSecrets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [fullscreenBarcode, setFullscreenBarcode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await getCard(id);
        if (!c) {
          setError('找不到这张卡');
          return;
        }
        if (cancelled) return;
        setCard(c);
        const s = await getCardSecrets(c);
        if (cancelled) return;
        setSecrets(s);
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleDelete() {
    if (!confirm('确定删除这张礼品卡？')) return;
    await deleteCard(id);
    navigate('/', { replace: true });
  }

  async function copy(s: string) {
    try {
      await navigator.clipboard.writeText(s);
    } catch {
      // Ignore — Safari can refuse clipboard write without user gesture; the
      // button itself counts as a gesture but iOS PWAs sometimes still block.
    }
  }

  if (error) {
    return (
      <Screen>
        <div className="max-w-md mx-auto p-6 space-y-4">
          <p className="text-rose-400">{error}</p>
          <Link to="/" className="text-sky-400 text-sm">
            返回首页
          </Link>
        </div>
      </Screen>
    );
  }

  if (!card) {
    return (
      <Screen>
        <div className="max-w-md mx-auto p-6 text-slate-500 text-sm">加载中…</div>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="max-w-md mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-slate-100">
            ← 返回
          </button>
          <div className="flex gap-2">
            <Link
              to={`/cards/${id}/edit`}
              className="text-sm text-slate-400 hover:text-slate-100"
            >
              编辑
            </Link>
            <button
              onClick={handleDelete}
              className="text-sm text-rose-400 hover:text-rose-300"
            >
              删除
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <MerchantBadge merchant={card.merchantSnapshot} size={56} />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold truncate">
              {card.merchantSnapshot.name}
            </h1>
            {card.balance != null && (
              <p className="text-slate-300 text-lg tabular-nums">
                余额 {formatMoney(card.balance, card.currency)}
              </p>
            )}
          </div>
        </div>

        {secrets && (() => {
          const bc = resolveBarcode(card, secrets);
          if (!bc) return null;
          return (
            <button
              type="button"
              onClick={() => setFullscreenBarcode(true)}
              className="block w-full text-left"
              title="点击放大显示"
            >
              <Barcode format={bc.format} value={bc.value} scale={2} />
            </button>
          );
        })()}

        {secrets ? (
          <div className="space-y-3">
            <SecretField
              label="卡号"
              value={secrets.cardNumber}
              revealed={revealed}
              onCopy={() => copy(secrets.cardNumber)}
            />
            {secrets.pin && (
              <SecretField
                label="PIN"
                value={secrets.pin}
                revealed={revealed}
                onCopy={() => copy(secrets.pin!)}
              />
            )}
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setRevealed((r) => !r)}
            >
              {revealed ? '隐藏敏感字段' : '显示敏感字段'}
            </Button>
            {secrets.note && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-xs text-slate-500 mb-1">备注</div>
                <p className="text-sm whitespace-pre-wrap">{secrets.note}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-slate-500 text-sm">解密中…</div>
        )}

        <div className="space-y-2 text-sm text-slate-400">
          {card.initialValue != null && (
            <InfoRow label="面值" value={formatMoney(card.initialValue, card.currency)} />
          )}
          {card.currency && <InfoRow label="币种" value={card.currency} />}
          {card.expiresAt && <InfoRow label="过期" value={new Date(card.expiresAt).toLocaleDateString()} />}
          <InfoRow label="添加" value={new Date(card.createdAt).toLocaleDateString()} />
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

      {fullscreenBarcode && secrets && (() => {
        const bc = resolveBarcode(card, secrets);
        if (!bc) return null;
        return <FullscreenBarcode format={bc.format} value={bc.value} onClose={() => setFullscreenBarcode(false)} />;
      })()}
    </Screen>
  );
}

/**
 * Locks the screen to a high-contrast checkout view. Tapping anywhere
 * dismisses. The white-on-black layout maxes out display contrast for
 * point-of-sale scanners, which can struggle with dim AMOLED themes.
 */
function FullscreenBarcode({
  format,
  value,
  onClose,
}: {
  format: BarcodeFormat;
  value: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 cursor-pointer"
      onClick={onClose}
    >
      <Barcode format={format} value={value} scale={5} className="!bg-white !p-0" />
      <p className="mt-6 text-slate-700 font-mono tabular-nums text-lg break-all">
        {value}
      </p>
      <p className="mt-3 text-slate-500 text-xs">点击任意位置关闭</p>
    </div>
  );
}

function resolveBarcode(
  card: CardRecord,
  secrets: CardSecrets,
): { format: BarcodeFormat; value: string } | null {
  if (secrets.barcode) return secrets.barcode;
  const merchant = getMerchant(card.merchantId);
  const fmt = merchant?.cardFormat?.barcodeFormat;
  if (!fmt) return null;
  return { format: fmt, value: secrets.cardNumber };
}

function SecretField({
  label,
  value,
  revealed,
  onCopy,
}: {
  label: string;
  value: string;
  revealed: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="flex items-center justify-between gap-3">
        <span
          className={`font-mono tabular-nums break-all ${
            revealed ? 'text-slate-100' : 'text-slate-500 tracking-widest'
          }`}
        >
          {revealed ? value : '••••' + (value.length > 4 ? ' •••• •••• ' + value.slice(-4) : '')}
        </span>
        <button
          onClick={onCopy}
          className="shrink-0 text-xs text-sky-400 hover:text-sky-300"
          title="复制"
        >
          复制
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
