// Merchant logo registry.
//
// simple-icons covers six of our merchants. For the rest we ship a small
// stylized glyph in the brand's signature color — abstract universal
// shapes (curve-with-arrow, sunburst, flame, leaf, etc.) that fit each
// merchant's visual category. They are not facsimiles of any specific
// brand's actual logo artwork.

import {
  siApple,
  siDoordash,
  siNike,
  siStarbucks,
  siTarget,
  siUber,
} from 'simple-icons';

export type LogoData = {
  /** Inner SVG markup for a 24x24 viewBox. Uses currentColor. */
  svg: string;
  /** Brand color (with leading #), used as the card background. */
  hex: string;
};

const fromSimpleIcons = (icon: { path: string; hex: string }): LogoData => ({
  svg: `<path d="${icon.path}"/>`,
  hex: `#${icon.hex}`,
});

export const MERCHANT_LOGOS: Record<string, LogoData> = {
  starbucks: fromSimpleIcons(siStarbucks),
  apple: fromSimpleIcons(siApple),
  target: fromSimpleIcons(siTarget),
  doordash: fromSimpleIcons(siDoordash),
  uber: fromSimpleIcons(siUber),
  nike: fromSimpleIcons(siNike),

  // Curve with arrowhead — generic "motion / delivery" glyph.
  amazon: {
    svg:
      '<path d="M4 14 Q 12 19.5 20 14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M17.5 11.7 L 20 14 L 17.5 16.3" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    hex: '#FF9900',
  },
  // Six-ray sunburst — generic geometric burst.
  walmart: {
    svg:
      '<g stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
      '<line x1="12" y1="3" x2="12" y2="9"/>' +
      '<line x1="12" y1="15" x2="12" y2="21"/>' +
      '<line x1="4.4" y1="7.5" x2="9.4" y2="10.5"/>' +
      '<line x1="19.6" y1="16.5" x2="14.6" y2="13.5"/>' +
      '<line x1="4.4" y1="16.5" x2="9.4" y2="13.5"/>' +
      '<line x1="19.6" y1="7.5" x2="14.6" y2="10.5"/>' +
      '</g>',
    hex: '#0071DC',
  },
  // Bold three-quarter arc — generic letterform glyph.
  costco: {
    svg:
      '<path d="M18 7 A 6 6 0 1 0 18 17" stroke="currentColor" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
    hex: '#E32227',
  },
  // Price tag with corner cut + punch hole — generic tag silhouette.
  bestbuy: {
    svg:
      '<path fill-rule="evenodd" d="M3 4H16L21 12L16 20H3V4ZM8.5 12A1.5 1.5 0 1 1 5.5 12A1.5 1.5 0 0 1 8.5 12Z"/>',
    hex: '#0046BE',
  },
  // Square frame — generic geometric outline.
  homedepot: {
    svg: '<path fill-rule="evenodd" d="M4 4H20V20H4V4ZM8 8V16H16V8H8Z"/>',
    hex: '#F96302',
  },
  // Flame teardrop — generic flame icon.
  sephora: {
    svg:
      '<path d="M12 3 C 11 7 8 8 8 13 Q 8 18 12 21 Q 16 18 16 13 C 16 10 14 9 13 7 C 12.5 8 13 9 12 10 Z"/>',
    hex: '#000000',
  },
  // Chili-pepper silhouette — generic vegetable glyph.
  chipotle: {
    svg:
      '<path d="M12 4 Q 14 4 14 6 L 14 7 Q 18 9 18 14 Q 17 19 12 19 Q 7 19 6 14 Q 7 9 11 7 L 11 6 Q 11 4 12 4 Z"/>',
    hex: '#A81612',
  },
  // Leaf silhouette — generic plant icon.
  wholefoods: {
    svg:
      '<path d="M5 19 Q 5 7 19 5 Q 20 13 13 19 Q 8 20 5 19 Z"/>' +
      '<path d="M5 19 L 16 8" stroke="currentColor" stroke-width="0.7" fill="none" opacity="0.45"/>',
    hex: '#00674B',
  },
  // Medical cross — generic health icon.
  cvs: {
    svg:
      '<rect x="9.5" y="4" width="5" height="16" rx="1"/>' +
      '<rect x="4" y="9.5" width="16" height="5" rx="1"/>',
    hex: '#CC0000',
  },
};

export function getMerchantLogo(id: string): LogoData | undefined {
  return MERCHANT_LOGOS[id];
}
