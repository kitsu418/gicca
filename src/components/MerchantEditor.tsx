// Modal editor for a merchant's display fields (name, color, logo).
//
// Reused by Settings for:
//   - customizing a builtin (saves a user merchant with the same id;
//     existing user-wins lookup makes it the active record)
//   - editing an existing user merchant
//   - resetting a customized builtin back to the shipped defaults
//     (deletes the user override so the builtin shines through)

import { useRef, useState } from 'react';
import { Button, Input } from './ui';
import { MerchantBadge } from './MerchantBadge';
import { deleteUserMerchant, saveUserMerchant } from '../core/merchants';
import { fileToDataUrl, normalizeLogoInput } from '../core/merchantLogoInput';
import type { MerchantDefinition } from '../core/types';

type Props = {
  /** The merchant the user clicked on (may be a builtin or a user record). */
  merchant: MerchantDefinition;
  /** True iff a builtin with this id exists (so reset is meaningful). */
  builtinExists: boolean;
  onClose: () => void;
};

export function MerchantEditor({ merchant, builtinExists, onClose }: Props) {
  const [name, setName] = useState(merchant.name);
  const [color, setColor] = useState(merchant.color ?? '#0ea5e9');
  const [logo, setLogo] = useState(merchant.logo ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    setError(null);
    try {
      setLogo(await fileToDataUrl(file));
    } catch {
      setError('Could not read file');
    }
  }

  async function handleSave() {
    setError(null);
    let normalizedLogo: string | null = null;
    if (logo) {
      normalizedLogo = normalizeLogoInput(logo);
      if (!normalizedLogo) {
        setError('Logo input not recognized (need SVG, image URL, or data URL)');
        return;
      }
    }
    setBusy(true);
    try {
      await saveUserMerchant({
        ...merchant,
        name: name.trim() || merchant.name,
        color,
        logo: normalizedLogo ?? undefined,
        source: 'user',
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleResetToBuiltin() {
    if (!window.confirm('Revert this merchant to the built-in version?')) return;
    setBusy(true);
    try {
      await deleteUserMerchant(merchant.id);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this custom merchant? Existing cards keep their merchant-name snapshot.')) return;
    setBusy(true);
    try {
      await deleteUserMerchant(merchant.id);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const previewSrc = logo
    ? logo.startsWith('<') ? (normalizeLogoInput(logo) ?? '') : logo
    : '';

  // A merchant we can offer "Reset to built-in" on must (a) actually have a
  // built-in upstream, and (b) currently be a user record overriding it.
  const canReset = builtinExists && merchant.source === 'user';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <MerchantBadge
            merchant={{
              id: merchant.id,
              name: name || merchant.name,
              color,
              logo: previewSrc || undefined,
            }}
            size={44}
          />
          <div className="min-w-0">
            <h2 className="font-medium truncate">{merchant.name}</h2>
            <p className="text-xs text-slate-500">
              {merchant.source === 'builtin' ? 'Built-in' : 'Custom'}
              {canReset && ' · overriding built-in'}
            </p>
          </div>
        </div>

        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />

        <label className="flex items-center gap-2 text-sm text-slate-300">
          Color
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-12 rounded border border-slate-700 bg-slate-900"
          />
          <span className="font-mono text-xs text-slate-500">{color.toUpperCase()}</span>
        </label>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-slate-200">Logo</span>
          <textarea
            value={logo}
            onChange={(e) => {
              setLogo(e.target.value);
              setError(null);
            }}
            rows={3}
            placeholder="Paste SVG, image URL, or data URL — leave blank to use the default glyph"
            spellCheck={false}
            className="block w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 font-mono"
          />
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs text-sky-400 hover:text-sky-300"
            >
              Upload an image
            </button>
            {logo && (
              <button
                type="button"
                onClick={() => setLogo('')}
                className="text-xs text-slate-500 hover:text-slate-300 ml-auto"
              >
                Clear
              </button>
            )}
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {canReset ? (
            <Button variant="ghost" onClick={handleResetToBuiltin} disabled={busy}>
              Reset to built-in
            </Button>
          ) : (
            merchant.source === 'user' && !builtinExists && (
              <Button variant="ghost" onClick={handleDelete} disabled={busy}>
                Delete
              </Button>
            )
          )}
          <Button className="flex-1" onClick={handleSave} disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
