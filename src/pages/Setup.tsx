import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, CenteredCard, Input } from '../components/ui';
import { meta, wipeAll } from '../core/db';
import { setupVault } from '../core/vault/vault';
import { unlockSession } from '../core/vault/session';
import { refreshVaultStatus } from '../hooks/useVaultStatus';

type Step = 'welcome' | 'password' | 'recovery';

export default function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('welcome');
  const [recoveryCode, setRecoveryCode] = useState<string[] | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  // Step 2 state
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    setError(null);
    if (password.length < 8) {
      setError('密码至少 8 个字符');
      return;
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致');
      return;
    }
    setBusy(true);
    try {
      // Clear any half-built vault from a prior interrupted setup.
      await wipeAll();
      const { dekRaw, dekKey, recoveryCode } = await setupVault(password);
      unlockSession(dekRaw, dekKey);
      setRecoveryCode(recoveryCode);
      setStep('recovery');
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setBusy(false);
    }
  }

  async function handleFinish() {
    await meta.set('hasSetup', true);
    await meta.set('schemaVersion', 1);
    await meta.set('autoLockMs', 5 * 60 * 1000);
    refreshVaultStatus();
    navigate('/', { replace: true });
  }

  async function copyRecovery() {
    if (!recoveryCode) return;
    await navigator.clipboard.writeText(recoveryCode.join(' '));
  }

  return (
    <CenteredCard>
      {step === 'welcome' && (
        <div className="space-y-5">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">欢迎使用 Gicca</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              一个本地优先的礼品卡保险箱。所有卡号、PIN 都用你的主密码在设备上加密，
              Gicca 没有服务器、不上传任何数据。
            </p>
          </div>
          <ul className="space-y-3 text-sm text-slate-300">
            <li className="flex gap-3">
              <span className="text-sky-400">1</span>
              <span>设置一个主密码（用于解锁，需要至少 8 个字符）</span>
            </li>
            <li className="flex gap-3">
              <span className="text-sky-400">2</span>
              <span>保存一份恢复码（忘记主密码时唯一的救命稻草）</span>
            </li>
            <li className="flex gap-3">
              <span className="text-sky-400">3</span>
              <span>开始添加你的礼品卡</span>
            </li>
          </ul>
          <Button className="w-full" onClick={() => setStep('password')}>
            开始
          </Button>
        </div>
      )}

      {step === 'password' && (
        <div className="space-y-5">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">设置主密码</h1>
            <p className="text-slate-400 text-sm">
              主密码用来加密本地所有数据。建议用一个不容易被猜到、且自己能记住的长密码（例如一句你能背的诗）。
              <strong className="text-rose-400"> 主密码无法被找回</strong>，只能靠恢复码救援。
            </p>
          </div>
          <Input
            label="主密码"
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="至少 8 个字符"
            hint={`${password.length} 字符`}
          />
          <Input
            label="再次输入"
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
              className="accent-sky-500"
            />
            显示密码
          </label>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('welcome')}>
              返回
            </Button>
            <Button className="flex-1" disabled={busy} onClick={handleCreate}>
              {busy ? '创建中…' : '创建保险箱'}
            </Button>
          </div>
        </div>
      )}

      {step === 'recovery' && recoveryCode && (
        <div className="space-y-5">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">保存恢复码</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              下面 12 个单词是你的恢复码。
              <strong className="text-rose-400">忘记主密码时，只有这串单词能救回你的数据。</strong>
              请截图、抄在纸上或存入密码管理器。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-700 bg-slate-900 p-4 font-mono">
            {recoveryCode.map((w, i) => (
              <div key={i} className="flex items-baseline gap-2 text-sm">
                <span className="text-slate-500 tabular-nums w-5 text-right">{i + 1}.</span>
                <span className="text-slate-100">{w}</span>
              </div>
            ))}
          </div>
          <Button variant="secondary" className="w-full" onClick={copyRecovery}>
            复制到剪贴板
          </Button>
          <label className="flex items-start gap-3 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1 accent-sky-500"
            />
            <span>我已经把恢复码保存到了安全的地方，明白它丢了就没法找回我的数据。</span>
          </label>
          <Button
            className="w-full"
            disabled={!acknowledged}
            onClick={handleFinish}
          >
            进入应用
          </Button>
        </div>
      )}
    </CenteredCard>
  );
}
