import type { ReactNode } from 'react';
export function Ko({ children, as: Tag = 'span', className = '' }: { children: ReactNode; as?: 'span' | 'p' | 'h1' | 'h2' | 'h3'; className?: string }) { return <Tag lang="ko" className={`hl-ko ${className}`}>{children}</Tag>; }
