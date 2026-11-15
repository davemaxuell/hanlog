import styles from './intro.module.css';
import Link from 'next/link';
export function IntroHeader() {
  return <header data-section="header" className={styles.header}><Link className={styles.wordmark} href="/">HanLog <span lang="ko">한로그</span></Link><Link className={styles.headerLink} href="/app">Open the app</Link></header>;
}
