// Route entry for /cards/new. The actual UI lives in AddCardSheet so the
// CardList page can render the same form inline without a route change.

import { useNavigate } from 'react-router-dom';
import { AddCardSheet } from '../components/AddCardSheet';

export default function AddCard() {
  const navigate = useNavigate();
  return (
    <AddCardSheet
      onCreated={(card) => navigate(`/cards/${card.id}`, { replace: true })}
      onClose={() => navigate(-1)}
    />
  );
}
