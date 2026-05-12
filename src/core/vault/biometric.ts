// Biometric unlock via WebAuthn + the PRF extension.
//
// We create a platform-bound passkey for the user. The PRF extension lets us
// hand a salt to the authenticator and receive a stable 32-byte output that
// only that credential can produce — perfect for deriving a wrap key for the
// DEK without ever storing the key bytes anywhere recoverable.
//
// On Apple devices the passkey rides iCloud Keychain across devices, but the
// IndexedDB wrap is per-device; new devices need to be enrolled separately.

import { vault as vaultStore } from '../db';
import type { UnlockResult } from './vault';
import type { VaultWrap } from '../types';
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  importAesKey,
  randomBytes,
} from './crypto';

// WebAuthn PRF extension shapes — lib.dom is starting to include these but
// not every TS target has them yet; declare minimal locals to be safe.
type PrfValues = { first: BufferSource; second?: BufferSource };
type PrfInputs = { eval?: PrfValues; evalByCredential?: Record<string, PrfValues> };
type PrfOutputs = { enabled?: boolean; results?: { first?: ArrayBuffer; second?: ArrayBuffer } };
type ExtIn = AuthenticationExtensionsClientInputs & { prf?: PrfInputs };
type ExtOut = AuthenticationExtensionsClientOutputs & { prf?: PrfOutputs };

const RP_NAME = 'Gicca';

function rpId(): string {
  // window.location.hostname works for both production and localhost dev.
  return window.location.hostname;
}

function wrapId(credentialId: Uint8Array): string {
  return `biometric:${bytesToB64Url(credentialId)}`;
}

function bytesToB64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ─── Feature detection ────────────────────────────────────────────────────

export async function isBiometricSupported(): Promise<boolean> {
  if (typeof PublicKeyCredential === 'undefined') return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// ─── Registration ─────────────────────────────────────────────────────────

export type BiometricRegisterError =
  | 'unsupported'
  | 'prf_unsupported'
  | 'cancelled'
  | 'failed';

/**
 * Creates a new platform passkey and an associated PRF-derived wrap of the
 * supplied DEK. Returns either the freshly-written wrap or an error code so
 * the caller can show a useful message.
 */
export async function registerBiometric(
  dekRaw: Uint8Array,
  label: string,
): Promise<{ ok: true; wrap: VaultWrap } | { ok: false; reason: BiometricRegisterError }> {
  if (!(await isBiometricSupported())) return { ok: false, reason: 'unsupported' };

  const userId = randomBytes(16);
  const challenge = randomBytes(32);
  const prfSalt = randomBytes(32);

  let credential: PublicKeyCredential;
  try {
    credential = (await navigator.credentials.create({
      publicKey: {
        rp: { id: rpId(), name: RP_NAME },
        user: { id: userId as BufferSource, name: 'vault', displayName: label || 'Gicca Vault' },
        challenge: challenge as BufferSource,
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'preferred',
          userVerification: 'required',
        },
        extensions: { prf: { eval: { first: prfSalt as BufferSource } } } as ExtIn,
        timeout: 60_000,
      },
    })) as PublicKeyCredential;
  } catch (e) {
    if ((e as DOMException)?.name === 'NotAllowedError') {
      return { ok: false, reason: 'cancelled' };
    }
    return { ok: false, reason: 'failed' };
  }

  const credentialId = new Uint8Array(credential.rawId);
  const ext = credential.getClientExtensionResults() as ExtOut;
  if (!ext.prf?.enabled) {
    return { ok: false, reason: 'prf_unsupported' };
  }

  // Some implementations (Safari) don't return PRF results from create() and
  // require a follow-up get() to actually evaluate the PRF.
  let prfOutput: ArrayBuffer | undefined = ext.prf.results?.first;
  if (!prfOutput) {
    try {
      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge: randomBytes(32) as BufferSource,
          rpId: rpId(),
          allowCredentials: [{ id: credentialId as BufferSource, type: 'public-key' }],
          userVerification: 'required',
          extensions: { prf: { eval: { first: prfSalt as BufferSource } } } as ExtIn,
          timeout: 60_000,
        },
      })) as PublicKeyCredential;
      const aext = assertion.getClientExtensionResults() as ExtOut;
      prfOutput = aext.prf?.results?.first;
    } catch {
      return { ok: false, reason: 'failed' };
    }
  }

  if (!prfOutput) return { ok: false, reason: 'prf_unsupported' };

  const wrapKey = await importAesKey(new Uint8Array(prfOutput));
  const env = await aesGcmEncrypt(wrapKey, dekRaw);

  const wrap: VaultWrap = {
    id: wrapId(credentialId),
    kind: 'biometric',
    label,
    credentialId,
    prfSalt,
    iv: env.iv,
    wrappedDek: env.ciphertext,
    createdAt: new Date().toISOString(),
  };
  await vaultStore.put(wrap);
  return { ok: true, wrap };
}

