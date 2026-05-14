// Renders setup / unlock screens until the vault is open, then hands
// the unlocked tree off to its children.

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  detectInitialState,
  getStatus,
  setupVault,
  subscribe as subscribeVault,
  unlockVault,
} from '../core/vault';
import { Button, CenteredCard } from './ui';

export function VaultGate({ children }: { children: ReactNode }) {
  const status = useSyncExternalStore(subscribeVault, getStatus, getStatus);

  useEffect(() => {
    void detectInitialState();
  }, []);

  if (status === 'loading') {
    return (
      <CenteredCard>
        <p className="text-slate-400 text-sm">Opening vault…</p>
      </CenteredCard>
    );
  }
  if (status === 'setup') return <SetupScreen />;
  if (status === 'locked') return <UnlockScreen />;
  return <>{children}</>;
}

function SetupScreen() {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) {
      setError('Use at least 8 characters');
      return;
    }
    if (pw !== confirm) {
      setError("Confirmation doesn't match");
      return;
    }
    setBusy(true);
    try {
      await setupVault(pw);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <CenteredCard>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Set your master passphrase</h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          Gicca encrypts every card on this device with a key derived from
          your passphrase. Pick something you'll remember —{' '}
          <strong className="text-amber-300">there is no recovery</strong>{' '}
          if you forget it.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <PassphraseInput
          autoFocus
          autoComplete="new-password"
          value={pw}
          onChange={setPw}
          placeholder="New passphrase"
        />
        <PassphraseInput
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          placeholder="Confirm passphrase"
        />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Setting up…' : 'Create vault'}
        </Button>
      </form>
    </CenteredCard>
  );
}

function UnlockScreen() {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!pw) return;
    setBusy(true);
    try {
      const ok = await unlockVault(pw);
      if (!ok) setError('Wrong passphrase');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unlock failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <CenteredCard>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Unlock Gicca</h1>
        <p className="text-sm text-slate-400">
          Enter your master passphrase to decrypt this device's cards.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <PassphraseInput
          autoFocus
          autoComplete="current-password"
          value={pw}
          onChange={setPw}
          placeholder="Passphrase"
        />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || !pw}>
          {busy ? 'Unlocking…' : 'Unlock'}
        </Button>
      </form>
    </CenteredCard>
  );
}

function PassphraseInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  autoComplete?: string;
}) {
  return (
    <input
      type="password"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      autoComplete={autoComplete}
      className="block w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
    />
  );
}
