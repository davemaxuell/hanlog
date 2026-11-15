import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { isPreview, siteUrl } from '@/lib/site';
import { RecoveryKeyProvider } from '@/components/account/RecoveryKeyProvider';
import './globals.css';
const paperlogy = localFont({ src: '../assets/fonts/Paperlogy-Bold.woff2', variable: '--font-paperlogy', weight: '700', display: 'swap', preload: false });
const pretendard = localFont({ src: [
  { path: '../assets/fonts/Pretendard-Regular.woff2', weight: '400', style: 'normal' },
  { path: '../assets/fonts/Pretendard-SemiBold.woff2', weight: '600', style: 'normal' },
], variable: '--font-pretendard', display: 'swap', preload: false });
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: 'HanLog · Your day, in Korean',
  description: 'Build a little Korean into your day. Practise real expressions, get useful feedback, and learn with Korean-speaking peers.',
  robots: isPreview() ? { index: false, follow: false } : undefined,
  twitter: { card: 'summary_large_image' },
  applicationName: 'HanLog',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'HanLog' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#D2F6FC' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${paperlogy.variable} ${pretendard.variable}`}><body><RecoveryKeyProvider>{children}</RecoveryKeyProvider></body></html>;
}
