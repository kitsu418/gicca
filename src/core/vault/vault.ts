// High-level vault operations.
//
// The vault owns one symmetric Data Encryption Key (DEK) that protects every
// sensitive payload. The DEK is *never* stored directly; instead, several
// `VaultWrap` records hold it encrypted under different wrap-keys:
//
//   - password : PBKDF2(masterPassword, salt) → wrapKey
//   - recovery : PBKDF2(recoveryWords,   salt) → wrapKey
//   - biometric: PRF-derived key from a WebAuthn passkey (added later)
//
// Any one wrap can unlock the DEK; users add the wraps that match their
// devices. Changing the master password rewraps the *same* DEK so existing
// ciphertexts stay valid.

import { vault as vaultStore } from '../db';
import type { CardSecrets, EncryptedEnvelope, VaultWrap } from '../types';
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  decryptJson,
  deriveKeyFromPassword,
  encryptJson,
  generateDekRaw,
  importAesKey,
  PBKDF2_ITERATIONS,
  randomBytes,
  SALT_LEN_BYTES,
} from './crypto';
import { generateRecoveryCode, recoveryCodeToSecret } from './recovery';

const PASSWORD_WRAP_ID = 'password';
const RECOVERY_WRAP_ID = 'recovery';

// ─── Wrap helpers ─────────────────────────────────────────────────────────

async function wrapDek(wrapKey: CryptoKey, dekRaw: Uint8Array): Promise<{
  iv: Uint8Array;
  wrappedDek: Uint8Array;
}> {
  const env = await aesGcmEncrypt(wrapKey, dekRaw);
  return { iv: env.iv, wrappedDek: env.ciphertext };
}

async function unwrapDek(wrapKey: CryptoKey, wrap: VaultWrap): Promise<Uint8Array> {
  return aesGcmDecrypt(wrapKey, { iv: wrap.iv, ciphertext: wrap.wrappedDek });
}

// ─── Setup (first-time use) ───────────────────────────────────────────────

export type SetupResult = {
  dekRaw: Uint8Array;
  dekKey: CryptoKey;
  recoveryCode: string[];
};

/**
 * Creates a fresh DEK, registers password + recovery wraps, and returns the
 * recovery words so the UI can show them to the user once.
 */
export async function setupVault(password: string): Promise<SetupResult> {
  if (password.length < 8) throw new Error('password must be at least 8 characters');

  const dekRaw = generateDekRaw();
  const recoveryCode = generateRecoveryCode();

  // Password wrap
  {
    const salt = randomBytes(SALT_LEN_BYTES);
    const wrapKey = await deriveKeyFromPassword(password, salt, PBKDF2_ITERATIONS);
    const { iv, wrappedDek } = await wrapDek(wrapKey, dekRaw);
    await vaultStore.put({
      id: PASSWORD_WRAP_ID,
      kind: 'password',
      salt,
      iterations: PBKDF2_ITERATIONS,
      iv,
      wrappedDek,
      createdAt: new Date().toISOString(),
    });
  }

  // Recovery wrap
  {
    const salt = randomBytes(SALT_LEN_BYTES);
    const wrapKey = await deriveKeyFromPassword(
      recoveryCodeToSecret(recoveryCode),
      salt,
      PBKDF2_ITERATIONS,
    );
    const { iv, wrappedDek } = await wrapDek(wrapKey, dekRaw);
    await vaultStore.put({
      id: RECOVERY_WRAP_ID,
      kind: 'recovery',
      salt,
      iterations: PBKDF2_ITERATIONS,
      iv,
      wrappedDek,
      createdAt: new Date().toISOString(),
    });
  }

  const dekKey = await importAesKey(dekRaw);
  return { dekRaw, dekKey, recoveryCode };
}

// ─── Unlock paths ─────────────────────────────────────────────────────────

