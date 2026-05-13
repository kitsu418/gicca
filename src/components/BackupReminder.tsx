// Shown on the card list when the local backup is stale (or never made).
// The reminder is dismissible per session via local component state — we
// don't persist the dismissal so users get re-nudged on the next visit.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { meta } from '../core/db';

const STALE_THRESHOLD_DAYS = 7;

type State =
  | { kind: 'loading' }
  | { kind: 'never' }
  | { kind: 'fresh'; days: number }
  | { kind: 'stale'; days: number };

export function BackupReminder({ hasCards }: { hasCards: boolean }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    meta.get('lastBackupAt').then((value) => {
      if (cancelled) return;
      if (typeof value !== 'string') {
        setState({ kind: 'never' });
        return;
      }
      const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
      setState({ kind: days >= STALE_THRESHOLD_DAYS ? 'stale' : 'fresh', days });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide while still probing, after dismissal, when the user has nothing
  // worth backing up yet, or when the backup is recent.
  if (state.kind === 'loading' || state.kind === 'fresh' || dismissed) return null;
  if (!hasCards) return null;

  const message =
    state.kind === 'never'
      ? "You haven't backed up yet."
      : `Last backup was ${state.days} days ago.`;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-amber-700/40 bg-amber-500/10 px-4 py-3 text-sm">
      <div className="flex-1 text-amber-200">
        <p>{message}</p>
        <p className="text-xs text-amber-300/70 mt-0.5">
          The encrypted backup file is your only recovery if this device fails.
        </p>
      </div>
      <Link
        to="/backup"
        className="shrink-0 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 font-medium px-3 py-1.5 text-xs"
      >
        Back up
      </Link>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-amber-300/60 hover:text-amber-200 text-xs"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
