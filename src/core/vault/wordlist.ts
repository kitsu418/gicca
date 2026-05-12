// Recovery-code wordlist — 256 short, common English words (8 bits each).
// A 12-word recovery code therefore carries 96 bits of entropy before PBKDF2
// stretching, which is well above the practical brute-force threshold.
//
// IMPORTANT: do not reorder, remove, or rename any entry — the index of each
// word is the value used inside recovery codes. Adding to the end is also
// forbidden (it would shift no entries but break the size assumption); a
// future revision should be opt-in via a versioned wordlist.

export const RECOVERY_WORDS: readonly string[] = [
  'about', 'above', 'accept', 'across', 'action', 'active', 'actor', 'admit',
  'adult', 'after', 'agency', 'agree', 'ahead', 'alarm', 'album', 'alert',
  'allow', 'almost', 'alone', 'always', 'animal', 'apple', 'area', 'army',
  'aside', 'asset', 'atom', 'attack', 'audio', 'author', 'avoid', 'award',
  'aware', 'back', 'badge', 'balance', 'basic', 'basket', 'battle', 'beach',
  'beauty', 'become', 'before', 'begin', 'behind', 'below', 'better', 'beyond',
  'birth', 'black', 'blade', 'blame', 'blank', 'blast', 'blend', 'bless',
  'blind', 'block', 'blood', 'bloom', 'board', 'boat', 'body', 'bonus',
  'book', 'boost', 'border', 'bottle', 'bottom', 'bounce', 'brain', 'brake',
  'brand', 'brave', 'bread', 'break', 'brick', 'bridge', 'brief', 'bright',
  'bring', 'broad', 'brown', 'brush', 'bubble', 'build', 'bunch', 'burst',
  'butter', 'button', 'cabin', 'cable', 'cactus', 'calm', 'camera', 'canal',
  'candle', 'canyon', 'canvas', 'carbon', 'career', 'carry', 'castle', 'catch',
  'cattle', 'cause', 'cement', 'census', 'center', 'change', 'chase', 'cheap',
  'check', 'cheese', 'cherry', 'chest', 'chief', 'china', 'choice', 'church',
  'circle', 'city', 'civil', 'claim', 'class', 'clean', 'clear', 'client',
  'cliff', 'climb', 'clock', 'close', 'cloud', 'clover', 'coach', 'coast',
  'color', 'comet', 'comfort', 'common', 'cosmic', 'cotton', 'couple', 'course',
  'cover', 'create', 'credit', 'crystal', 'culture', 'curve', 'cycle', 'daily',
  'dance', 'dare', 'dawn', 'decide', 'deer', 'defend', 'delay', 'denim',
  'depart', 'desert', 'design', 'detect', 'device', 'diamond', 'differ', 'digital',
  'direct', 'dive', 'doctor', 'dolphin', 'donkey', 'doodle', 'dragon', 'dream',
  'dress', 'drift', 'drink', 'driver', 'drum', 'eager', 'early', 'earth',
  'easy', 'echo', 'edge', 'eight', 'elder', 'eleven', 'embark', 'emerald',
  'empire', 'empty', 'enable', 'energy', 'engine', 'enjoy', 'enough', 'equal',
  'erase', 'escape', 'estate', 'evening', 'every', 'exact', 'excite', 'expand',
  'expert', 'explore', 'fabric', 'factor', 'falcon', 'family', 'famous', 'fancy',
  'fashion', 'father', 'feature', 'fence', 'fever', 'field', 'fierce', 'figure',
  'final', 'finish', 'first', 'flag', 'flash', 'flight', 'float', 'flour',
  'flower', 'flute', 'focus', 'foggy', 'folder', 'follow', 'forest', 'forge',
  'formal', 'forum', 'fossil', 'found', 'fragile', 'frame', 'freedom', 'fresh',
  'friend', 'frost', 'fruit', 'galaxy', 'garden', 'gather', 'genius', 'gentle',
] as const;

if (RECOVERY_WORDS.length !== 256) {
  throw new Error(
    `wordlist size invariant broken: expected 256, got ${RECOVERY_WORDS.length}`,
  );
}

// Reverse index for fast parse / validation.
export const WORD_TO_INDEX: ReadonlyMap<string, number> = new Map(
  RECOVERY_WORDS.map((w, i) => [w, i]),
);

if (WORD_TO_INDEX.size !== RECOVERY_WORDS.length) {
  throw new Error('wordlist contains duplicates');
}
