import styles from './intro.module.css';
import Link from 'next/link';
import { BrandMark } from '@/components/ui/BrandMark';
import { ArrowUpRight } from '@phosphor-icons/react/ssr';
export function IntroHeader() {
  return <header data-section="header" className={styles.header}><Link className={styles.wordmark} href="/"><BrandMark />HanLog <span lang="ko">한록</span></Link><nav className={styles.headerNav} aria-label="Website navigation"><a href="#how">How it works</a><a href="#community">Learn together</a></nav><Link className={styles.headerLink} href="/app">Open the app <ArrowUpRight size={19} aria-hidden="true" /></Link></header>;
}
