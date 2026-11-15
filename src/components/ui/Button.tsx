'use client';
import type { ButtonHTMLAttributes } from 'react';
export function Button({ variant = 'primary', busy, busyLabel = 'Please wait…', children, className = '', disabled, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'text'; busy?: boolean; busyLabel?: string }) {
  return <button {...props} type={type} disabled={disabled || busy} aria-busy={busy || undefined} className={`hl-button hl-button--${variant} ${className}`}>{busy ? <><span className="hl-busy-indicator" aria-hidden="true" />{busyLabel}</> : children}</button>;
}
