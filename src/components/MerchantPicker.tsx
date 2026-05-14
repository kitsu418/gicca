// Inline merchant picker used by the card form.
//
// Behaviour:
//   - The "trigger" shows the currently selected merchant (or a placeholder).
//   - Tap to open a panel with a search field + scrolling list.
//   - Picking a merchant collapses the panel automatically.
//   - Clicking outside the panel or pressing Esc also collapses it.
//   - If no match exists, an inline "New merchant" affordance lets the user
//     create one without leaving the form.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input } from './ui';
import { MerchantBadge } from './MerchantBadge';
import {
  saveUserMerchant,
  searchMerchants,
  useMerchants,
} from '../core/merchants';
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
  const rootRef = useRef<HTMLDivElement | null>(null);

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
        setCreating(false);
        setQuery('');
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setCreating(false);
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

  function pick(m: MerchantDefinition) {
    onChange(m);
    setOpen(false);
    setQuery('');
    setCreating(false);
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const id = `user-${crypto.randomUUID().slice(0, 8)}`;
    const merchant: MerchantDefinition = {
      id,
      name,
      color: newColor,
      category: 'other',
      version: 1,
      source: 'user',
    };
    await saveUserMerchant(merchant);
    pick(merchant);
    setNewName('');
    setNewColor('#0ea5e9');
  }

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
              <div className="space-y-2 p-2">
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
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCreating(false);
                      setNewName('');
                    }}
                  >
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
