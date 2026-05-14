// Camera-based code scanner modal. Lazy-imports @zxing/browser so the
// reader (and its ~280 KB dependency graph) only land when the user
// actually opens the scanner.

import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';
import type { CodeKind } from '../core/types';

type ZxingControls = { stop: () => void };

type Props = {
  onDetected: (value: string, kind: CodeKind) => void;
  onClose: () => void;
};

const QR_FAMILY = new Set(['QR_CODE', 'AZTEC', 'DATA_MATRIX', 'PDF_417', 'MAXICODE']);

export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let controls: ZxingControls | null = null;
    let cancelled = false;

    (async () => {
      try {
        const mod = await import('@zxing/browser');
        if (cancelled) return;
        if (!videoRef.current) return;
        const reader = new mod.BrowserMultiFormatReader();
        controls = (await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (!result) return;
            controls?.stop();
            if (cancelled) return;
            const kind: CodeKind = QR_FAMILY.has(result.getBarcodeFormat().toString())
              ? 'qrcode'
              : 'barcode';
            onDetected(result.getText(), kind);
          },
        )) as ZxingControls;
        setStarting(false);
      } catch (e) {
        if (cancelled) return;
        setError(messageFromError(e));
        setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <header className="flex items-center justify-between p-4 text-white">
        <button onClick={onClose} className="text-sm">
          Cancel
        </button>
        <span className="text-sm text-white/70">Aim at the code</span>
        <span className="w-12" />
      </header>

      <div className="flex-1 relative flex items-center justify-center">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        {starting && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-white/80 text-sm">Starting camera…</p>
          </div>
        )}
        {!starting && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-72 max-w-[80%] aspect-[3/2] border-2 border-white/70 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 space-y-2 text-center">
          <p className="text-rose-400 text-sm">{error}</p>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </div>
  );
}

function messageFromError(e: unknown): string {
  if (!(e instanceof Error)) return 'Could not access the camera';
  if (e.name === 'NotAllowedError') return 'Camera permission denied';
  if (e.name === 'NotFoundError') return 'No camera available on this device';
  if (e.name === 'NotReadableError') return 'Camera is in use by another app';
  if (e.name === 'SecurityError') return 'Camera requires an HTTPS connection';
  return e.message || 'Could not access the camera';
}
