// Newspaper-style masthead — only renders in newsprint theme.
//
// "GICCA · GIFT CARD VAULT" centered between a heavy + thin rule pair,
// with the day stamp underneath in tiny caps. Mirrors the front-page
// treatment on Japanese broadsheets where the masthead band sets the
// tone for the rest of the spread.

import { useTheme } from '../hooks/useTheme';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

export function Masthead() {
  const theme = useTheme();
  if (theme !== 'newsprint') return null;

  const now = new Date();
  const day = WEEKDAYS[now.getDay()];
  const month = MONTHS[now.getMonth()];
  const date = now.getDate();
  const year = now.getFullYear();

  return (
    <header className="py-4 text-center">
      <div className="border-t-[3px] border-b border-[#161310]" />
      <div className="py-3">
        <h1 className="font-serif text-3xl font-black tracking-[0.3em] uppercase">
          Gicca
        </h1>
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#161310]/70 mt-1">
          Gift Card Vault
        </p>
      </div>
      <div className="border-t border-b-[3px] border-[#161310]" />
      <p className="text-[11px] uppercase tracking-[0.3em] mt-3 font-mono">
        {day} · {month} {String(date).padStart(2, '0')}, {year} · VOL. I
      </p>
    </header>
  );
}
