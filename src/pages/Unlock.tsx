import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, CenteredCard, Input } from '../components/ui';
import { unlockWithPassword, unlockWithRecovery } from '../core/vault/vault';
import { unlockSession } from '../core/vault/session';
import { parseRecoveryCode } from '../core/vault/recovery';
import {
  isBiometricSupported,
  listBiometricWraps,
  unlockWithBiometric,
} from '../core/vault/biometric';

type Mode = 'password' | 'recovery';

export default function Unlock() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('password');
  const [password, setPassword] = useState('');
  const [recoveryText, setRecoveryText] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricAttempted, setBiometricAttempted] = useState(false);

  // Check if biometric is wired up and try it once on mount. WebAuthn requires
  // a user gesture on some browsers, so this may fail silently on first paint;
  // the explicit button below is the reliable path.
  useEffect(() => {
    (async () => {
      const wraps = await listBiometricWraps();
      if (wraps.length === 0) return;
      const supported = await isBiometricSupported();
      if (!supported) return;
      setBiometricAvailable(true);
    })();
  }, []);

  async function tryBiometric() {
    setError(null);
    setBiometricAttempted(true);
    setBusy(true);
    try {
      const result = await unlockWithBiometric();
      if ('ok' in result && result.ok) {
        unlockSession(result.dekRaw, result.dekKey);
        navigate('/', { replace: true });
        return;
      }
      // Stay silent on user-initiated cancel; show a hint otherwise so the
      // user knows why the prompt didn't appear.
      if (result.reason !== 'cancelled') {
        setError(reasonToMessage(result.reason));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await unlockWithPassword(password);
      if (!result.ok) {
        setError(result.reason === 'no_vault' ? '没有保险箱' : '主密码错误');
        return;
      }
      unlockSession(result.dekRaw, result.dekKey);
      navigate('/', { replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function handleRecovery(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = parseRecoveryCode(recoveryText);
    if (!parsed.ok) {
      const err = parsed.error;
      if (err.kind === 'wrong_count') {
        setError(`需要 ${err.expected} 个单词，输入了 ${err.got} 个`);
      } else {
        setError(`第 ${err.index + 1} 个单词 "${err.word}" 不在词表中`);
      }
      return;
    }
    setBusy(true);
    try {
      const result = await unlockWithRecovery(parsed.words);
      if (!result.ok) {
        setError(result.reason === 'no_vault' ? '没有保险箱' : '恢复码错误');
        return;
      }
      unlockSession(result.dekRaw, result.dekKey);
      navigate('/', { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <CenteredCard>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">解锁 Gicca</h1>
        <p className="text-slate-400 text-sm">
          {mode === 'password' ? '输入主密码继续' : '输入 12 个恢复码单词'}
        </p>
      </div>

      {mode === 'password' && (
        <>
          {biometricAvailable && !biometricAttempted && (
            <Button className="w-full" onClick={tryBiometric} disabled={busy}>
              使用生物识别解锁
            </Button>
          )}
          <form onSubmit={handlePassword} className="space-y-4">
            <Input
              label="主密码"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus={!biometricAvailable}
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
            <Button type="submit" className="w-full" disabled={busy || !password}>
              {busy ? '验证中…' : '解锁'}
            </Button>
            {biometricAvailable && biometricAttempted && (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setBiometricAttempted(false);
                  tryBiometric();
                }}
                disabled={busy}
              >
                再试一次生物识别
              </Button>
            )}
            <button
              type="button"
              onClick={() => {
                setMode('recovery');
                setError(null);
              }}
              className="block w-full text-center text-xs text-slate-400 hover:text-sky-400"
            >
              忘记主密码？用恢复码解锁
            </button>
          </form>
        </>
      )}

      {mode === 'recovery' && (
        <form onSubmit={handleRecovery} className="space-y-4">
          <label htmlFor="recovery" className="block space-y-1.5">
            <span className="block text-sm font-medium text-slate-200">12 个恢复码单词</span>
            <textarea
              id="recovery"
              value={recoveryText}
              onChange={(e) => setRecoveryText(e.target.value)}
              rows={3}
              autoFocus
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              className="block w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 font-mono text-sm"
              placeholder="单词之间用空格分隔"
            />
            <span className="block text-xs text-slate-500">
              用恢复码解锁后请到设置里重新设置主密码。
            </span>
          </label>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !recoveryText.trim()}>
            {busy ? '验证中…' : '用恢复码解锁'}
          </Button>
          <button
            type="button"
            onClick={() => {
              setMode('password');
              setError(null);
            }}
            className="block w-full text-center text-xs text-slate-400 hover:text-sky-400"
          >
            返回主密码
          </button>
        </form>
      )}
    </CenteredCard>
  );
}

function reasonToMessage(reason: string): string {
  switch (reason) {
    case 'unsupported':
      return '当前浏览器不支持生物识别';
    case 'no_wraps':
      return '尚未在该设备上启用生物识别';
    case 'prf_unsupported':
      return '当前浏览器不支持 WebAuthn PRF';
    case 'cancelled':
      return '已取消';
    default:
      return '生物识别失败，请用主密码登录';
  }
}
