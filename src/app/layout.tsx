import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'HanLog', description: 'Speak Korean out in the world.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
