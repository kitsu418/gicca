import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Screen } from '../components/ui';
import { MerchantBadge } from '../components/MerchantBadge';
import { meta, wipeAll } from '../core/db';
import { getDekRaw, lockSession, setAutoLockMs } from '../core/vault/session';
import {
  changeMasterPassword,
  regenerateRecoveryCode,
} from '../core/vault/vault';
import {
  isBiometricSupported,
  listBiometricWraps,
  registerBiometric,
  removeBiometricWrap,
} from '../core/vault/biometric';
import { deleteUserMerchant, useMerchants } from '../core/merchants';
import { refreshVaultStatus } from '../hooks/useVaultStatus';
import type { VaultWrap } from '../core/types';

const AUTO_LOCK_PRESETS: { label: string; ms: number }[] = [
  { label: '1 分钟', ms: 60_000 },
  { label: '5 分钟', ms: 5 * 60_000 },
  { label: '15 分钟', ms: 15 * 60_000 },
  { label: '1 小时', ms: 60 * 60_000 },
  { label: '不自动锁', ms: 0 },
];

export default function Settings() {
  const navigate = useNavigate();
  return (
    <Screen>
      <div className="max-w-md mx-auto p-6 space-y-6 pb-12">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-slate-100">
            ← 返回
          </button>
          <h1 className="text-xl font-semibold">设置</h1>
        </div>

        <ChangePasswordSection />
        <BiometricSection />
        <RecoveryCodeSection />
        <AutoLockSection />
        <MerchantsSection />
        <BackupShortcut onNavigate={() => navigate('/backup')} />
        <DangerZone />
      </div>
    </Screen>
  );
}

// ─── Change password ──────────────────────────────────────────────────────

