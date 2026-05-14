// Small color-coded chip used to represent a merchant in dense contexts
// (picker rows). Render priority:
//   1. User-supplied logo (merchant.logo / merchantSnapshot.logo)
//   2. Builtin glyph from the logo registry
//   3. First-letter fallback

import type { MerchantSnapshot } from '../core/types';
import { getMerchantLogo } from '../data/merchantLogos';
import { isRenderableLogo } from '../core/merchantLogoInput';

type Props = {
  merchant: Pick<MerchantSnapshot, 'name' | 'color' | 'logo'> & { id?: string };
  size?: number;
  className?: string;
};

export function MerchantBadge({ merchant, size = 40, className = '' }: Props) {
  const builtin = merchant.id ? getMerchantLogo(merchant.id) : undefined;
  const userLogo = isRenderableLogo(merchant.logo) ? merchant.logo : undefined;
  const bg = merchant.color ?? builtin?.hex ?? '#475569';

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
      {userLogo ? (
        <img
          src={userLogo}
          alt=""
          className="object-contain"
          style={{ width: size * 0.7, height: size * 0.7 }}
        />
      ) : builtin ? (
        <svg
          viewBox="0 0 24 24"
          className="fill-current text-white"
          style={{ width: size * 0.6, height: size * 0.6 }}
          dangerouslySetInnerHTML={{ __html: builtin.svg }}
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
