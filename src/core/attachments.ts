// Photo attachments: client-side compress → encrypted bytes in IndexedDB.

import { decryptJson, decryptPacked, encryptJson, encryptPacked } from './crypto';
import { rawAttachments, rawCards } from './db';
import type { Attachment, AttachmentKind, CardRecord } from './types';
import { getKey } from './vault';

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

async function readCard(id: string): Promise<CardRecord | undefined> {
  const row = await rawCards.get(id);
  if (!row) return undefined;
  return decryptJson<CardRecord>(getKey(), row.blob);
}

async function writeCard(card: CardRecord): Promise<void> {
  await rawCards.put({ id: card.id, blob: await encryptJson(getKey(), card) });
}

type AttachmentMeta = Omit<Attachment, 'data'>;

async function writeAttachment(attachment: Attachment): Promise<void> {
  const { data, ...meta } = attachment;
  const blob = await encryptPacked(getKey(), meta, data);
  await rawAttachments.put({ id: attachment.id, blob });
}

export async function addAttachment(
  cardId: string,
  file: File,
  kind: AttachmentKind = 'card_front',
): Promise<Attachment> {
  const card = await readCard(cardId);
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
  await writeAttachment(attachment);

  await writeCard({
    ...card,
    attachmentIds: [...card.attachmentIds, attachment.id],
    updatedAt: new Date().toISOString(),
  });

  return attachment;
}

export async function deleteAttachment(cardId: string, attachmentId: string): Promise<void> {
  await rawAttachments.delete(attachmentId);
  const card = await readCard(cardId);
  if (!card) return;
  await writeCard({
    ...card,
    attachmentIds: card.attachmentIds.filter((id) => id !== attachmentId),
    updatedAt: new Date().toISOString(),
  });
}

export async function listAttachments(cardId: string): Promise<Attachment[]> {
  const rows = await rawAttachments.list();
  const decoded = await Promise.all(
    rows.map(async (r) => {
      const { meta, data } = await decryptPacked<AttachmentMeta>(getKey(), r.blob);
      return { ...meta, data } as Attachment;
    }),
  );
  return decoded.filter((a) => a.cardId === cardId);
}

export function attachmentBlob(att: Attachment): Blob {
  return new Blob([new Uint8Array(att.data)], { type: att.mimeType });
}
