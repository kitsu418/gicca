// Placeholder home page — real card list arrives in task #8.
import { Button, Screen } from '../components/ui';
import { lockSession } from '../core/vault/session';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  return (
    <Screen>
      <div className="max-w-md mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Gicca</h1>
          <Button
            variant="ghost"
            onClick={() => {
              lockSession();
              navigate('/unlock');
            }}
          >
            锁定
          </Button>
        </div>
        <p className="text-slate-400 text-sm">
          保险箱已解锁。卡片管理界面将在下一个 feature 中实装。
        </p>
      </div>
    </Screen>
  );
}