function ChangePasswordSection() {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChange() {
    setError(null);
    setMessage(null);
    if (pw.length < 8) return setError('密码至少 8 个字符');
    if (pw !== confirm) return setError('两次输入的密码不一致');
    const dek = getDekRaw();
    if (!dek) return setError('保险箱未解锁');
    setBusy(true);
    try {
      await changeMasterPassword(dek, pw);
      setPw('');
      setConfirm('');
      setMessage('主密码已更新');
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsSection title="修改主密码" description="不会改动现有的数据，但旧密码会立即失效">
      <Input
        label="新主密码"
        type={show ? 'text' : 'password'}
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        autoComplete="new-password"
      />
      <Input
        label="再次输入"
        type={show ? 'text' : 'password'}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
      />
      <label className="flex items-center gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={show}
          onChange={(e) => setShow(e.target.checked)}
          className="accent-sky-500"
        />
        显示密码
      </label>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {message && <p className="text-sm text-emerald-400">{message}</p>}
      <Button onClick={handleChange} disabled={busy || !pw}>
        {busy ? '更新中…' : '更新主密码'}
      </Button>
    </SettingsSection>
  );
}

// ─── Biometric ────────────────────────────────────────────────────────────

function BiometricSection() {
  const [supported, setSupported] = useState(false);
  const [wraps, setWraps] = useState<VaultWrap[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setWraps(await listBiometricWraps());
  }

  useEffect(() => {
    isBiometricSupported().then(setSupported);
    void refresh();
  }, []);

  async function handleAdd() {
    setError(null);
    setBusy(true);
    try {
      const dek = getDekRaw();
      if (!dek) {
        setError('保险箱未解锁');
        return;
      }
      const platform =
        /Mac|iPhone|iPad/.test(navigator.platform) ? 'Apple 设备' :
        /Win/.test(navigator.platform) ? 'Windows 设备' :
        /Android/.test(navigator.userAgent) ? 'Android 设备' : '本设备';
      const result = await registerBiometric(dek, `${platform} · ${new Date().toLocaleDateString()}`);
      if (result.ok) {
        await refresh();
      } else if (result.reason !== 'cancelled') {
        setError(`注册失败：${result.reason}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    if (!window.confirm('移除这个生物识别密钥？以后只能用主密码或恢复码解锁。')) return;
    await removeBiometricWrap(id);
    await refresh();
  }

  if (!supported && wraps.length === 0) {
    return (
      <SettingsSection title="生物识别" description="当前浏览器/设备不支持生物识别">
        <p className="text-xs text-slate-500">在支持 Face ID / Touch ID / Windows Hello 的浏览器中打开本应用以启用。</p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="生物识别"
      description="管理本设备已注册的 Passkey。多台设备需要分别注册。"
    >
      {wraps.length === 0 ? (
        <p className="text-xs text-slate-500">尚未启用</p>
      ) : (
        <ul className="space-y-2">
          {wraps.map((w) => (
            <li
              key={w.id}
              className="flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate">{w.label || '生物识别'}</div>
                <div className="text-xs text-slate-500">
                  {new Date(w.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => handleRemove(w.id)}
                className="text-xs text-rose-400 hover:text-rose-300"
              >
                移除
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {supported && (
        <Button variant="secondary" onClick={handleAdd} disabled={busy}>
          {busy ? '注册中…' : '注册新密钥'}
        </Button>
      )}
    </SettingsSection>
  );
}

// ─── Recovery code ────────────────────────────────────────────────────────

function RecoveryCodeSection() {
  const [code, setCode] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  async function regenerate() {
    if (
      !window.confirm(
        '生成新的恢复码会让旧的恢复码立即失效。请确保你能保存新的恢复码。',
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const dek = getDekRaw();
      if (!dek) return;
      const next = await regenerateRecoveryCode(dek);
      setCode(next);
      setAcknowledged(false);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!code) return;
    await navigator.clipboard.writeText(code.join(' '));
  }

  return (
    <SettingsSection
      title="恢复码"
      description="忘记主密码时唯一能救回数据的备用钥匙。"
    >
      {!code ? (
        <Button variant="secondary" onClick={regenerate} disabled={busy}>
          {busy ? '生成中…' : '重新生成恢复码'}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-700 bg-slate-900 p-4 font-mono">
            {code.map((w, i) => (
              <div key={i} className="flex items-baseline gap-2 text-sm">
                <span className="text-slate-500 tabular-nums w-5 text-right">{i + 1}.</span>
                <span className="text-slate-100">{w}</span>
              </div>
            ))}
          </div>
          <Button variant="secondary" className="w-full" onClick={copy}>
            复制到剪贴板
          </Button>
          <label className="flex items-start gap-3 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1 accent-sky-500"
            />
            <span>我已保存新的恢复码。</span>
          </label>
          <Button disabled={!acknowledged} onClick={() => setCode(null)}>
            完成
          </Button>
        </div>
      )}
    </SettingsSection>
  );
}

// ─── Auto-lock ────────────────────────────────────────────────────────────

function AutoLockSection() {
  const [ms, setMs] = useState(5 * 60_000);

  useEffect(() => {
    meta.get('autoLockMs').then((v) => {
      if (typeof v === 'number') setMs(v);
    });
  }, []);

  async function pick(value: number) {
    setMs(value);
    await meta.set('autoLockMs', value);
    setAutoLockMs(value);
  }

  return (
    <SettingsSection
      title="自动锁定"
      description="无操作超过设定时长后自动锁定，需要重新解锁。"
    >
      <div className="flex flex-wrap gap-2">
        {AUTO_LOCK_PRESETS.map((p) => (
          <button
            key={p.ms}
            onClick={() => pick(p.ms)}
            className={`rounded-full px-3 py-1.5 text-sm border ${
              ms === p.ms
                ? 'bg-sky-500 border-sky-400 text-white'
                : 'border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </SettingsSection>
  );
}

// ─── User merchants ───────────────────────────────────────────────────────

function MerchantsSection() {
  const all = useMerchants();
  const userMerchants = all.filter((m) => m.source === 'user');

  async function handleDelete(id: string) {
    if (!window.confirm('删除这个自定义商户？现有的卡片会保留商户名快照。')) return;
    await deleteUserMerchant(id);
  }

  return (
    <SettingsSection
      title="自定义商户"
      description={`目前内置 ${all.length - userMerchants.length} 个，自定义 ${userMerchants.length} 个`}
    >
      {userMerchants.length === 0 ? (
        <p className="text-xs text-slate-500">在添加卡片时通过商户选择器创建。</p>
      ) : (
        <ul className="space-y-2">
          {userMerchants.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-xl bg-slate-900 px-3 py-2">
              <MerchantBadge merchant={m} size={32} />
              <span className="flex-1 truncate text-sm">{m.name}</span>
              <button
                onClick={() => handleDelete(m.id)}
                className="text-xs text-rose-400 hover:text-rose-300"
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}
    </SettingsSection>
  );
}

// ─── Backup shortcut ──────────────────────────────────────────────────────

function BackupShortcut({ onNavigate }: { onNavigate: () => void }) {
  return (
    <SettingsSection
      title="备份 / 迁移"
      description="导出加密备份文件，或从备份导入到当前设备。"
    >
      <Button variant="secondary" onClick={onNavigate}>
        打开备份页面
      </Button>
    </SettingsSection>
  );
}

// ─── Danger zone ──────────────────────────────────────────────────────────

function DangerZone() {
  const navigate = useNavigate();

  async function handleWipe() {
    const phrase = window.prompt('这会清空本设备上所有数据（不可撤销）。输入 RESET 确认：');
    if (phrase !== 'RESET') return;
    await wipeAll();
    lockSession();
    refreshVaultStatus();
    navigate('/setup', { replace: true });
  }

  return (
    <SettingsSection title="危险操作" description="清空本设备上的所有 Gicca 数据。">
      <Button variant="danger" onClick={handleWipe}>
        清空所有数据
      </Button>
    </SettingsSection>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
      <header>
        <h2 className="font-medium">{title}</h2>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
