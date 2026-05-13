// Attachment thumbnail strip + fullscreen viewer used inside CardDetail.

import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';
import {
  addAttachment,
  decryptAttachment,
  deleteAttachment,
  listAttachments,
} from '../core/attachments';
import type { Attachment } from '../core/types';

type Props = {
  cardId: string;
};

export function AttachmentGallery({ cardId }: Props) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Attachment | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function refresh() {
    setItems(await listAttachments(cardId));
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        await addAttachment(cardId, file);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(att: Attachment) {
    if (!confirm('删除这张照片？')) return;
    await deleteAttachment(cardId, att.id);
    await refresh();
    if (viewing?.id === att.id) setViewing(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-200">照片</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          variant="ghost"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          {busy ? '处理中…' : '+ 添加'}
        </Button>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {items.map((att) => (
            <Thumbnail
              key={att.id}
              attachment={att}
              onClick={() => setViewing(att)}
            />
          ))}
        </div>
      )}

      {viewing && (
        <FullscreenViewer
          attachment={viewing}
          onClose={() => setViewing(null)}
          onDelete={() => handleDelete(viewing)}
        />
      )}
    </div>
  );
}

function Thumbnail({
  attachment,
  onClick,
}: {
  attachment: Attachment;
  onClick: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;
    (async () => {
      try {
        const blob = await decryptAttachment(attachment);
        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        setUrl(blobUrl);
      } catch {
        // Leave url null; aspect-ratio placeholder stays visible.
      }
    })();
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [attachment]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="aspect-square rounded-xl border border-slate-800 bg-slate-900 overflow-hidden"
    >
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
          解密中
        </div>
      )}
    </button>
  );
}

function FullscreenViewer({
  attachment,
  onClose,
  onDelete,
}: {
  attachment: Attachment;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;
    (async () => {
      try {
        const blob = await decryptAttachment(attachment);
        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        setUrl(blobUrl);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [attachment]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" onClick={onClose}>
      <div className="absolute top-0 left-0 right-0 flex justify-between p-4 text-white z-10">
        <button onClick={onClose} className="text-sm">
          关闭
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-sm text-rose-400"
        >
          删除
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center">
        {url && <img src={url} alt="" className="max-w-full max-h-full object-contain" />}
      </div>
    </div>
  );
}
