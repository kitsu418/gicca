// Small color-coded chip used to represent a merchant in dense contexts
// (picker rows). Renders the brand logo glyph over the brand color when
// we have one; falls back to the first letter for user merchants.

import type { MerchantSnapshot } from '../core/types';
import { getMerchantLogo } from '../data/merchantLogos';

type Props = {
  merchant: Pick<MerchantSnapshot, 'name' | 'color'> & { id?: string };
  size?: number;
  className?: string;
};

export function MerchantBadge({ merchant, size = 40, className = '' }: Props) {
  const logo = merchant.id ? getMerchantLogo(merchant.id) : undefined;
  const bg = merchant.color ?? logo?.hex ?? '#475569';

  return (
    <div
      className={`flex items-center justify-center rounded-xl text-white font-semibold select-none shrink-0 overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        fontSize: size * 0.42,
        lineHeight: 1,
      }}
      aria-hidden="true"
    >
      {logo ? (
        <svg
          viewBox="0 0 24 24"
          className="fill-current text-white"
          style={{ width: size * 0.6, height: size * 0.6 }}
          dangerouslySetInnerHTML={{ __html: logo.svg }}
        />
      ) : (
        firstGlyph(merchant.name)
      )}
    </div>
  );
}

function firstGlyph(name: string): string {
  for (const ch of name.trim()) return ch;
  return '?';
}
