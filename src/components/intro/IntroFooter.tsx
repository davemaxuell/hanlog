import styles from './intro.module.css';
import Link from 'next/link';
export function IntroFooter() {
  return <footer data-section="footer" className={styles.footer}><Link className={styles.wordmark} href="/">HanLog <span lang="ko">한로그</span></Link><p className={styles.footerNote}>Concept demo · 2026</p><Link className={styles.textLink} href="/privacy">Privacy</Link></footer>;
}
