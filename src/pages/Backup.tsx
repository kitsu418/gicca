import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Screen } from '../components/ui';
import {
  downloadBackup,
  importBackupReplacing,
  readBackup,
  type ImportSummary,
} from '../core/backup';

export default function Backup() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function handleExport() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await downloadBackup();
      setMessage('Backup file generated. Store it somewhere only you can reach — it is not encrypted.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File) {
    setError(null);
    setMessage(null);
    setSummary(null);
    setBusy(true);
    try {
      const parsed = await readBackup(file);
      const exportedAt = new Date(parsed.exportedAt).toLocaleString();
      const ok = window.confirm(
        `This will replace all data on this device.\nBackup date: ${exportedAt}\nCards: ${parsed.payload.cards.length}\n\nContinue?`,
      );
      if (!ok) {
        setBusy(false);
        return;
      }
      const result = await importBackupReplacing(file);
      setSummary(result);
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
              Generates a <code>.gicca</code> file with every card, photo, and
              transaction. <strong className="text-amber-300">The file is
              plaintext</strong> — anyone with the file can read your card
              numbers. Save it somewhere private.
            </p>
          </div>
          <Button className="w-full" onClick={handleExport} disabled={busy}>
            {busy ? 'Working…' : 'Export'}
          </Button>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <div className="space-y-1">
            <h2 className="font-medium">Import from backup</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              <strong className="text-rose-400">Replaces all data on this device.</strong>
              {' '}Use for migrating to a new device.
            </p>
          </div>
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
            variant="danger"
            className="w-full"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {busy ? 'Working…' : 'Choose .gicca file'}
          </Button>
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
