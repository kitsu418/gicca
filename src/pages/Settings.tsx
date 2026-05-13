import { useNavigate } from 'react-router-dom';
import { Button, Screen } from '../components/ui';
import { MerchantBadge } from '../components/MerchantBadge';
import { wipeAll } from '../core/db';
import { deleteUserMerchant, useMerchants } from '../core/merchants';

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

        <MerchantsSection />
        <BackupShortcut onNavigate={() => navigate('/backup')} />
        <AboutSection />
        <DangerZone onWiped={() => navigate('/', { replace: true })} />
      </div>
    </Screen>
  );
}

function MerchantsSection() {
  const all = useMerchants();
  const userMerchants = all.filter((m) => m.source === 'user');

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this custom merchant? Existing cards keep their merchant-name snapshot.')) return;
    await deleteUserMerchant(id);
  }

  return (
    <SettingsSection
      title="Custom merchants"
      description={`${all.length - userMerchants.length} built-in · ${userMerchants.length} custom`}
    >
      {userMerchants.length === 0 ? (
        <p className="text-xs text-slate-500">Create new merchants from the picker when adding a card.</p>
      ) : (
        <ul className="space-y-2">
          {userMerchants.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-xl bg-slate-900 px-3 py-2">
              <MerchantBadge merchant={m} size={32} />
              <span className="flex-1 truncate text-sm">{m.name}</span>
              <button
                onClick={() => handleDelete(m.id)}
                className="text-xs text-rose-400 hover:text-rose-300"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
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
