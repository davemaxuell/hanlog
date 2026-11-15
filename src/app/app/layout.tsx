import { Suspense, type ReactNode } from 'react';
import { AppShell } from '@/components/ui/AppShell';
import { SessionProvider } from '@/lib/ui/session-context';
export default function AppLayout({ children }: { children: ReactNode }) { return <Suspense fallback={<p className="hl-app-main" role="status">Opening your window…</p>}><SessionProvider><AppShell>{children}</AppShell></SessionProvider></Suspense>; }
