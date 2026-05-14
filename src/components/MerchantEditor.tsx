// Modal editor for a merchant's display fields (name + color).
//
// Reused by Settings for:
//   - customizing a builtin (saves a user merchant with the same id;
//     existing user-wins lookup makes it the active record)
//   - editing an existing user merchant
//   - resetting a customized builtin back to the shipped defaults
//     (deletes the user override so the builtin shines through)

import { useState } from 'react';
import { Button, Input } from './ui';
import { deleteUserMerchant, saveUserMerchant } from '../core/merchants';
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
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      await saveUserMerchant({
        ...merchant,
        name: name.trim() || merchant.name,
        color,
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
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
            aria-hidden="true"
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
