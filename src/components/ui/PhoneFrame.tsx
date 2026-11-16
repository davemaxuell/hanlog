import type { ReactNode } from 'react';
import { HouseLine, Books, ChatsCircle, ChartBar, UserCircle } from '@phosphor-icons/react/ssr';
import { BrandMark } from './BrandMark';
import styles from './phone.module.css';

export type PhoneTab = 'Today' | 'Practice' | 'Community' | 'Progress' | 'Me';
const tabs = [
  { label: 'Today', icon: HouseLine },
  { label: 'Practice', icon: Books },
  { label: 'Community', icon: ChatsCircle },
  { label: 'Progress', icon: ChartBar },
  { label: 'Me', icon: UserCircle },
] as const;

/**
 * A drawn phone running the HanLog app chrome. It is a picture: everything inside is hidden from
 * assistive technology, so the caller describes the screen in its own accessible text.
 */
export function PhoneFrame({ tab, points, children, className = '' }: { tab: PhoneTab; points: number; children: ReactNode; className?: string }) {
  return <div className={`${styles.device} ${className}`} data-phone-screen="" aria-hidden="true">
    <div className={styles.screen}>
      <div className={styles.status}><span>8:15</span><span className={styles.island} /><span className={styles.indicators}><i /><i /><i /><b /></span></div>
      <div className={styles.appHeader}>
        <span className={styles.wordmark}><BrandMark className={styles.brand} />HanLog</span>
        <span className={styles.points} key={points}>★ {points}</span>
      </div>
      <div className={styles.body}>{children}</div>
      <div className={styles.tabbar}>{tabs.map(({ label, icon: Icon }) =>
        <span key={label} className={label === tab ? styles.activeTab : undefined}><Icon size={17} weight={label === tab ? 'fill' : 'regular'} />{label}</span>)}
      </div>
    </div>
  </div>;
}
