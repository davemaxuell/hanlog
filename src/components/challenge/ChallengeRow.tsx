import Link from 'next/link';
import { containsHangul, type Challenge } from '@/lib/contracts';
import { Ko } from '@/components/ui';
import styles from './community.module.css';
export function ChallengeRow({ challenge, status }: { challenge: Challenge; status?: string }) {
  return <Link href={`/app/challenges/${challenge.id}`} className={styles.challengeCard}>
    <span className={styles.cardByline}><span className={styles.avatar} aria-hidden="true">{challenge.author.nickname.slice(0, 1).toUpperCase()}</span><span>From <span lang={containsHangul(challenge.author.nickname) ? 'ko' : undefined}>{challenge.author.nickname}</span></span>{challenge.isSample && <span className={styles.sample}>Sample</span>}</span>
    <Ko className={styles.expression}>{challenge.korean}</Ko><span className={styles.meaning}>{challenge.meaningEn}</span>
    <span className={styles.cardFooter}><span>{status ?? (challenge.viewer.responded ? 'Answered' : challenge.viewer.pendingToRate ? `${challenge.viewer.pendingToRate} waiting` : 'Open')}</span><span aria-hidden="true">↗</span></span>
  </Link>;
}
