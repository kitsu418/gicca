import { useEffect, useState } from 'react';
import { hasVault } from '../core/vault/vault';
import { meta } from '../core/db';

export type VaultStatus =
  | { state: 'loading' }
  | { state: 'unset' } // no vault yet → /setup
  | { state: 'incomplete' } // vault exists but setup not finalized → wipe + /setup
  | { state: 'ready' }; // vault exists, ready to unlock

export function useVaultStatus(): VaultStatus {
  const [status, setStatus] = useState<VaultStatus>({ state: 'loading' });

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
  }, []);

  return status;
}
