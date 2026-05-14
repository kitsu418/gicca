// Small, opinionated UI primitives reused across pages. Tailwind utility
// classes do the heavy lifting; `brutalist:` and `newsprint:` variants flip
// key surfaces when the user picks an alternate theme.

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export function Button({
  className = '',
  variant = 'primary',
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium ' +
    'transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ' +
    'disabled:opacity-40 disabled:cursor-not-allowed ' +
    'brutalist:rounded-none brutalist:border-2 brutalist:transition-none brutalist:focus-visible:ring-0 brutalist:focus-visible:ring-offset-0 brutalist:uppercase brutalist:tracking-wider ' +
    'newsprint:rounded-none newsprint:border newsprint:transition-none newsprint:focus-visible:ring-0 newsprint:uppercase newsprint:tracking-[0.2em] newsprint:font-mono newsprint:text-xs';
  const styles = {
    primary:
      'bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white shadow-sm ' +
      'brutalist:bg-yellow-300 brutalist:text-black brutalist:border-white brutalist:shadow-none brutalist:hover:bg-yellow-200 ' +
      'newsprint:bg-[#c8202c] newsprint:text-white newsprint:border-[#161310] newsprint:shadow-none newsprint:hover:bg-[#a31a23]',
    secondary:
      'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 ' +
      'brutalist:bg-black brutalist:text-white brutalist:border-white brutalist:hover:bg-white brutalist:hover:text-black ' +
      'newsprint:bg-transparent newsprint:text-[#161310] newsprint:border-[#161310] newsprint:hover:bg-[#161310] newsprint:hover:text-[#f4f1ea]',
    ghost:
      'bg-transparent hover:bg-slate-800/60 text-slate-200 ' +
      'brutalist:hover:bg-white brutalist:hover:text-black brutalist:border-transparent ' +
      'newsprint:border-transparent newsprint:hover:bg-[#161310]/10 newsprint:text-[#161310]',
    danger:
      'bg-rose-600 hover:bg-rose-500 text-white ' +
      'brutalist:bg-white brutalist:text-black brutalist:border-rose-500 brutalist:hover:bg-rose-500 brutalist:hover:text-white ' +
      'newsprint:bg-[#c8202c] newsprint:text-white newsprint:border-[#161310] newsprint:hover:bg-[#a31a23]',
  }[variant];
  return <button className={`${base} ${styles} ${className}`} {...rest} />;
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Input({
  label,
  hint,
  error,
  className = '',
  id,
  ...rest
}: InputProps) {
  const inputId = id ?? rest.name;
  return (
    <label htmlFor={inputId} className="block space-y-1.5">
      {label && (
        <span className="block text-sm font-medium text-slate-200 brutalist:uppercase brutalist:tracking-wider newsprint:uppercase newsprint:tracking-[0.2em] newsprint:text-[11px] newsprint:text-[#161310] newsprint:font-mono">
          {label}
        </span>
      )}
      <input
        id={inputId}
        className={
          'block w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 ' +
          'text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none ' +
          'focus:ring-2 focus:ring-sky-500/30 ' +
          'brutalist:rounded-none brutalist:border-2 brutalist:border-white brutalist:bg-black ' +
          'brutalist:focus:border-yellow-300 brutalist:focus:ring-0 brutalist:placeholder-white/40 ' +
          'newsprint:rounded-none newsprint:border-x-0 newsprint:border-t-0 newsprint:border-b newsprint:border-[#161310] newsprint:bg-transparent newsprint:text-[#161310] newsprint:placeholder-[#161310]/40 newsprint:focus:ring-0 newsprint:focus:border-[#c8202c] newsprint:font-serif ' +
          className
        }
        {...rest}
      />
      {error ? (
        <span className="block text-xs text-rose-400 brutalist:text-rose-300 newsprint:text-[#c8202c]">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-slate-500 brutalist:text-white/60 newsprint:text-[#161310]/60 newsprint:italic">{hint}</span>
      ) : null}
    </label>
  );
}

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`min-h-dvh bg-slate-950 text-slate-100 brutalist:bg-black brutalist:text-white newsprint:bg-[#f4f1ea] newsprint:text-[#161310] ${className}`}
    >
      {children}
    </div>
  );
}

export function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-slate-950 text-slate-100 brutalist:bg-black brutalist:text-white newsprint:bg-[#f4f1ea] newsprint:text-[#161310]">
      <div className="w-full max-w-md space-y-6">{children}</div>
    </div>
  );
}
