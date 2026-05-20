// Small, opinionated UI primitives reused across pages.

import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

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
    <label htmlFor={inputId} className="block min-w-0 space-y-1.5">
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
  // Use max() so the safe-area insets only *extend* the base 1.5rem
  // padding — without it, the pl/pr from SAFE_AREA_PADDING wins the
  // cascade against the shorthand p-6 and the horizontal padding
  // collapses to 0 in portrait (where the inset is 0).
  return (
    <div
      className="min-h-dvh flex items-center justify-center bg-slate-950 text-slate-100 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))]"
    >
      <div className="w-full max-w-md space-y-6">{children}</div>
    </div>
  );
}

// Password input with a Show/Hide toggle inside the field. Used by the
// vault setup / unlock flows and by the Backup page so passphrases can
// be sanity-checked without disabling autofill.
export function PassphraseInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  autoComplete,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  autoComplete?: string;
  label?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <label className="block min-w-0 space-y-1.5">
      {label && <span className="block text-sm font-medium text-slate-200">{label}</span>}
      <div className="relative">
        <input
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          className="block w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 pr-14 text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShown((s) => !s)}
          className="absolute inset-y-0 right-2 my-auto h-7 px-2 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-md"
          aria-label={shown ? 'Hide passphrase' : 'Show passphrase'}
        >
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
    </label>
  );
}
