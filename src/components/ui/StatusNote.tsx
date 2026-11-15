import type { ReactNode } from 'react';
export function StatusNote({ tone, children }: { tone: 'info' | 'success' | 'error'; children: ReactNode }) { return <div className={`hl-status hl-status--${tone}`} role={tone === 'error' ? 'alert' : 'status'}><span aria-hidden="true" className="hl-status-icon">{tone === 'success' ? '✓' : tone === 'error' ? '!' : 'i'}</span><div>{children}</div></div>; }
