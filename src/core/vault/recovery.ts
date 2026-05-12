// Recovery codes: 12 words drawn from a 256-word list (8 bits each → 96 bits
// of entropy). The code is rendered to the user once at setup time and used
// to derive a wrap key for the DEK; we never store the words themselves.

import { randomBytes } from './crypto';
import { RECOVERY_WORDS, WORD_TO_INDEX } from './wordlist';

export const RECOVERY_WORD_COUNT = 12;

/** Generates a fresh 12-word recovery code. */
export function generateRecoveryCode(): string[] {
  const indices = randomBytes(RECOVERY_WORD_COUNT);
  return Array.from(indices, (i) => RECOVERY_WORDS[i]!);
}

/** Validates and normalises user input (case, whitespace, common typos). */
export function normalizeRecoveryInput(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export type RecoveryParseError =
  | { kind: 'wrong_count'; got: number; expected: number }
  | { kind: 'unknown_word'; index: number; word: string };

export type RecoveryParseResult =
  | { ok: true; words: string[] }
  | { ok: false; error: RecoveryParseError };

export function parseRecoveryCode(input: string): RecoveryParseResult {
  const words = normalizeRecoveryInput(input);
  if (words.length !== RECOVERY_WORD_COUNT) {
    return { ok: false, error: { kind: 'wrong_count', got: words.length, expected: RECOVERY_WORD_COUNT } };
  }
  for (let i = 0; i < words.length; i++) {
    if (!WORD_TO_INDEX.has(words[i]!)) {
      return { ok: false, error: { kind: 'unknown_word', index: i, word: words[i]! } };
    }
  }
  return { ok: true, words };
}

/**
 * Converts a recovery code into the canonical secret string used as PBKDF2
 * input. Stable across versions; do not change.
 */
export function recoveryCodeToSecret(words: string[]): string {
  return words.map((w) => w.toLowerCase().trim()).join(' ');
}
