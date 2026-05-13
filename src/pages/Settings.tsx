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
  { label: '1 min', ms: 60_000 },
  { label: '5 min', ms: 5 * 60_000 },
  { label: '15 min', ms: 15 * 60_000 },
  { label: '1 hour', ms: 60 * 60_000 },
  { label: 'Never', ms: 0 },
];

export default function Settings() {
  const navigate = useNavigate();
  return (
    <Screen>
      <div className="max-w-md mx-auto p-6 space-y-6 pb-12">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-slate-100">
            ← Back
          </button>
          <h1 className="text-xl font-semibold">Settings</h1>
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
    if (pw.length < 8) return setError('Password must be at least 8 characters');
    if (pw !== confirm) return setError('Passwords do not match');
    const dek = getDekRaw();
    if (!dek) return setError('Vault is locked');
    setBusy(true);
    try {
      await changeMasterPassword(dek, pw);
      setPw('');
      setConfirm('');
      setMessage('Master password updated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsSection title="Change master password" description="Existing data stays accessible, but the old password stops working immediately.">
      <Input
        label="New master password"
        type={show ? 'text' : 'password'}
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        autoComplete="new-password"
      />
      <Input
        label="Confirm new password"
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
        Show password
      </label>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {message && <p className="text-sm text-emerald-400">{message}</p>}
      <Button onClick={handleChange} disabled={busy || !pw}>
        {busy ? 'Updating…' : 'Update password'}
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
        setError('Vault is locked');
        return;
      }
      const platform =
        /Mac|iPhone|iPad/.test(navigator.platform) ? 'Apple device' :
        /Win/.test(navigator.platform) ? 'Windows device' :
        /Android/.test(navigator.userAgent) ? 'Android device' : 'This device';
      const result = await registerBiometric(dek, `${platform} · ${new Date().toLocaleDateString()}`);
      if (result.ok) {
        await refresh();
      } else if (result.reason !== 'cancelled') {
        setError(`Registration failed: ${result.reason}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    if (!window.confirm('Remove this biometric key? You can still unlock with the master password or recovery code.')) return;
    await removeBiometricWrap(id);
    await refresh();
  }

  if (!supported && wraps.length === 0) {
    return (
      <SettingsSection title="Biometric unlock" description="Not supported by this browser/device.">
        <p className="text-xs text-slate-500">Open Gicca in a browser that supports Face ID, Touch ID, or Windows Hello to enable.</p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Biometric unlock"
      description="Manages passkeys registered on this device. Each device needs its own registration."
    >
      {wraps.length === 0 ? (
        <p className="text-xs text-slate-500">Not enabled yet</p>
      ) : (
        <ul className="space-y-2">
          {wraps.map((w) => (
            <li
              key={w.id}
              className="flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate">{w.label || 'Biometric key'}</div>
                <div className="text-xs text-slate-500">
                  {new Date(w.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => handleRemove(w.id)}
                className="text-xs text-rose-400 hover:text-rose-300"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {supported && (
        <Button variant="secondary" onClick={handleAdd} disabled={busy}>
          {busy ? 'Registering…' : 'Register new key'}
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
        'Regenerating the recovery code invalidates the old one immediately. Make sure you can save the new code.',
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
      title="Recovery code"
      description="The only fallback if you forget your master password."
    >
      {!code ? (
        <Button variant="secondary" onClick={regenerate} disabled={busy}>
          {busy ? 'Generating…' : 'Regenerate recovery code'}
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
            Copy to clipboard
          </Button>
          <label className="flex items-start gap-3 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1 accent-sky-500"
            />
            <span>I've saved the new recovery code.</span>
          </label>
          <Button disabled={!acknowledged} onClick={() => setCode(null)}>
            Done
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
      title="Auto-lock"
      description="Automatically locks after the chosen idle period."
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
    if (!window.confirm('Delete this custom merchant? Existing cards keep their merchant-name snapshot.')) return;
    await deleteUserMerchant(id);
  }

  return (
    <SettingsSection
      title="Custom merchants"
      description={`${all.length - userMerchants.length} built-in · ${userMerchants.length} custom`}
    >
      {userMerchants.length === 0 ? (
        <p className="text-xs text-slate-500">Create new merchants from the picker when adding a card.</p>
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
                Delete
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
      title="Backup / Migrate"
      description="Export an encrypted backup file or import one onto this device."
    >
      <Button variant="secondary" onClick={onNavigate}>
        Open backup page
      </Button>
    </SettingsSection>
  );
}

// ─── Danger zone ──────────────────────────────────────────────────────────

function DangerZone() {
  const navigate = useNavigate();

  async function handleWipe() {
    const phrase = window.prompt('This wipes every Gicca record on this device (cannot be undone). Type RESET to confirm:');
    if (phrase !== 'RESET') return;
    await wipeAll();
    lockSession();
    refreshVaultStatus();
    navigate('/setup', { replace: true });
  }

  return (
    <SettingsSection title="Danger zone" description="Wipes every Gicca record on this device.">
      <Button variant="danger" onClick={handleWipe}>
        Wipe all data
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
