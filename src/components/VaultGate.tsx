// Renders setup / unlock screens until the vault is open, then hands
// the unlocked tree off to its children. The setup flow is a small
// two-step wizard (welcome → passphrase) so first-time users see the
// "no recovery" warning before they're staring at a password field.

import {
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  detectInitialState,
  getStatus,
  setupVault,
  subscribe as subscribeVault,
  unlockVault,
} from '../core/vault';
import { Button, CenteredCard, PassphraseInput } from './ui';

export function VaultGate({ children }: { children: ReactNode }) {
  const status = useSyncExternalStore(subscribeVault, getStatus, getStatus);

  useEffect(() => {
    void detectInitialState();
  }, []);

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'setup') return <SetupScreen />;
  if (status === 'locked') return <UnlockScreen />;
  return <>{children}</>;
}

function Wordmark() {
  return (
    <div className="flex items-center justify-center">
      <span className="text-3xl font-semibold tracking-tight bg-gradient-to-br from-sky-300 to-sky-500 bg-clip-text text-transparent">
        Gicca
      </span>
    </div>
  );
}

function LoadingScreen() {
  return (
    <CenteredCard>
      <Wordmark />
      <p className="text-center text-sm text-slate-500 animate-pulse">
        Opening vault…
      </p>
    </CenteredCard>
  );
}

function SetupScreen() {
  const [step, setStep] = useState<'welcome' | 'passphrase'>('welcome');

  return (
    <CenteredCard>
      <Wordmark />
      <StepDots current={step === 'welcome' ? 0 : 1} total={2} />
      {/* key forces remount + replays the panel-in keyframe between steps */}
      <div
        key={step}
        className="animate-[gicca-panel-in_0.28s_cubic-bezier(0.2,0.85,0.3,1)_both]"
      >
        {step === 'welcome' && <WelcomePanel onNext={() => setStep('passphrase')} />}
        {step === 'passphrase' && <PassphrasePanel onBack={() => setStep('welcome')} />}
      </div>
    </CenteredCard>
  );
}

function WelcomePanel({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome.</h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          Gicca stores every gift card on this device, encrypted with a key
          derived from a passphrase you pick. Nothing leaves your phone, and
          nothing reaches the disk in the clear.
        </p>
      </div>
      <div className="rounded-xl border border-amber-700/40 bg-amber-500/10 p-3.5 text-xs text-amber-200 leading-relaxed">
        <strong className="font-semibold">There is no recovery.</strong> If
        you forget your passphrase, the cards on this device are unreadable
        — not even to us, because there is no us.
      </div>
      <Button className="w-full" onClick={onNext}>
        Get started
      </Button>
    </div>
  );
}

function PassphrasePanel({ onBack }: { onBack: () => void }) {
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
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Pick a passphrase</h2>
        <p className="text-xs text-slate-500">
          At least 8 characters. The longer the better.
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
        <StrengthHint passphrase={pw} />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            disabled={busy}
          >
            Back
          </Button>
          <Button type="submit" className="flex-1" disabled={busy || !pw || !confirm}>
            {busy ? 'Creating…' : 'Create vault'}
          </Button>
        </div>
      </form>
    </div>
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
      <Wordmark />
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Unlock</h1>
        <p className="text-xs text-slate-500">
          Enter your master passphrase.
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
        {error && <p className="text-sm text-rose-400 text-center">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || !pw}>
          {busy ? 'Unlocking…' : 'Unlock'}
        </Button>
      </form>
    </CenteredCard>
  );
}

function StepDots({ current, total }: { current: number; total: number }) {
  const dots = Array.from({ length: total }, (_, i) => i);
  return (
    <div className="flex items-center justify-center gap-1.5">
      {dots.map((i) => (
        <span
          key={i}
          className={
            i === current
              ? 'h-1.5 w-6 rounded-full bg-sky-400 transition-all'
              : 'h-1.5 w-1.5 rounded-full bg-slate-700 transition-all'
          }
        />
      ))}
    </div>
  );
}

function StrengthHint({ passphrase }: { passphrase: string }) {
  const id = useId();
  const len = passphrase.length;
  const score = len >= 16 ? 3 : len >= 12 ? 2 : len >= 8 ? 1 : 0;
  const labels = ['Too short', 'OK', 'Strong', 'Excellent'];
  const colors = ['bg-slate-800', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-400'];
  return (
    <div className="flex items-center gap-2" aria-describedby={id}>
      <div className="flex-1 flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < score ? colors[score] : 'bg-slate-800'
            }`}
          />
        ))}
      </div>
      <span id={id} className="text-[10px] text-slate-500 tabular-nums w-16 text-right">
        {len === 0 ? '' : labels[score]}
      </span>
    </div>
  );
}
