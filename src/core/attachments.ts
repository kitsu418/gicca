// Photo attachments: client-side compress → raw bytes in IndexedDB.

import { cards as cardsStore, attachments as attachmentsStore } from './db';
import type { Attachment, AttachmentKind } from './types';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

async function compressImage(file: File): Promise<{
  bytes: Uint8Array;
  mimeType: string;
  width: number;
  height: number;
}> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob) throw new Error('image encode failed');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { bytes, mimeType: blob.type, width, height };
}

export async function addAttachment(
  cardId: string,
  file: File,
  kind: AttachmentKind = 'card_front',
): Promise<Attachment> {
  const card = await cardsStore.get(cardId);
  if (!card) throw new Error(`card ${cardId} not found`);

  const compressed = await compressImage(file);
  const attachment: Attachment = {
    id: crypto.randomUUID(),
    cardId,
    kind,
    mimeType: compressed.mimeType,
    width: compressed.width,
    height: compressed.height,
    data: compressed.bytes,
    createdAt: new Date().toISOString(),
  };
  await attachmentsStore.put(attachment);

  await cardsStore.put({
    ...card,
    attachmentIds: [...card.attachmentIds, attachment.id],
    updatedAt: new Date().toISOString(),
  });

  return attachment;
}

export async function deleteAttachment(cardId: string, attachmentId: string): Promise<void> {
  await attachmentsStore.delete(attachmentId);
  const card = await cardsStore.get(cardId);
  if (!card) return;
  await cardsStore.put({
    ...card,
    attachmentIds: card.attachmentIds.filter((id) => id !== attachmentId),
    updatedAt: new Date().toISOString(),
  });
}

export async function listAttachments(cardId: string): Promise<Attachment[]> {
  return attachmentsStore.byCard(cardId);
}

export function attachmentBlob(att: Attachment): Blob {
  // BlobPart requires a typed-array view backed by ArrayBuffer (not
  // SharedArrayBuffer); the wrap forces TS into the right overload.
  return new Blob([new Uint8Array(att.data)], { type: att.mimeType });
}
