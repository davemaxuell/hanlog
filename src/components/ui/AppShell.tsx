'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useOptionalSession } from '@/lib/ui/session-context';
import { Ko, PointsChip } from './index';
const links = [['Missions', '/app'], ['Challenges', '/app/challenges'], ['Rewards', '/app/rewards'], ['Me', '/app/me']] as const;
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname(); const { balance } = useOptionalSession(); const onboarding = pathname === '/app/onboarding';
  return <div className="hl-app"><a href="#main" className="hl-skip-link">Skip to content</a><header className="hl-app-header"><Link href="/" className="hl-wordmark">HanLog <Ko>한로그</Ko></Link>{!onboarding && <><PointsChip balance={balance} /><nav className="hl-app-nav" aria-label="Main navigation">{links.map(([label, href]) => <Link key={href} href={href} aria-current={href === '/app' ? pathname === '/app' || pathname.startsWith('/app/missions/') ? 'page' : undefined : pathname.startsWith(href) ? 'page' : undefined}>{label}</Link>)}</nav></>}</header><main id="main" className={`hl-app-main${onboarding ? ' hl-onboarding-main' : ''}`}>{children}</main></div>;
}
