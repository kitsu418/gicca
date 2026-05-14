import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import CardList from './pages/CardList';
import CardDetail from './pages/CardDetail';
import AddCard from './pages/AddCard';
import EditCard from './pages/EditCard';
import Backup from './pages/Backup';
import Settings from './pages/Settings';
import { UpdateBanner } from './components/UpdateBanner';
import { requestPersistentStorage } from './core/storage';
import { applyTheme, loadTheme } from './core/theme';

export default function App() {
  // Ask the browser to make our IndexedDB persistent so it isn't evicted
  // under storage pressure. Fires once per boot, idempotent, silent on
  // denial. See core/storage.ts for the rationale.
  useEffect(() => {
    void requestPersistentStorage();
    void loadTheme().then(applyTheme);
  }, []);

  return (
    <>
      <Routes>
        <Route path="/" element={<CardList />} />
        <Route path="/cards/new" element={<AddCard />} />
        <Route path="/cards/:id" element={<CardDetail />} />
        <Route path="/cards/:id/edit" element={<EditCard />} />
        <Route path="/backup" element={<Backup />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <UpdateBanner />
    </>
  );
}
