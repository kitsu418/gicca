// Low-level Web Crypto primitives used by the vault.
//
// All symmetric encryption is AES-GCM-256 with a fresh 12-byte IV per record.
// Key derivation from passwords/recovery codes uses PBKDF2-SHA256 with a high
// iteration count.

import type { EncryptedEnvelope } from '../types';

export const AES_KEY_LEN_BITS = 256;
export const IV_LEN_BYTES = 12;
export const SALT_LEN_BYTES = 16;
export const PBKDF2_ITERATIONS = 310_000;
export const PBKDF2_HASH = 'SHA-256';

function getCrypto(): Crypto {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API not available — Gicca requires a secure context (HTTPS).');
  }
  return crypto;
}

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  getCrypto().getRandomValues(out);
  return out;
}

// ─── DEK generation / import ──────────────────────────────────────────────

/** Generates a fresh 256-bit data encryption key as raw bytes. */
export function generateDekRaw(): Uint8Array {
  return randomBytes(AES_KEY_LEN_BITS / 8);
}

/** Imports raw key bytes as an AES-GCM CryptoKey for encrypt/decrypt use. */
export async function importAesKey(
  raw: Uint8Array,
  usages: KeyUsage[] = ['encrypt', 'decrypt'],
): Promise<CryptoKey> {
  return getCrypto().subtle.importKey('raw', raw as BufferSource, { name: 'AES-GCM' }, false, usages);
}

// ─── AES-GCM encrypt / decrypt ────────────────────────────────────────────

export async function aesGcmEncrypt(
  key: CryptoKey,
  plaintext: Uint8Array,
  aad?: Uint8Array,
): Promise<EncryptedEnvelope> {
  const iv = randomBytes(IV_LEN_BYTES);
  const ciphertext = new Uint8Array(
    await getCrypto().subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad as BufferSource | undefined },
      key,
      plaintext as BufferSource,
    ),
  );
  return { iv, ciphertext };
}

export async function aesGcmDecrypt(
  key: CryptoKey,
  env: EncryptedEnvelope,
  aad?: Uint8Array,
): Promise<Uint8Array> {
  const plaintext = await getCrypto().subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: env.iv as BufferSource,
      additionalData: aad as BufferSource | undefined,
    },
    key,
    env.ciphertext as BufferSource,
  );
  return new Uint8Array(plaintext);
}

// ─── Password-based key derivation ────────────────────────────────────────

export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const passwordBytes = new TextEncoder().encode(password.normalize('NFKC'));
  const baseKey = await getCrypto().subtle.importKey(
    'raw',
    passwordBytes as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return getCrypto().subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: PBKDF2_HASH,
    },
    baseKey,
    { name: 'AES-GCM', length: AES_KEY_LEN_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ─── JSON envelope helpers ────────────────────────────────────────────────

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function encryptJson(
  key: CryptoKey,
  value: unknown,
  aad?: Uint8Array,
): Promise<EncryptedEnvelope> {
  return aesGcmEncrypt(key, encoder.encode(JSON.stringify(value)), aad);
}

export async function decryptJson<T = unknown>(
  key: CryptoKey,
  env: EncryptedEnvelope,
  aad?: Uint8Array,
): Promise<T> {
  const bytes = await aesGcmDecrypt(key, env, aad);
  return JSON.parse(decoder.decode(bytes)) as T;
}

// ─── Hex / base64 helpers ─────────────────────────────────────────────────

export function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  if (clean.length % 2 !== 0) throw new Error('odd-length hex string');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
