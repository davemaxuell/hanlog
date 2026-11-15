import Link from 'next/link';
import { ArrowUpRight, ArrowRight, Microphone } from '@phosphor-icons/react/ssr';
import styles from './intro.module.css';
export function Hero() {
  return <section data-section="hero" className={styles.hero} aria-labelledby="hero-heading">
    <div className={styles.heroText}>
      <p className={styles.heroLabel}>Everyday Korean. Real connection.</p>
      <h1 id="hero-heading">Your day.<br /><span>In Korean.</span></h1>
      <p className={styles.heroLead}>The café order. The group chat. The thing you finally say out loud. Make a little Korean part of your everyday.</p>
      <div className={styles.actions}><a className="hl-link-button" href="#try">Try a mission now <ArrowUpRight size={21} aria-hidden="true" /></a><Link className={styles.heroLink} href="/app/onboarding?mode=restore">Already here? Come back <ArrowRight size={17} aria-hidden="true" /></Link></div>
    </div>
    <div className={styles.heroArt}>
      <div className={styles.window}>
        <div className={styles.windowSky} aria-hidden="true"><span className={styles.starLarge}>✦</span><span className={styles.sun} /><span className={styles.starSmall}>✦</span></div>
        <div className={styles.phraseCard}>
          <span className={styles.phraseContext}>A moment at the café</span>
          <p lang="ko">아이스 아메리카노<br />한 잔 주세요.</p>
          <span>One iced Americano, please.</span>
          <Link href="/app/missions/cafe-iced-americano"><Microphone size={20} weight="fill" aria-hidden="true" /> Practise this phrase <ArrowUpRight size={18} aria-hidden="true" /></Link>
        </div>
        <div className={styles.windowCaption}><span lang="ko">한록</span> Little moments. More you.</div>
      </div>
      <div className={styles.artNote}><span aria-hidden="true">✦</span> You don&apos;t need perfect Korean.<br />You just need a place to start.</div>
    </div>
  </section>;
}
