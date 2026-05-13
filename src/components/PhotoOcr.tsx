// OCR-from-photo modal. Tesseract.js is dynamic-imported only when this
// component mounts. The worker.js, wasm and English language model
// (~12 MB combined) load from Tesseract's CDN on first use and are cached
// in IndexedDB by Tesseract itself — every subsequent scan is instant
// and offline.
//
// We're not trying to be a full receipt-recognizer here; the goal is to
// extract obvious long digit sequences (probably a card number) and short
// 4-8 digit groups (probably a PIN) so the user can confirm and import.

import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';

export type OcrResult = {
  cardNumber?: string;
  pin?: string;
  fullText: string;
};

type Props = {
  onResult: (r: OcrResult) => void;
  onClose: () => void;
};

type Stage = 'pick' | 'preview' | 'working' | 'done' | 'error';

export function PhotoOcr({ onResult, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [stage, setStage] = useState<Stage>('pick');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('Initializing…');
  const [extractedText, setExtractedText] = useState('');
  const [candidates, setCandidates] = useState<{ cardNumber?: string; pin?: string }>({});
  const [error, setError] = useState<string | null>(null);

  // Auto-open file picker on mount — fewer taps to reach what the user wants.
  useEffect(() => {
    if (stage === 'pick' && fileRef.current) fileRef.current.click();
  }, [stage]);

  // Revoke blob URL when leaving preview.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleFile(file: File | null) {
    if (!file) {
      // User cancelled the picker — close the modal.
      onClose();
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setStage('working');
    setProgress(0);
    setProgressLabel('Loading OCR engine…');
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (typeof m.progress === 'number') setProgress(m.progress);
          if (m.status) setProgressLabel(m.status.replace(/_/g, ' '));
        },
      });
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const text = data.text || '';
      setExtractedText(text);
      const cand = parseCandidates(text);
      setCandidates(cand);
      setStage('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OCR failed');
      setStage('error');
    }
  }

  function confirm() {
    onResult({
      cardNumber: candidates.cardNumber,
      pin: candidates.pin,
      fullText: extractedText,
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col animate-[gicca-sheet-up_0.32s_cubic-bezier(0.2,0.85,0.3,1)_both]">
      <header className="flex items-center justify-between p-4 text-white">
        <button onClick={onClose} className="text-sm">
          Cancel
        </button>
        <span className="text-sm text-white/70">Scan text from photo</span>
        <span className="w-12" />
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {stage === 'pick' && (
          <p className="text-center text-slate-400 text-sm">Opening photo picker…</p>
        )}

        {(stage === 'working' || stage === 'done' || stage === 'error') && (
          <div className="space-y-4">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="card photo"
                className="w-full rounded-2xl max-h-64 object-cover"
              />
            )}

            {stage === 'working' && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span className="capitalize">{progressLabel}</span>
                  <span>{Math.round(progress * 100)}%</span>
                </div>
                <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-sky-500 transition-all"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 text-center mt-2">
                  First run downloads ~12 MB and is cached for offline use.
                </p>
              </div>
            )}

            {stage === 'done' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-slate-200">What we found</h3>
                  {candidates.cardNumber || candidates.pin ? (
                    <div className="rounded-xl border border-slate-700 bg-slate-900 divide-y divide-slate-800">
                      {candidates.cardNumber && (
                        <div className="p-3">
                          <div className="text-xs text-slate-500">Card number candidate</div>
                          <div className="font-mono text-slate-100 tabular-nums">
                            {candidates.cardNumber}
                          </div>
                        </div>
                      )}
                      {candidates.pin && (
                        <div className="p-3">
                          <div className="text-xs text-slate-500">PIN candidate</div>
                          <div className="font-mono text-slate-100 tabular-nums">
                            {candidates.pin}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-rose-400">
                      No digit sequences detected — check the photo and try again, or fill the form manually.
                    </p>
                  )}
                </div>
                {extractedText.trim() && (
                  <details className="text-xs">
                    <summary className="text-slate-500 cursor-pointer">Full recognized text</summary>
                    <pre className="mt-2 whitespace-pre-wrap text-slate-400 max-h-40 overflow-y-auto">
                      {extractedText}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {stage === 'error' && (
              <p className="text-rose-400 text-sm">{error}</p>
            )}
          </div>
        )}
      </div>

      <footer className="p-4 border-t border-slate-800 flex gap-2">
        {stage === 'done' && (candidates.cardNumber || candidates.pin) && (
          <Button className="flex-1" onClick={confirm}>
            Use these
          </Button>
        )}
        {(stage === 'done' || stage === 'error') && (
          <Button
            variant="secondary"
            className={stage === 'done' && (candidates.cardNumber || candidates.pin) ? '' : 'flex-1'}
            onClick={() => {
              setStage('pick');
              setCandidates({});
              setExtractedText('');
              setProgress(0);
              setProgressLabel('Initializing…');
              setError(null);
              if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
              }
            }}
          >
            Pick another photo
          </Button>
        )}
      </footer>
    </div>
  );
}

/**
 * Heuristic: card numbers are usually 13-19 contiguous digits (possibly
 * with spaces / dashes); PINs are usually 4-8 contiguous digits in
 * isolation. We pick the longest digit run as the card number and the
 * shortest unrelated 4-8 run as the PIN.
 */
function parseCandidates(text: string): { cardNumber?: string; pin?: string } {
  const normalized = text.replace(/[–—]/g, '-');

  // Long sequences first — coalesce groups split by single spaces/dashes.
  const longRuns: string[] = [];
  const longRegex = /(?:\d[\s-]?){12,}\d/g;
  let m: RegExpExecArray | null;
  while ((m = longRegex.exec(normalized))) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length >= 12 && digits.length <= 19) longRuns.push(digits);
  }
  longRuns.sort((a, b) => b.length - a.length);
  const cardNumber = longRuns[0];

  // Then look for short isolated runs that aren't part of the picked card number.
  const shortRuns: string[] = [];
  const shortRegex = /(?<![\d])(\d{4,8})(?![\d])/g;
  while ((m = shortRegex.exec(normalized))) {
    const seq = m[1]!;
    if (cardNumber && cardNumber.includes(seq)) continue;
    shortRuns.push(seq);
  }
  // Prefer 4-digit (most common PIN length) but accept up to 8.
  shortRuns.sort((a, b) => a.length - b.length);
  const pin = shortRuns[0];

  return { cardNumber, pin };
}
