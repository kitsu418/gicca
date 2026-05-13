// Attachment thumbnail strip + fullscreen viewer used inside CardDetail.

import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';
import {
  addAttachment,
  attachmentBlob,
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
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(att: Attachment) {
    if (!window.confirm('Delete this photo?')) return;
    await deleteAttachment(cardId, att.id);
    await refresh();
    if (viewing?.id === att.id) setViewing(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-200">Photos</span>
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
          {busy ? 'Processing…' : '+ Add'}
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
    const blobUrl = URL.createObjectURL(attachmentBlob(attachment));
    setUrl(blobUrl);
    return () => URL.revokeObjectURL(blobUrl);
  }, [attachment]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="aspect-square rounded-xl border border-slate-800 bg-slate-900 overflow-hidden"
    >
      {url && <img src={url} alt="" className="w-full h-full object-cover" />}
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
    const blobUrl = URL.createObjectURL(attachmentBlob(attachment));
    setUrl(blobUrl);
    return () => URL.revokeObjectURL(blobUrl);
  }, [attachment]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" onClick={onClose}>
      <div className="absolute top-0 left-0 right-0 flex justify-between p-4 text-white z-10">
        <button onClick={onClose} className="text-sm">
          Close
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-sm text-rose-400"
        >
          Delete
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center">
        {url && <img src={url} alt="" className="max-w-full max-h-full object-contain" />}
      </div>
    </div>
  );
}
