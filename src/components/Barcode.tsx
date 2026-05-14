// Renders a 1D barcode or a QR code.
//
// Only two render kinds exist now: 'barcode' (always Code 128, the
// universal 1D format that accepts any printable string) and 'qrcode'.
// jsbarcode and qrcode are lazy-loaded so the libs only ship when a
// card detail with a code is first opened.

import { useEffect, useRef, useState } from 'react';
import type { CodeKind } from '../core/types';

type Props = {
  kind: CodeKind;
  value: string;
  scale?: number;
  className?: string;
  light?: boolean;
};

export function Barcode({ kind, value, scale = 3, className = '', light = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        if (kind === 'qrcode') {
          const QRCode = await import('qrcode');
          if (cancelled) return;
          await QRCode.toCanvas(canvas, value, {
            margin: 1,
            scale: Math.max(2, scale * 2),
            color: { dark: '#000000', light: light ? '#ffffff' : '#00000000' },
          });
        } else {
          const mod = await import('jsbarcode');
          if (cancelled) return;
          mod.default(canvas, value, {
            format: 'CODE128',
            width: scale,
            height: 80,
            displayValue: true,
            margin: 8,
            background: light ? '#ffffff' : 'transparent',
            lineColor: '#000000',
            font: 'monospace',
          });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'render failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kind, value, scale, light]);

  if (error) {
    return (
      <div className={`text-xs text-rose-400 ${className}`}>
        {kind === 'qrcode' ? 'QR' : 'Barcode'} render failed: {error}
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
