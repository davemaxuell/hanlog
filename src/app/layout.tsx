import type { Metadata, Viewport } from 'next';
import { isPreview, siteUrl } from '@/lib/site';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: 'HanLog · Speak Korean out in the world',
  description: 'Real expressions, your real voice, feedback in seconds, and points you can spend.',
  robots: isPreview() ? { index: false, follow: false } : undefined,
  twitter: { card: 'summary_large_image' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
