// Renders a barcode for checkout. bwip-js supports the formats we care
// about (CODE128 / CODE39 / EAN13 / UPCA / PDF417 / QR / Aztec / Data Matrix);
// we lazy-load it so the ~50KB library is only fetched when a card detail
// page is actually opened.

import { useEffect, useRef, useState } from 'react';
import type { BarcodeFormat } from '../core/types';

type Props = {
  format: BarcodeFormat;
  value: string;
  // Width in CSS pixels of the canvas backing buffer. Height is derived from
  // the barcode type (1D barcodes are short and wide, 2D barcodes square).
  scale?: number;
  className?: string;
  /** Render on a white card so dark themes don't compress contrast. */
  light?: boolean;
};

const FORMAT_TO_BCID: Record<BarcodeFormat, string> = {
  CODE128: 'code128',
  CODE39: 'code39',
  EAN13: 'ean13',
  UPCA: 'upca',
  QR: 'qrcode',
  PDF417: 'pdf417',
  AZTEC: 'azteccode',
  DATAMATRIX: 'datamatrix',
};

export function Barcode({ format, value, scale = 3, className = '', light = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const mod = await import('bwip-js');
        const bwipjs = (mod.default ?? mod) as typeof import('bwip-js');
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        bwipjs.toCanvas(canvas, {
          bcid: FORMAT_TO_BCID[format],
          text: value,
          scale,
          height: format === 'QR' || format === 'AZTEC' || format === 'DATAMATRIX' ? undefined : 14,
          includetext: format !== 'QR' && format !== 'AZTEC' && format !== 'DATAMATRIX',
          textxalign: 'center',
          backgroundcolor: light ? 'FFFFFF' : undefined,
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'render failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [format, value, scale, light]);

  if (error) {
    return (
      <div className={`text-xs text-rose-400 ${className}`}>
        Barcode render failed: {error}
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`max-w-full h-auto ${light ? 'rounded-lg bg-white p-3' : ''} ${className}`}
    />
  );
}
