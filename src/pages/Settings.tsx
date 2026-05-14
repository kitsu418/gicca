import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Screen } from '../components/ui';
import { MerchantEditor } from '../components/MerchantEditor';
import { wipeAll } from '../core/db';
import { hasBuiltin, useMerchants } from '../core/merchants';
import { loadTheme, saveTheme } from '../core/theme';
import type { MerchantDefinition, ThemeName } from '../core/types';

export default function Settings() {
  const navigate = useNavigate();
  return (
    <Screen>
      <div className="max-w-md mx-auto p-6 space-y-6 pb-12">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-slate-100">
            ← Back
          </button>
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>

        <ThemeSection />
        <MerchantsSection />
        <BackupShortcut onNavigate={() => navigate('/backup')} />
        <AboutSection />
        <DangerZone onWiped={() => navigate('/', { replace: true })} />
      </div>
    </Screen>
  );
}

function ThemeSection() {
  const [theme, setThemeState] = useState<ThemeName>('default');

  useEffect(() => {
    void loadTheme().then(setThemeState);
  }, []);

  async function pick(next: ThemeName) {
    setThemeState(next);
    await saveTheme(next);
  }

  const options: { value: ThemeName; label: string; description: string }[] = [
    {
      value: 'default',
      label: 'Default',
      description: 'Dark slate, rounded cards with brand-color sheen.',
    },
    {
      value: 'brutalist',
      label: 'Brutalist',
      description: 'Pure black, thick white borders, no rounding, electric-yellow primary.',
    },
    {
      value: 'newsprint',
      label: 'Newsprint',
      description: 'Warm paper, ink hairlines, serif body, vermilion stamp accent.',
    },
  ];

  return (
    <SettingsSection title="Theme" description="Changes apply immediately.">
      <div className="space-y-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3 cursor-pointer brutalist:rounded-none brutalist:border-white brutalist:border-2 brutalist:bg-black newsprint:rounded-none newsprint:border-[#161310] newsprint:bg-transparent"
          >
            <input
              type="radio"
              name="theme"
              value={o.value}
              checked={theme === o.value}
              onChange={() => pick(o.value)}
              className="mt-1 accent-sky-500 brutalist:accent-yellow-300 newsprint:accent-[#c8202c]"
            />
            <div className="min-w-0">
              <div className="font-medium">{o.label}</div>
              <div className="text-xs text-slate-400 brutalist:text-white/70 newsprint:text-[#161310]/70">
                {o.description}
              </div>
            </div>
          </label>
        ))}
      </div>
    </SettingsSection>
  );
}

function MerchantsSection() {
  const all = useMerchants();
  const [editing, setEditing] = useState<MerchantDefinition | null>(null);

  const customCount = all.filter((m) => m.source === 'user').length;
  const builtinCount = all.length - customCount;

  return (
    <SettingsSection
      title="Merchants"
      description={`${builtinCount} built-in · ${customCount} customized. Tap a merchant to change its logo.`}
    >
      <ul className="space-y-1.5">
        {all.map((m) => {
          const isUser = m.source === 'user';
          const builtinExists = hasBuiltin(m.id);
          const label = !isUser
            ? 'Built-in'
            : builtinExists
              ? 'Customized'
              : 'Custom';
          return (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-xl bg-slate-900 px-3 py-2"
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: m.color ?? '#475569' }}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{m.name}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
              <button
                onClick={() => setEditing(m)}
                className="text-xs font-medium text-sky-300 hover:text-sky-200"
              >
                {isUser ? 'Edit' : 'Customize'}
              </button>
            </li>
          );
        })}
      </ul>

      {editing && (
        <MerchantEditor
          merchant={editing}
          builtinExists={hasBuiltin(editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </SettingsSection>
  );
}

function BackupShortcut({ onNavigate }: { onNavigate: () => void }) {
  return (
    <SettingsSection
      title="Backup / Migrate"
      description="Export a backup file or restore from one. Cards are not encrypted in the file — store it somewhere only you can reach."
    >
      <Button variant="secondary" onClick={onNavigate}>
        Open backup page
      </Button>
    </SettingsSection>
  );
}

function AboutSection() {
  return (
    <SettingsSection title="About" description="Local-first gift card vault. No accounts, no servers, no telemetry.">
      <p className="text-xs text-slate-500">
        Card data lives in this device's IndexedDB. Use the backup page to move
        between devices.
      </p>
    </SettingsSection>
  );
}

function DangerZone({ onWiped }: { onWiped: () => void }) {
  async function handleWipe() {
    const phrase = window.prompt('This wipes every Gicca record on this device (cannot be undone). Type RESET to confirm:');
    if (phrase !== 'RESET') return;
    await wipeAll();
    onWiped();
  }

  return (
    <SettingsSection title="Danger zone" description="Wipes every Gicca record on this device.">
      <Button variant="danger" onClick={handleWipe}>
        Wipe all data
      </Button>
    </SettingsSection>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
      <header>
        <h2 className="font-medium">{title}</h2>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
