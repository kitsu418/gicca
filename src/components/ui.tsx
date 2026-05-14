// Small, opinionated UI primitives reused across pages. Tailwind utility
// classes do the heavy lifting; `brutalist:` variants flip key surfaces
// when the user picks the brutalist theme.

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
    'brutalist:rounded-none brutalist:border-2 brutalist:transition-none brutalist:focus-visible:ring-0 brutalist:focus-visible:ring-offset-0 brutalist:uppercase brutalist:tracking-wider';
  const styles = {
    primary:
      'bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white shadow-sm ' +
      'brutalist:bg-yellow-300 brutalist:text-black brutalist:border-white brutalist:shadow-none brutalist:hover:bg-yellow-200',
    secondary:
      'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 ' +
      'brutalist:bg-black brutalist:text-white brutalist:border-white brutalist:hover:bg-white brutalist:hover:text-black',
    ghost:
      'bg-transparent hover:bg-slate-800/60 text-slate-200 ' +
      'brutalist:hover:bg-white brutalist:hover:text-black brutalist:border-transparent',
    danger:
      'bg-rose-600 hover:bg-rose-500 text-white ' +
      'brutalist:bg-white brutalist:text-black brutalist:border-rose-500 brutalist:hover:bg-rose-500 brutalist:hover:text-white',
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
        <span className="block text-sm font-medium text-slate-200 brutalist:uppercase brutalist:tracking-wider">
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
          className
        }
        {...rest}
      />
      {error ? (
        <span className="block text-xs text-rose-400 brutalist:text-rose-300">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-slate-500 brutalist:text-white/60">{hint}</span>
      ) : null}
    </label>
  );
}

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`min-h-dvh bg-slate-950 text-slate-100 brutalist:bg-black brutalist:text-white ${className}`}
    >
      {children}
    </div>
  );
}

export function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-slate-950 text-slate-100 brutalist:bg-black brutalist:text-white">
      <div className="w-full max-w-md space-y-6">{children}</div>
    </div>
  );
}
