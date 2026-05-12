import { useEffect, useState } from 'react';
import { hasVault } from '../core/vault/vault';
import { meta } from '../core/db';

export type VaultStatus =
  | { state: 'loading' }
  | { state: 'unset' } // no vault yet → /setup
  | { state: 'incomplete' } // vault exists but setup not finalized → wipe + /setup
  | { state: 'ready' }; // vault exists, ready to unlock

// Module-level pub/sub so any module (e.g. the setup flow) can trigger a
// re-probe of IndexedDB after it mutates vault/meta state.
const subscribers = new Set<() => void>();

export function refreshVaultStatus(): void {
  for (const fn of subscribers) fn();
}

export function useVaultStatus(): VaultStatus {
  const [status, setStatus] = useState<VaultStatus>({ state: 'loading' });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    subscribers.add(bump);
    return () => {
      subscribers.delete(bump);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const exists = await hasVault();
      if (cancelled) return;
      if (!exists) {
        setStatus({ state: 'unset' });
        return;
      }
      const finalized = await meta.get('hasSetup');
      if (cancelled) return;
      setStatus({ state: finalized ? 'ready' : 'incomplete' });
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return status;
}
