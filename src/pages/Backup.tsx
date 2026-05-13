import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Screen } from '../components/ui';
import {
  downloadBackup,
  importBackupReplacing,
  readBackup,
  type ImportSummary,
} from '../core/backup';
import { lockSession } from '../core/vault/session';
import { refreshVaultStatus } from '../hooks/useVaultStatus';

export default function Backup() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function handleExport() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await downloadBackup();
      setMessage('已生成加密备份，请保存到 iCloud Drive / 任意云盘或发送到另一台设备。');
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File) {
    setError(null);
    setMessage(null);
    setSummary(null);
    setBusy(true);
    try {
      const parsed = await readBackup(file);
      const exportedAt = new Date(parsed.exportedAt).toLocaleString();
      const ok = confirm(
        `这会覆盖当前设备的所有数据。\n备份时间：${exportedAt}\n卡片：${parsed.payload.cards.length} 张\n\n继续？`,
      );
      if (!ok) {
        setBusy(false);
        return;
      }
      const result = await importBackupReplacing(file);
      // The DEK on this device is now whatever the imported vault holds;
      // force a re-unlock so the session isn't carrying a stale key.
      lockSession();
      refreshVaultStatus();
      setSummary(result);
      setMessage('导入成功。下次解锁请用导出源设备的主密码 / 恢复码。');
      // Bounce them to the lock screen after a beat.
      setTimeout(() => navigate('/unlock', { replace: true }), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <Screen>
      <div className="max-w-md mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-slate-100">
            ← 返回
          </button>
          <h1 className="text-xl font-semibold">备份 / 迁移</h1>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <div className="space-y-1">
            <h2 className="font-medium">导出加密备份</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              生成一个 <code>.gicca</code> 文件，包含所有卡片、照片、记录和当前的解锁
              方式（主密码、恢复码、生物识别 wrap）。文件本身已加密，存到 iCloud Drive
              / Google Drive / 邮件都可以。
            </p>
          </div>
          <Button className="w-full" onClick={handleExport} disabled={busy}>
            {busy ? '处理中…' : '导出'}
          </Button>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <div className="space-y-1">
            <h2 className="font-medium">从备份导入</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              <strong className="text-rose-400">会覆盖当前设备上的所有数据</strong>。
              用于新设备初始化或迁移。导入后需要用源设备的主密码或恢复码解锁。
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".gicca,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
            }}
          />
          <Button
            variant="danger"
            className="w-full"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {busy ? '处理中…' : '选择 .gicca 文件'}
          </Button>
        </section>

        {message && (
          <p className="text-sm text-emerald-400 whitespace-pre-line">{message}</p>
        )}
        {summary && (
          <p className="text-xs text-slate-400">
            导入了 {summary.cards} 张卡片、{summary.transactions} 条记录、
            {summary.attachments} 张照片、{summary.userMerchants} 个自定义商户。
          </p>
        )}
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </div>
    </Screen>
  );
}
