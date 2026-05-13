import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, CenteredCard, Input } from '../components/ui';
import { meta, wipeAll } from '../core/db';
import { setupVault } from '../core/vault/vault';
import { getDekRaw, lockSession, unlockSession } from '../core/vault/session';
import { isBiometricSupported, registerBiometric } from '../core/vault/biometric';
import { importBackupReplacing, readBackup } from '../core/backup';
import { refreshVaultStatus } from '../hooks/useVaultStatus';

type Step = 'welcome' | 'password' | 'recovery';

export default function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('welcome');
  const [recoveryCode, setRecoveryCode] = useState<string[] | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  // Step 2 state
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Step 3 (biometric) state
  const [bioSupported, setBioSupported] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);

  // Import-from-backup state
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    isBiometricSupported().then(setBioSupported);
  }, []);

  async function handleImport(file: File) {
    setImportError(null);
    try {
      const parsed = await readBackup(file);
      const ok = window.confirm(
        `Import the backup from ${new Date(parsed.exportedAt).toLocaleString()} containing ${parsed.payload.cards.length} card(s)?`,
      );
      if (!ok) return;
      await importBackupReplacing(file);
      lockSession();
      refreshVaultStatus();
      navigate('/unlock', { replace: true });
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function enableBiometric() {
    setBioError(null);
    const dek = getDekRaw();
    if (!dek) {
      setBioError('Vault is locked');
      return;
    }
    const platform =
      /Mac|iPhone|iPad/.test(navigator.platform) ? 'Apple device' :
      /Win/.test(navigator.platform) ? 'Windows device' :
      /Android/.test(navigator.userAgent) ? 'Android device' : 'This device';
    const result = await registerBiometric(dek, platform);
    if (result.ok) {
      setBioEnabled(true);
    } else {
      const messages: Record<string, string> = {
        unsupported: 'Biometric unlock is not supported by this browser',
        prf_unsupported: 'This browser does not support the WebAuthn PRF extension',
        cancelled: 'Cancelled',
        failed: 'Registration failed',
      };
      setBioError(messages[result.reason] ?? 'Registration failed');
    }
  }

  async function handleCreate() {
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      // Clear any half-built vault from a prior interrupted setup.
      await wipeAll();
      const { dekRaw, dekKey, recoveryCode } = await setupVault(password);
      unlockSession(dekRaw, dekKey);
      setRecoveryCode(recoveryCode);
      setStep('recovery');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create vault');
    } finally {
      setBusy(false);
    }
  }

  async function handleFinish() {
    await meta.set('hasSetup', true);
    await meta.set('schemaVersion', 1);
    await meta.set('autoLockMs', 5 * 60 * 1000);
    refreshVaultStatus();
    navigate('/', { replace: true });
  }

  async function copyRecovery() {
    if (!recoveryCode) return;
    await navigator.clipboard.writeText(recoveryCode.join(' '));
  }

  return (
    <CenteredCard>
      {step === 'welcome' && (
        <div className="space-y-5">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Welcome to Gicca</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              A local-first vault for gift cards. Card numbers and PINs are
              encrypted on this device with your master password — Gicca has
              no servers and never uploads your data.
            </p>
          </div>
          <ul className="space-y-3 text-sm text-slate-300">
            <li className="flex gap-3">
              <span className="text-sky-400">1</span>
              <span>Pick a master password (at least 8 characters)</span>
            </li>
            <li className="flex gap-3">
              <span className="text-sky-400">2</span>
              <span>Save a recovery code — the only way back if you forget the password</span>
            </li>
            <li className="flex gap-3">
              <span className="text-sky-400">3</span>
              <span>Start adding gift cards</span>
            </li>
          </ul>
          <Button className="w-full" onClick={() => setStep('password')}>
            Get started
          </Button>
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept=".gicca,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImport(f);
              }}
            />
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => fileRef.current?.click()}
            >
              Restore from backup
            </Button>
            {importError && <p className="text-xs text-rose-400">{importError}</p>}
          </div>
        </div>
      )}

      {step === 'password' && (
        <div className="space-y-5">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Set a master password</h1>
            <p className="text-slate-400 text-sm">
              The master password encrypts everything on this device. Use a long,
              memorable phrase you don't use elsewhere.
              <strong className="text-rose-400"> The password cannot be recovered</strong> —
              only the recovery code can rescue your data.
            </p>
          </div>
          <Input
            label="Master password"
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            hint={`${password.length} characters`}
          />
          <Input
            label="Confirm password"
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
              className="accent-sky-500"
            />
            Show password
          </label>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('welcome')}>
              Back
            </Button>
            <Button className="flex-1" disabled={busy} onClick={handleCreate}>
              {busy ? 'Creating…' : 'Create vault'}
            </Button>
          </div>
        </div>
      )}

      {step === 'recovery' && recoveryCode && (
        <div className="space-y-5">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Save your recovery code</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              These 12 words are your recovery code.
              <strong className="text-rose-400"> If you forget your master password, this code is the only way to get your data back.</strong>
              {' '}Screenshot it, write it down, or save it in a password manager.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-700 bg-slate-900 p-4 font-mono">
            {recoveryCode.map((w, i) => (
              <div key={i} className="flex items-baseline gap-2 text-sm">
                <span className="text-slate-500 tabular-nums w-5 text-right">{i + 1}.</span>
                <span className="text-slate-100">{w}</span>
              </div>
            ))}
          </div>
          <Button variant="secondary" className="w-full" onClick={copyRecovery}>
            Copy to clipboard
          </Button>
          <label className="flex items-start gap-3 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1 accent-sky-500"
            />
            <span>I've saved the recovery code somewhere safe. I understand losing it means losing access to my data.</span>
          </label>

          {bioSupported && (
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-3">
              <div className="space-y-1">
                <h2 className="text-sm font-medium text-slate-100">
                  Quick unlock (optional)
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Register a passkey on this device to unlock with Face ID,
                  Touch ID, or Windows Hello. The key lives in the device's
                  secure enclave — Gicca never sees it.
                </p>
              </div>
              {bioEnabled ? (
                <p className="text-sm text-emerald-400">Biometric unlock enabled</p>
              ) : (
                <Button variant="secondary" className="w-full" onClick={enableBiometric}>
                  Enable biometric unlock
                </Button>
              )}
              {bioError && <p className="text-xs text-rose-400">{bioError}</p>}
            </div>
          )}

          <Button
            className="w-full"
            disabled={!acknowledged}
            onClick={handleFinish}
          >
            Enter app
          </Button>
        </div>
      )}
    </CenteredCard>
  );
}
