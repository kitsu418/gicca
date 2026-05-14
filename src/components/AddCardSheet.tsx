// Add-card form rendered as an inline sheet. Used by both the legacy
// /cards/new route and the CardList's inline "+ Add gift card" flow,
// so the same scanner + OCR + form lives in one place.

import { useState } from 'react';
import { Button, Screen } from './ui';
import { BarcodeScanner } from './BarcodeScanner';
import { PhotoOcr } from './PhotoOcr';
import { CardForm, type CardFormValues, type SubmittedCard } from '../pages/CardForm';
import { createCard } from '../core/cards';
import type { CardRecord } from '../core/types';

type Props = {
  onCreated: (card: CardRecord) => void;
  onClose: () => void;
};

export function AddCardSheet({ onCreated, onClose }: Props) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [prefill, setPrefill] = useState<Partial<CardFormValues> | undefined>();

  async function handleSubmit(v: SubmittedCard) {
    const card = await createCard({
      merchant: v.merchant,
      cardNumber: v.cardNumber,
      pin: v.pin,
      note: v.note,
      barcode: v.barcode,
      qrcode: v.qrcode,
      initialValue: v.initialValue,
      balance: v.balance ?? v.initialValue,
      currency: v.currency,
      expiresAt: v.expiresAt,
    });
    onCreated(card);
  }

  return (
    <Screen className="[view-transition-name:gicca-add-sheet]">
      <div className="max-w-md mx-auto p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-slate-100"
          >
            ← Back
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setScannerOpen(true)}>
              Scan code
            </Button>
            <Button variant="secondary" onClick={() => setOcrOpen(true)}>
              Scan text
            </Button>
          </div>
        </div>
        <h1 className="text-xl font-semibold">Add gift card</h1>
        <CardForm submitLabel="Save" onSubmit={handleSubmit} prefill={prefill} />
      </div>

      {scannerOpen && (
        <BarcodeScanner
          onDetected={(value, kind) => {
            setPrefill({
              cardNumber: value,
              [kind]: value,
            } as Partial<CardFormValues>);
            setScannerOpen(false);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {ocrOpen && (
        <PhotoOcr
          onResult={(r) => {
            setPrefill({
              ...(r.cardNumber && { cardNumber: r.cardNumber }),
              ...(r.pin && { pin: r.pin }),
            });
            setOcrOpen(false);
          }}
          onClose={() => setOcrOpen(false)}
        />
      )}
    </Screen>
  );
}
