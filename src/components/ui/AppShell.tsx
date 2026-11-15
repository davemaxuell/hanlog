'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useOptionalSession } from '@/lib/ui/session-context';
import { Button, Ko, PointsChip, StatusNote } from './index';
const links = [['Missions', '/app'], ['Challenges', '/app/challenges'], ['Rewards', '/app/rewards'], ['Me', '/app/me']] as const;
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname(); const { balance, balanceError, balanceLoading, refreshBalance } = useOptionalSession(); const onboarding = pathname === '/app/onboarding';
  return <div className="hl-app"><a href="#main" className="hl-skip-link">Skip to content</a><header className="hl-app-header"><Link href="/" className="hl-wordmark">HanLog <Ko>한로그</Ko></Link>{!onboarding && <><PointsChip balance={balance} unavailable={!!balanceError} /><nav className="hl-app-nav" aria-label="Main navigation">{links.map(([label, href]) => <Link key={href} href={href} aria-current={href === '/app' ? pathname === '/app' || pathname.startsWith('/app/missions/') ? 'page' : undefined : pathname.startsWith(href) ? 'page' : undefined}>{label}</Link>)}</nav></>}</header><main id="main" className={`hl-app-main${onboarding ? ' hl-onboarding-main' : ''}`}>{!onboarding && balanceError && <div className="hl-stack-sm hl-balance-error"><StatusNote tone="error"><strong>Points unavailable.</strong> {balanceError}</StatusNote><Button variant="secondary" className="hl-fit" busy={balanceLoading} onClick={() => void refreshBalance()}>Retry points</Button></div>}{children}</main></div>;
}
