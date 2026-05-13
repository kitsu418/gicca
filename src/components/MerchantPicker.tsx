// Inline merchant picker used by the card form.
//
// Behaviour:
//   - The "trigger" shows the currently selected merchant (or a placeholder).
//   - Tap to open a panel with a search field + scrolling list.
//   - If the query matches nothing exactly, a "新建商户" affordance appears.

import { useMemo, useState } from 'react';
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

  const allMerchants = useMerchants();
  const results = useMemo(
    () => searchMerchants(query, 100),
    // searchMerchants reads through listAllMerchants() each call, which itself
    // reads the live module-level user cache, so depending on `allMerchants`
    // keeps us in sync when a new user merchant is added.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, allMerchants],
  );

  const exactExists = results.some(
    (m) => m.name.toLowerCase() === query.trim().toLowerCase(),
  );

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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-left hover:border-slate-600"
      >
        {value ? (
          <>
            <MerchantBadge merchant={value} size={36} />
            <div className="min-w-0">
              <div className="font-medium truncate">{value.name}</div>
              {value.source === 'user' && (
                <div className="text-xs text-slate-500">自定义</div>
              )}
            </div>
          </>
        ) : (
          <span className="text-slate-500">选择商户…</span>
        )}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
      <div className="p-2 border-b border-slate-700/60">
        <Input
          placeholder="搜索商户…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>
      <div className="max-h-72 overflow-y-auto">
        {results.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-slate-500">
            没有匹配的商户
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
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate">{m.name}</div>
              {m.aliases && m.aliases.length > 0 && (
                <div className="text-xs text-slate-500 truncate">
                  {m.aliases.join(' · ')}
                </div>
              )}
            </div>
            {m.source === 'user' && (
              <span className="text-xs text-slate-500">自定义</span>
            )}
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
            + 新建商户{query && !exactExists ? `「${query}」` : ''}
          </Button>
        ) : (
          <div className="space-y-2 p-2">
            <Input
              label="名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <label className="flex items-center gap-2 text-sm text-slate-300">
              颜色
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
                取消
              </Button>
              <Button className="flex-1" disabled={!newName.trim()} onClick={handleCreate}>
                创建并使用
              </Button>
            </div>
          </div>
        )}
        <Button variant="ghost" className="w-full" onClick={() => setOpen(false)}>
          关闭
        </Button>
      </div>
    </div>
  );
}
