import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import Setup from './pages/Setup';
import Unlock from './pages/Unlock';
import Home from './pages/Home';
import { CenteredCard } from './components/ui';
import { useVaultSession } from './hooks/useVaultSession';
import { refreshVaultStatus, useVaultStatus } from './hooks/useVaultStatus';
import { useAutoLock } from './hooks/useAutoLock';
import { wipeAll } from './core/db';

export default function App() {
  const status = useVaultStatus();
  const session = useVaultSession();
  useAutoLock();

  // If a previous setup was interrupted before the user could acknowledge
  // the recovery code, scrap the half-built vault so the user lands cleanly
  // on /setup again. This is safe — no real data has been written yet.
  useEffect(() => {
    if (status.state === 'incomplete') {
      wipeAll().then(refreshVaultStatus);
    }
  }, [status.state]);

  if (status.state === 'loading') {
    return (
      <CenteredCard>
        <div className="text-center text-slate-500 text-sm">加载中…</div>
      </CenteredCard>
    );
  }

  return (
    <Routes>
      <Route
        path="/setup"
        element={
          status.state === 'unset' || status.state === 'incomplete' ? (
            <Setup />
          ) : (
            <Navigate to={session.unlocked ? '/' : '/unlock'} replace />
          )
        }
      />
      <Route
        path="/unlock"
        element={
          status.state !== 'ready' ? (
            <Navigate to="/setup" replace />
          ) : session.unlocked ? (
            <Navigate to="/" replace />
          ) : (
            <Unlock />
          )
        }
      />
      <Route
        path="/*"
        element={
          status.state !== 'ready' ? (
            <Navigate to="/setup" replace />
          ) : !session.unlocked ? (
            <Navigate to="/unlock" replace />
          ) : (
            <Home />
          )
        }
      />
    </Routes>
  );
}
