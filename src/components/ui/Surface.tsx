import type { ReactNode } from 'react';
export function Surface({ tone = 'surface', children, className = '' }: { tone?: 'surface' | 'apricot'; children: ReactNode; className?: string }) { return <div className={`hl-surface hl-surface--${tone} ${className}`}>{children}</div>; }
