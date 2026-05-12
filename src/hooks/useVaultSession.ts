import { useSyncExternalStore } from 'react';
import { getSnapshot, subscribe } from '../core/vault/session';

export function useVaultSession() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
