// In-memory session state for the unlocked vault.
//
// Holds the DEK while the user is unlocked. Notifies subscribers (used by
// React `useSyncExternalStore` to drive re-renders) when the lock state
// changes. Also runs an optional inactivity auto-lock timer.

type Listener = () => void;

type SessionState = {
  unlocked: boolean;
  dekRaw: Uint8Array | null;
  dekKey: CryptoKey | null;
};

let state: SessionState = { unlocked: false, dekRaw: null, dekKey: null };
const listeners = new Set<Listener>();

let autoLockMs = 5 * 60 * 1000; // 5 minutes default
let autoLockTimer: ReturnType<typeof setTimeout> | null = null;

function emit(): void {
  for (const fn of listeners) fn();
}

function clearTimer(): void {
  if (autoLockTimer) {
    clearTimeout(autoLockTimer);
    autoLockTimer = null;
  }
}

function armTimer(): void {
  clearTimer();
  if (state.unlocked && autoLockMs > 0) {
    autoLockTimer = setTimeout(() => lockSession(), autoLockMs);
  }
}

export function unlockSession(dekRaw: Uint8Array, dekKey: CryptoKey): void {
  state = { unlocked: true, dekRaw, dekKey };
  armTimer();
  emit();
}

export function lockSession(): void {
  if (state.dekRaw) state.dekRaw.fill(0);
  state = { unlocked: false, dekRaw: null, dekKey: null };
  clearTimer();
  emit();
}

export function getDek(): CryptoKey | null {
  return state.dekKey;
}

export function getDekRaw(): Uint8Array | null {
  return state.dekRaw;
}

export function isUnlocked(): boolean {
  return state.unlocked;
}

export function requireDek(): CryptoKey {
  if (!state.dekKey) throw new Error('vault is locked');
  return state.dekKey;
}

/** Caller invokes this on any user interaction to extend the auto-lock window. */
export function touchActivity(): void {
  if (state.unlocked) armTimer();
}

export function setAutoLockMs(ms: number): void {
  autoLockMs = Math.max(0, ms);
  armTimer();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Snapshot used by `useSyncExternalStore`. Returns a stable reference between
// emit() calls so React's identity check doesn't trigger spurious re-renders.
export function getSnapshot(): SessionState {
  return state;
}
