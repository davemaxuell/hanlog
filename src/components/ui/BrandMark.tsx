export function BrandMark({ className = 'hl-brand-mark' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M4 36V19C4 10.7 10.7 4 19 4h2c8.3 0 15 6.7 15 15v17H4Z" fill="#FFFEF9" stroke="#1E2436" strokeWidth="2" /><path d="M9 31V19a10 10 0 0 1 10-10h2a10 10 0 0 1 10 10v12H9Z" fill="#D2F6FC" stroke="#1E2436" strokeWidth="1.5" /><path d="M20 9v22M9 21h22" stroke="#1E2436" strokeWidth="1.5" /><path d="m26 12 1.1 2.5 2.7.3-2 1.8.6 2.7-2.4-1.4-2.4 1.4.6-2.7-2-1.8 2.7-.3L26 12Z" fill="#FC7CAC" /></svg>;
}