// ─── Unlock ───────────────────────────────────────────────────────────────

export type BiometricUnlockError =
  | 'unsupported'
  | 'no_wraps'
  | 'cancelled'
  | 'prf_unsupported'
  | 'failed';

export async function unlockWithBiometric(): Promise<
  UnlockResult | { ok: false; reason: BiometricUnlockError }
> {
  if (!(await isBiometricSupported())) return { ok: false, reason: 'unsupported' };

  const allWraps = await vaultStore.byKind('biometric');
  const wraps = allWraps.filter((w) => w.credentialId && w.prfSalt);
  if (wraps.length === 0) return { ok: false, reason: 'no_wraps' };

  // Hand the authenticator every credential we know about. If multiple wraps
  // share the same prfSalt we could collapse to one PRF eval, but salts are
  // per-credential so we use evalByCredential to keep each (credential, salt)
  // pair tied together.
  const evalByCredential: Record<string, PrfValues> = {};
  for (const w of wraps) {
    evalByCredential[bytesToB64Url(w.credentialId!)] = {
      first: w.prfSalt! as BufferSource,
    };
  }

  let assertion: PublicKeyCredential;
  try {
    assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32) as BufferSource,
        rpId: rpId(),
        allowCredentials: wraps.map((w) => ({
          id: w.credentialId! as BufferSource,
          type: 'public-key',
        })),
        userVerification: 'required',
        extensions: { prf: { evalByCredential } } as ExtIn,
        timeout: 60_000,
      },
    })) as PublicKeyCredential;
  } catch (e) {
    if ((e as DOMException)?.name === 'NotAllowedError') {
      return { ok: false, reason: 'cancelled' };
    }
    return { ok: false, reason: 'failed' };
  }

  const credentialId = new Uint8Array(assertion.rawId);
  const wrap = wraps.find(
    (w) => w.credentialId && b64UrlEqual(w.credentialId, credentialId),
  );
  if (!wrap) return { ok: false, reason: 'failed' };

  const ext = assertion.getClientExtensionResults() as ExtOut;
  const prfOutput = ext.prf?.results?.first;
  if (!prfOutput) return { ok: false, reason: 'prf_unsupported' };

  try {
    const wrapKey = await importAesKey(new Uint8Array(prfOutput));
    const dekRaw = await aesGcmDecrypt(wrapKey, {
      iv: wrap.iv,
      ciphertext: wrap.wrappedDek,
    });
    const dekKey = await importAesKey(dekRaw);
    return { ok: true, dekRaw, dekKey };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

function b64UrlEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ─── Listing / removal ────────────────────────────────────────────────────

export async function listBiometricWraps(): Promise<VaultWrap[]> {
  return vaultStore.byKind('biometric');
}

export async function removeBiometricWrap(id: string): Promise<void> {
  await vaultStore.delete(id);
}
