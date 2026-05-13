// Persistent storage request.
//
// By default the browser treats IndexedDB as "best-effort" — under storage
// pressure it can evict the data without warning. Requesting persistence
// flips this to "user-controlled": only an explicit clear by the user (or
// the user's OS) can remove it.
//
// The browser usually only grants persistence to "installed" PWAs or sites
// the user has interacted with substantially; first-time visitors are
// frequently denied. The call is idempotent and silent on denial, so we
// just fire it on every app boot and move on.

export type StorageInfo = {
  persistent: boolean;
  usageBytes?: number;
  quotaBytes?: number;
};

export async function requestPersistentStorage(): Promise<StorageInfo> {
  const info: StorageInfo = { persistent: false };
  const storage = navigator.storage;
  if (!storage) return info;

  if (typeof storage.persist === 'function') {
    try {
      info.persistent = await storage.persist();
    } catch {
      info.persistent = false;
    }
  } else if (typeof storage.persisted === 'function') {
    try {
      info.persistent = await storage.persisted();
    } catch {
      info.persistent = false;
    }
  }

  if (typeof storage.estimate === 'function') {
    try {
      const est = await storage.estimate();
      info.usageBytes = est.usage;
      info.quotaBytes = est.quota;
    } catch {
      // ignore
    }
  }
  return info;
}
