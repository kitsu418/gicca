// AES-GCM + Argon2id primitives used by the vault and the backup format.
//
// Every encrypted payload here is framed as:
//   [12 bytes random IV] [N bytes ciphertext, ending in 16-byte GCM tag]
// pack/unpack handle that framing. Salts are stored separately so a
// single passphrase derives a stable key across loads.

import { argon2idAsync } from '@noble/hashes/argon2.js';

// OWASP-recommended Argon2id parameters for interactive logins on a
// memory-constrained device: ~19 MiB, 2 passes, single lane. Yields a
// ~300-700ms unlock on a modern iPhone — slow enough to discourage
// offline brute force, fast enough to not feel like a permission
// dialog.
const ARGON_ITERATIONS = 2;
const ARGON_MEMORY_KIB = 19_456;
const ARGON_PARALLELISM = 1;
const KEY_LEN = 32;

const SALT_LEN = 16;
const IV_LEN = 12;

export async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const raw = await argon2idAsync(passphrase, salt, {
    t: ARGON_ITERATIONS,
    m: ARGON_MEMORY_KIB,
    p: ARGON_PARALLELISM,
    dkLen: KEY_LEN,
  });
  return crypto.subtle.importKey(
    'raw',
    raw as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBytes(
  key: CryptoKey,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plaintext as BufferSource),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return out;
}

export async function decryptBytes(
  key: CryptoKey,
  packed: Uint8Array,
): Promise<Uint8Array> {
  if (packed.length < IV_LEN + 16) throw new Error('Ciphertext too short');
  const iv = packed.subarray(0, IV_LEN);
  const ct = packed.subarray(IV_LEN);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ct as BufferSource,
  );
  return new Uint8Array(pt);
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<Uint8Array> {
  return encryptBytes(key, new TextEncoder().encode(JSON.stringify(value)));
}

export async function decryptJson<T>(key: CryptoKey, packed: Uint8Array): Promise<T> {
  const bytes = await decryptBytes(key, packed);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

export function randomSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LEN));
}

// Helpers for records that carry both JSON metadata and a raw binary
// payload (image attachments). Packs them into a single buffer with a
// 4-byte big-endian length prefix for the JSON, encrypted as one unit
// so the framing isn't itself a side channel.
export async function encryptPacked(
  key: CryptoKey,
  meta: unknown,
  data: Uint8Array,
): Promise<Uint8Array> {
  const metaBytes = new TextEncoder().encode(JSON.stringify(meta));
  const plain = new Uint8Array(4 + metaBytes.length + data.length);
  new DataView(plain.buffer).setUint32(0, metaBytes.length, false);
  plain.set(metaBytes, 4);
  plain.set(data, 4 + metaBytes.length);
  return encryptBytes(key, plain);
}

export async function decryptPacked<M>(
  key: CryptoKey,
  packed: Uint8Array,
): Promise<{ meta: M; data: Uint8Array }> {
  const plain = await decryptBytes(key, packed);
  const metaLen = new DataView(
    plain.buffer,
    plain.byteOffset,
    plain.byteLength,
  ).getUint32(0, false);
  const metaBytes = plain.subarray(4, 4 + metaLen);
  const dataBytes = plain.subarray(4 + metaLen);
  return {
    meta: JSON.parse(new TextDecoder().decode(metaBytes)) as M,
    data: new Uint8Array(dataBytes),
  };
}
