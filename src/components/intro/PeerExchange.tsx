import styles from './intro.module.css';
import { IntroReveal } from './IntroReveal';
import Link from 'next/link';
import { ArrowUpRight } from '@phosphor-icons/react/ssr';
import { ExchangeShowcase } from './ExchangeShowcase';
export function PeerExchange() {
  return <IntroReveal id="community" data-section="peer" className={`${styles.section} ${styles.peer}`} aria-labelledby="peer-heading"><div className={styles.peerCopy}><p className={styles.eyebrow}>A language is better with people</p><h2 id="peer-heading">A new expression.<br />A little connection.</h2><p>Korean-speaking peers bring the expressions. You bring your voice. Trade short recordings, practical tips, and the encouragement to try again.</p><p className={styles.muted}>Your recording is shared only with the people allowed to review that exchange, and expires after 14 days.</p><Link className="hl-link-button" href="/app/challenges">Explore the challenges <ArrowUpRight size={20} aria-hidden="true" /></Link></div><ExchangeShowcase /></IntroReveal>;
}
