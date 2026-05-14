import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, PassphraseInput, Screen } from '../components/ui';
import {
  downloadBackup,
  importBackupReplacing,
  type ImportSummary,
} from '../core/backup';

export default function Backup() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [exportPw, setExportPw] = useState('');
  const [importPw, setImportPw] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function handleExport() {
    if (exportPw.length < 8) {
      setError('Use at least 8 characters');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await downloadBackup(exportPw);
      setMessage('Backup file generated. The file is encrypted — keep the passphrase somewhere only you can reach.');
      setExportPw('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!pendingFile) return;
    setError(null);
    setMessage(null);
    setSummary(null);
    const ok = window.confirm(
      'This will replace all data on this device with the backup. Continue?',
    );
    if (!ok) return;
    setBusy(true);
    try {
      const result = await importBackupReplacing(pendingFile, importPw);
      setSummary(result);
      setImportPw('');
      setPendingFile(null);
      setMessage('Import succeeded.');
      setTimeout(() => navigate('/', { replace: true }), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <Screen>
      <div className="max-w-md mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-slate-100">
            ← Back
          </button>
          <h1 className="text-xl font-semibold">Backup / Migrate</h1>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <div className="space-y-1">
            <h2 className="font-medium">Export backup</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Generates an encrypted <code>.gicca</code> file with every card,
              photo, and transaction. Pick a passphrase you'll remember —{' '}
              <strong className="text-amber-300">there is no recovery</strong>{' '}
              without it.
            </p>
          </div>
          <PassphraseInput
            label="Export passphrase"
            value={exportPw}
            onChange={setExportPw}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
          <Button className="w-full" onClick={handleExport} disabled={busy || !exportPw}>
            {busy ? 'Working…' : 'Export'}
          </Button>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <div className="space-y-1">
            <h2 className="font-medium">Import from backup</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              <strong className="text-rose-400">Replaces all data on this device.</strong>
              {' '}Pick the <code>.gicca</code> file, then enter the passphrase
              it was exported with.
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".gicca,application/octet-stream"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPendingFile(f);
            }}
          />
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {pendingFile ? `File: ${pendingFile.name}` : 'Choose .gicca file'}
          </Button>
          {pendingFile && (
            <>
              <PassphraseInput
                label="Backup passphrase"
                value={importPw}
                onChange={setImportPw}
                placeholder="The passphrase used to export"
                autoComplete="off"
              />
              <Button
                variant="danger"
                className="w-full"
                onClick={handleImport}
                disabled={busy || !importPw}
              >
                {busy ? 'Importing…' : 'Replace local data'}
              </Button>
            </>
          )}
        </section>

        {message && <p className="text-sm text-emerald-400">{message}</p>}
        {summary && (
          <p className="text-xs text-slate-400">
            Imported {summary.cards} card(s), {summary.transactions} activity entries,
            {' '}{summary.attachments} photo(s), {summary.userMerchants} custom merchant(s).
          </p>
        )}
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </div>
    </Screen>
  );
}
