// Inline merchant picker used by the card form.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input } from './ui';
import { MerchantBadge } from './MerchantBadge';
import {
  saveUserMerchant,
  searchMerchants,
  useMerchants,
} from '../core/merchants';
import { fileToDataUrl, normalizeLogoInput } from '../core/merchantLogoInput';
import type { MerchantDefinition } from '../core/types';

type Props = {
  value: MerchantDefinition | null;
  onChange: (m: MerchantDefinition) => void;
};

export function MerchantPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#0ea5e9');
  const [newLogo, setNewLogo] = useState('');
  const [logoError, setLogoError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const logoFileRef = useRef<HTMLInputElement | null>(null);

  const allMerchants = useMerchants();
  const results = useMemo(
    () => searchMerchants(query, 100),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, allMerchants],
  );

  const exactExists = results.some(
    (m) => m.name.toLowerCase() === query.trim().toLowerCase(),
  );

  // Click-outside + Escape close the panel without picking anything.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(e.target as Node)) {
        setOpen(false);
        resetCreate();
        setQuery('');
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        resetCreate();
        setQuery('');
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function resetCreate() {
    setCreating(false);
    setNewName('');
    setNewColor('#0ea5e9');
    setNewLogo('');
    setLogoError(null);
  }

  function pick(m: MerchantDefinition) {
    onChange(m);
    setOpen(false);
    setQuery('');
    resetCreate();
  }

  async function handleLogoFile(file: File) {
    setLogoError(null);
    try {
      const url = await fileToDataUrl(file);
      setNewLogo(url);
    } catch {
      setLogoError('Could not read file');
    }
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const normalizedLogo = newLogo ? normalizeLogoInput(newLogo) : null;
    if (newLogo && !normalizedLogo) {
      setLogoError('Logo input not recognized (need SVG, image URL, or data URL)');
      return;
    }
    const id = `user-${crypto.randomUUID().slice(0, 8)}`;
    const merchant: MerchantDefinition = {
      id,
      name,
      color: newColor,
      logo: normalizedLogo ?? undefined,
      category: 'other',
      version: 1,
      source: 'user',
    };
    await saveUserMerchant(merchant);
    pick(merchant);
  }

  const previewSrc = newLogo
    ? newLogo.startsWith('<') ? (normalizeLogoInput(newLogo) ?? '') : newLogo
    : '';

  return (
    <div ref={rootRef} className="relative">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-left hover:border-slate-600"
        >
          {value ? (
            <>
              <MerchantBadge merchant={value} size={36} />
              <span className="font-medium truncate">{value.name}</span>
            </>
          ) : (
            <span className="text-slate-500">Pick a merchant…</span>
          )}
        </button>
      ) : (
        <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
          <div className="p-2 border-b border-slate-700/60">
            <Input
              placeholder="Search merchants…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {results.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-slate-500">
                No merchants match
              </div>
            )}
            {results.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => pick(m)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800 text-left"
              >
                <MerchantBadge merchant={m} size={32} />
                <span className="font-medium text-sm truncate flex-1">{m.name}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-slate-700/60 p-2">
            {!creating ? (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setCreating(true);
                  if (query && !exactExists) setNewName(query);
                }}
              >
                + New merchant{query && !exactExists ? ` "${query}"` : ''}
              </Button>
            ) : (
              <div className="space-y-3 p-2">
                <Input
                  label="Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  Color
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="h-8 w-12 rounded border border-slate-700 bg-slate-900"
                  />
                </label>
                <div className="space-y-1.5">
                  <span className="block text-sm font-medium text-slate-200">
                    Logo (optional)
                  </span>
                  <textarea
                    value={newLogo}
                    onChange={(e) => {
                      setNewLogo(e.target.value);
                      setLogoError(null);
                    }}
                    rows={2}
                    placeholder="Paste SVG, image URL, or data URL"
                    spellCheck={false}
                    className="block w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 font-mono"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      ref={logoFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleLogoFile(f);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => logoFileRef.current?.click()}
                      className="text-xs text-sky-400 hover:text-sky-300"
                    >
                      Or upload an image
                    </button>
                    {previewSrc && (
                      <span className="ml-auto flex items-center gap-2">
                        <span className="text-xs text-slate-500">Preview:</span>
                        <span
                          className="h-8 w-8 rounded-md flex items-center justify-center overflow-hidden"
                          style={{ backgroundColor: newColor }}
                        >
                          <img src={previewSrc} alt="" className="h-5 w-5 object-contain" />
                        </span>
                      </span>
                    )}
                  </div>
                  {logoError && <p className="text-xs text-rose-400">{logoError}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={resetCreate}>
                    Cancel
                  </Button>
                  <Button className="flex-1" disabled={!newName.trim()} onClick={handleCreate}>
                    Create & use
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
