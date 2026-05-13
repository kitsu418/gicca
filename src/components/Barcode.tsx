// Renders a barcode for checkout.
//
// Replaces the previous monolithic bwip-js (~260 KB gzip) with two
// lazy-loaded specialist libraries:
//
//   - jsbarcode (~5 KB gzip) for 1D formats (Code 128 / Code 39 / EAN-13 /
//     UPC-A and friends)
//   - qrcode    (~15 KB gzip) for QR
//
// Each library only ships when its first card is opened, so the initial
// install stays tight. Formats we don't have a renderer for (PDF417 /
// Aztec / Data Matrix) show a friendly fallback rather than nothing —
// gift cards almost never use those.

import { useEffect, useRef, useState } from 'react';
import type { BarcodeFormat } from '../core/types';

type Props = {
  format: BarcodeFormat;
  value: string;
  scale?: number;
  className?: string;
  light?: boolean;
};

const JSBARCODE_FORMATS: Partial<Record<BarcodeFormat, string>> = {
  CODE128: 'CODE128',
  CODE39: 'CODE39',
  EAN13: 'EAN13',
  UPCA: 'UPC',
};

export function Barcode({ format, value, scale = 3, className = '', light = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        if (format === 'QR') {
          const QRCode = await import('qrcode');
          if (cancelled) return;
          await QRCode.toCanvas(canvas, value, {
            margin: 1,
            scale: Math.max(2, scale * 2),
            color: { dark: '#000000', light: light ? '#ffffff' : '#00000000' },
          });
        } else if (JSBARCODE_FORMATS[format]) {
          const mod = await import('jsbarcode');
          if (cancelled) return;
          const JsBarcode = mod.default;
          JsBarcode(canvas, value, {
            format: JSBARCODE_FORMATS[format],
            width: scale,
            height: 80,
            displayValue: true,
            margin: 8,
            background: light ? '#ffffff' : 'transparent',
            lineColor: '#000000',
            font: 'monospace',
          });
        } else {
          setError(`Format ${format} not supported on this build`);
        }
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
