import type { Metadata } from 'next';
import { getMission, getRewards } from '@/lib/content';
import { Hero, HowItWorks, IntroFooter, IntroHeader, PeerExchange, Questions, RewardsPreview, Why } from '@/components/intro';
import { TryNow } from '@/components/intro/TryNow';
import styles from '@/components/intro/intro.module.css';

export const metadata: Metadata = {
  title: 'HanLog · Speak Korean out in the world',
  description: 'Real expressions, your real voice, feedback in seconds, and points you can spend.',
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: 'HanLog', url: '/', title: 'HanLog · Speak Korean out in the world', description: 'Real expressions, your real voice, feedback in seconds, and points you can spend.' },
};
export default function IntroPage() {
  const mission = getMission('cafe-iced-americano')!;
  return <div className={styles.page}><a className="hl-skip-link" href="#try">Skip to the practice mission</a><IntroHeader /><main><Hero /><TryNow mission={mission} /><Why /><HowItWorks /><PeerExchange /><RewardsPreview rewards={getRewards()} /><Questions /></main><IntroFooter /></div>;
}
