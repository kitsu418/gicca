// A small color-coded chip used to represent a merchant. Renders the first
// glyph of the name on a colored background — works without any logo assets
// and stays crisp at any size.

import type { MerchantSnapshot } from '../core/types';

type Props = {
  merchant: Pick<MerchantSnapshot, 'name' | 'color'>;
  size?: number;
  className?: string;
};

export function MerchantBadge({ merchant, size = 40, className = '' }: Props) {
  const initial = firstGlyph(merchant.name);
  const bg = merchant.color ?? '#475569';
  return (
    <div
      className={`flex items-center justify-center rounded-xl text-white font-semibold select-none shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        fontSize: size * 0.42,
        lineHeight: 1,
      }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

function firstGlyph(name: string): string {
  // Pick first non-whitespace code point so CJK and emojis render correctly.
  for (const ch of name.trim()) return ch;
  return '?';
}
