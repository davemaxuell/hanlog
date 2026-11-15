import styles from './intro.module.css';
import Link from 'next/link';
import { BrandMark } from '@/components/ui/BrandMark';
export function IntroFooter() {
  return <footer data-section="footer" className={styles.footer}><div><Link className={styles.wordmark} href="/"><BrandMark />HanLog <span lang="ko">한록</span></Link><p className={styles.footerNote}>A little Korean, every day. Made by the HanLog team.</p></div><div className={styles.footerLinks}><Link href="/help">Help & community guide</Link><Link href="/privacy">Privacy</Link><Link href="/app/onboarding?mode=restore">Restore your profile</Link></div></footer>;
}
