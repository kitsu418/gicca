// Surfaces service worker updates so users running the installed PWA know to
// reload after a new deploy. The virtual module is provided by
// vite-plugin-pwa at build time.

import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './ui';

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err) {
      // SW registration can fail in dev under certain network conditions; we
      // don't want to break the page over it.
      console.warn('SW register failed', err);
    },
  });

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-40 rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur p-4 shadow-xl">
      {needRefresh ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-200">有新版本可用</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setNeedRefresh(false)}>
              稍后
            </Button>
            <Button onClick={() => updateServiceWorker(true)}>
              更新
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-300">已可离线使用</p>
          <Button variant="ghost" onClick={() => setOfflineReady(false)}>
            知道了
          </Button>
        </div>
      )}
    </div>
  );
}
