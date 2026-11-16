import Link from 'next/link';
import { ArrowUpRight, ArrowRight } from '@phosphor-icons/react/ssr';
import styles from './intro.module.css';
import { HeroWindow } from './HeroWindow';
import { Fragment } from 'react';
// Each word sits in its own mask so the landing motion can lift it into place; the text reads the same without it.
const Words = ({ text }: { text: string }) => <>{text.split(' ').map((word, index, all) => <Fragment key={index}><span className={styles.word} data-hero-word=""><span>{word}</span></span>{index < all.length - 1 ? ' ' : ''}</Fragment>)}</>;
export function Hero() {
  return <section data-section="hero" className={styles.hero} aria-labelledby="hero-heading">
    <div className={styles.heroText}>
      <p className={styles.heroLabel}>Everyday Korean. Real connection.</p>
      <h1 id="hero-heading"><Words text="Your day." /><br /><span><Words text="In Korean." /></span></h1>
      <p className={styles.heroLead}>Turn a café order or a group-chat phrase into a short speaking practice—with AI feedback and Korean-speaking peers.</p>
      <div className={styles.actions}><a className="hl-link-button" href="#try">Try a mission now <ArrowUpRight size={21} aria-hidden="true" /></a><Link className={styles.heroLink} href="/app/onboarding?mode=restore">Already here? Come back <ArrowRight size={17} aria-hidden="true" /></Link></div>
    </div>
    <div className={styles.heroArt}>
      <HeroWindow />
      <div className={styles.artNote}><span aria-hidden="true">✦</span> You don&apos;t need perfect Korean.<br />You just need a place to start.</div>
    </div>
  </section>;
}
