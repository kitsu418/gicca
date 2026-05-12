// Placeholder unlock screen — replaced in task #5 with the real
// master-password unlock flow.
import { CenteredCard } from '../components/ui';

export default function Unlock() {
  return (
    <CenteredCard>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Locked</h1>
        <p className="text-slate-400 text-sm">解锁屏幕将在下一个 feature 中实装。</p>
      </div>
    </CenteredCard>
  );
}
