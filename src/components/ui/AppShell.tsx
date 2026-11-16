'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { HouseLine, Books, ChatsCircle, ChartBar, UserCircle } from '@phosphor-icons/react';
import { useOptionalSession } from '@/lib/ui/session-context';
import { accountApi } from '@/lib/account-client';
import { Button, Ko, PointsChip, StatusNote } from './index';
import { BrandMark } from './BrandMark';
import { MotionToggle } from '@/components/motion/MotionPreference';
import { RouteEntrance } from '@/components/motion/RouteEntrance';
import { motion } from 'motion/react';
import { springs } from '@/components/motion/kit';
const links: { label: string; href: string; icon: typeof HouseLine; also?: string[] }[] = [
  { label: 'Today', href: '/app', icon: HouseLine },
  { label: 'Practice', href: '/app/missions', icon: Books },
  { label: 'Community', href: '/app/feed', icon: ChatsCircle, also: ['/app/challenges', '/app/groups', '/app/leaderboard'] },
  { label: 'Progress', href: '/app/progress', icon: ChartBar },
  { label: 'Me', href: '/app/me', icon: UserCircle },
];
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, balance, balanceError, balanceLoading, refreshBalance } = useOptionalSession();
  const onboarding = pathname === '/app/onboarding';
  const [online, setOnline] = useState(true);
  const [needsRecovery, setNeedsRecovery] = useState(false);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update(); window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    let current = true;
    if (user) void accountApi.status().then(status => { if (current) setNeedsRecovery(!status.recoveryEnabled); }).catch(() => {});
    return () => { current = false; };
  }, [user, pathname]);
  return <div className="hl-app">
    <a href="#main" className="hl-skip-link">Skip to content</a>
    <header className="hl-app-header">
      <Link href={user ? '/app' : '/'} className="hl-wordmark"><BrandMark />HanLog <Ko>한록</Ko></Link>
      {!onboarding && <>
        <nav className="hl-app-nav" aria-label="Main navigation">{links.map(({ label, href, icon: Icon, also = [] }) => {
          const active = href === '/app' ? pathname === href : [href, ...also].some(path => pathname.startsWith(path));
          // The active pill slides between destinations (motion.dev "Tab select" shared layout).
          return <Link key={href} href={href} aria-current={active ? 'page' : undefined}>{active && <motion.span layoutId="app-nav-active" className="hl-nav-pill" transition={springs.snappy} aria-hidden="true" />}<Icon size={21} weight={active ? 'fill' : 'regular'} aria-hidden="true" /><span>{label}</span></Link>;
        })}</nav>
        <Link href="/app/rewards" className="hl-points-link" aria-label="Your points and milestones"><PointsChip balance={balance} unavailable={!!balanceError} /></Link>
      </>}
      {onboarding && <Link className="hl-back-link" href="/">Back to HanLog</Link>}
    </header>
    <main id="main" className={`hl-app-main${onboarding ? ' hl-onboarding-main' : ''}`}>
      {!online && <div className="hl-offline"><StatusNote tone="info">You&apos;re offline. Keep this page open; reconnect before saving or sending a recording.</StatusNote></div>}
      {!onboarding && balanceError && <div className="hl-stack-sm hl-balance-error"><StatusNote tone="error"><strong>Points unavailable.</strong> {balanceError}</StatusNote><Button variant="secondary" className="hl-fit" busy={balanceLoading} onClick={() => void refreshBalance()}>Retry points</Button></div>}
      {!onboarding && needsRecovery && pathname === '/app' && <aside className="hl-recovery-nudge"><span>Make your progress yours. Save a recovery key for your next device.</span><Link href="/app/me#recovery">Keep my progress →</Link></aside>}
      <RouteEntrance>{children}</RouteEntrance>
      {!onboarding && <footer className="hl-app-footer"><span>A little Korean, every day.</span><MotionToggle /><Link href="/help">Help & community guide</Link><Link href="/privacy">Privacy</Link></footer>}
    </main>
  </div>;
}
