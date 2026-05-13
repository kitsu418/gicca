import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Screen } from '../components/ui';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { CardForm, type CardFormValues, type SubmittedCard } from './CardForm';
import { createCard } from '../core/cards';

export default function AddCard() {
  const navigate = useNavigate();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [prefill, setPrefill] = useState<Partial<CardFormValues> | undefined>();

  async function handleSubmit(v: SubmittedCard) {
    const card = await createCard({
      merchant: v.merchant,
      cardNumber: v.cardNumber,
      pin: v.pin,
      note: v.note,
      barcode: v.barcode,
      initialValue: v.initialValue,
      balance: v.balance ?? v.initialValue,
      currency: v.currency,
      expiresAt: v.expiresAt,
    });
    navigate(`/cards/${card.id}`, { replace: true });
  }

  return (
    <Screen>
      <div className="max-w-md mx-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-slate-400 hover:text-slate-100"
          >
            ← Back
          </button>
          <Button variant="secondary" onClick={() => setScannerOpen(true)}>
            Scan barcode
          </Button>
        </div>
        <h1 className="text-xl font-semibold">Add gift card</h1>
        <CardForm submitLabel="Save" onSubmit={handleSubmit} prefill={prefill} />
      </div>

      {scannerOpen && (
        <BarcodeScanner
          onDetected={(value, format) => {
            setPrefill({
              cardNumber: value,
              ...(format && { barcodeFormat: format, barcodeValue: '' }),
            });
            setScannerOpen(false);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </Screen>
  );
}
