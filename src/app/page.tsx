import type { Metadata } from 'next';
import { getMission, getRewards } from '@/lib/content';
import { Hero, HowItWorks, IntroFooter, IntroHeader, PeerExchange, Questions, RewardsPreview, Why } from '@/components/intro';
import { TryNow } from '@/components/intro/TryNow';
import styles from '@/components/intro/intro.module.css';

export const metadata: Metadata = {
  title: 'HanLog · Your day, in Korean',
  description: 'Short speaking missions, useful AI feedback, and everyday Korean with peers. Make a little practice part of your day.',
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: 'HanLog', url: '/', title: 'HanLog · Your day, in Korean', description: 'Short speaking missions, useful AI feedback, and everyday Korean with peers.' },
};
export default function IntroPage() {
  const mission = getMission('cafe-iced-americano')!;
  return <div className={styles.page}><a className="hl-skip-link" href="#try">Skip to the practice mission</a><IntroHeader /><main><Hero /><HowItWorks /><Why /><PeerExchange /><TryNow mission={mission} /><RewardsPreview rewards={getRewards()} /><Questions /></main><IntroFooter /></div>;
}
