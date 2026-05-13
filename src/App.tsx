import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Setup from './pages/Setup';
import Unlock from './pages/Unlock';
import CardList from './pages/CardList';
import CardDetail from './pages/CardDetail';
import AddCard from './pages/AddCard';
import EditCard from './pages/EditCard';
import Backup from './pages/Backup';
import Settings from './pages/Settings';
import { UpdateBanner } from './components/UpdateBanner';
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

  if (status.state === 'unset' || status.state === 'incomplete') {
    return (
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  if (!session.unlocked) {
    return (
      <Routes>
        <Route path="/unlock" element={<Unlock />} />
        <Route path="*" element={<Navigate to="/unlock" replace />} />
      </Routes>
    );
  }

  return (
    <>
      <UnlockedRoutes />
      <UpdateBanner />
    </>
  );
}

function UnlockedRoutes() {
  // Send users away from /setup or /unlock once they're inside.
  const location = useLocation();
  if (location.pathname === '/setup' || location.pathname === '/unlock') {
    return <Navigate to="/" replace />;
  }
  return (
    <Routes>
      <Route path="/" element={<CardList />} />
      <Route path="/cards/new" element={<AddCard />} />
      <Route path="/cards/:id" element={<CardDetail />} />
      <Route path="/cards/:id/edit" element={<EditCard />} />
      <Route path="/backup" element={<Backup />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
