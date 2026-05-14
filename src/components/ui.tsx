// Small, opinionated UI primitives reused across pages.

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
    'disabled:opacity-40 disabled:cursor-not-allowed';
  const styles = {
    primary: 'bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white shadow-sm',
    secondary:
      'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700',
    ghost: 'bg-transparent hover:bg-slate-800/60 text-slate-200',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white',
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
        <span className="block text-sm font-medium text-slate-200">{label}</span>
      )}
      <input
        id={inputId}
        className={
          'block w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 ' +
          'text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none ' +
          'focus:ring-2 focus:ring-sky-500/30 ' +
          className
        }
        {...rest}
      />
      {error ? (
        <span className="block text-xs text-rose-400">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

// Tailwind v4 arbitrary value classes for the iOS safe-area insets. Padding
// keeps the background colour bleeding to the edges while pushing content
// clear of the dynamic island / home indicator on installed PWAs.
const SAFE_AREA_PADDING =
  'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ' +
  'pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]';

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-h-dvh bg-slate-950 text-slate-100 ${SAFE_AREA_PADDING} ${className}`}>
      {children}
    </div>
  );
}

export function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <div className={`min-h-dvh flex items-center justify-center p-6 bg-slate-950 text-slate-100 ${SAFE_AREA_PADDING}`}>
      <div className="w-full max-w-md space-y-6">{children}</div>
    </div>
  );
}