export type UnlockResult =
  | { ok: true; dekRaw: Uint8Array; dekKey: CryptoKey }
  | { ok: false; reason: 'no_vault' | 'wrong_credentials' };

export async function unlockWithPassword(password: string): Promise<UnlockResult> {
  const wrap = await vaultStore.get(PASSWORD_WRAP_ID);
  if (!wrap || !wrap.salt || !wrap.iterations) return { ok: false, reason: 'no_vault' };
  try {
    const wrapKey = await deriveKeyFromPassword(password, wrap.salt, wrap.iterations);
    const dekRaw = await unwrapDek(wrapKey, wrap);
    const dekKey = await importAesKey(dekRaw);
    return { ok: true, dekRaw, dekKey };
  } catch {
    return { ok: false, reason: 'wrong_credentials' };
  }
}

export async function unlockWithRecovery(words: string[]): Promise<UnlockResult> {
  const wrap = await vaultStore.get(RECOVERY_WRAP_ID);
  if (!wrap || !wrap.salt || !wrap.iterations) return { ok: false, reason: 'no_vault' };
  try {
    const wrapKey = await deriveKeyFromPassword(
      recoveryCodeToSecret(words),
      wrap.salt,
      wrap.iterations,
    );
    const dekRaw = await unwrapDek(wrapKey, wrap);
    const dekKey = await importAesKey(dekRaw);
    return { ok: true, dekRaw, dekKey };
  } catch {
    return { ok: false, reason: 'wrong_credentials' };
  }
}

// ─── Maintenance ──────────────────────────────────────────────────────────

/**
 * Re-wraps the existing DEK with a new master password. The DEK itself is
 * unchanged, so all previously-encrypted records remain readable.
 */
export async function changeMasterPassword(
  dekRaw: Uint8Array,
  newPassword: string,
): Promise<void> {
  if (newPassword.length < 8) throw new Error('password must be at least 8 characters');
  const salt = randomBytes(SALT_LEN_BYTES);
  const wrapKey = await deriveKeyFromPassword(newPassword, salt, PBKDF2_ITERATIONS);
  const { iv, wrappedDek } = await wrapDek(wrapKey, dekRaw);
  await vaultStore.put({
    id: PASSWORD_WRAP_ID,
    kind: 'password',
    salt,
    iterations: PBKDF2_ITERATIONS,
    iv,
    wrappedDek,
    createdAt: new Date().toISOString(),
  });
}

/** Regenerates the recovery code (invalidating the old one). */
export async function regenerateRecoveryCode(dekRaw: Uint8Array): Promise<string[]> {
  const recoveryCode = generateRecoveryCode();
  const salt = randomBytes(SALT_LEN_BYTES);
  const wrapKey = await deriveKeyFromPassword(
    recoveryCodeToSecret(recoveryCode),
    salt,
    PBKDF2_ITERATIONS,
  );
  const { iv, wrappedDek } = await wrapDek(wrapKey, dekRaw);
  await vaultStore.put({
    id: RECOVERY_WRAP_ID,
    kind: 'recovery',
    salt,
    iterations: PBKDF2_ITERATIONS,
    iv,
    wrappedDek,
    createdAt: new Date().toISOString(),
  });
  return recoveryCode;
}

// ─── Card-secret helpers ──────────────────────────────────────────────────

export async function encryptCardSecrets(
  dekKey: CryptoKey,
  secrets: CardSecrets,
): Promise<EncryptedEnvelope> {
  return encryptJson(dekKey, secrets);
}

export async function decryptCardSecrets(
  dekKey: CryptoKey,
  env: EncryptedEnvelope,
): Promise<CardSecrets> {
  return decryptJson<CardSecrets>(dekKey, env);
}

// ─── Status ───────────────────────────────────────────────────────────────

export async function hasVault(): Promise<boolean> {
  const passwordWrap = await vaultStore.get(PASSWORD_WRAP_ID);
  return Boolean(passwordWrap);
}
