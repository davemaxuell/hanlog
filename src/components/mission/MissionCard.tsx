import Link from 'next/link';
import type { MissionWithProgress } from '@/lib/contracts';
import { Ko } from '@/components/ui';
import styles from './learning.module.css';

export function MissionCard({ mission, saved, saving = false, onToggleSaved }: {
  mission: MissionWithProgress; saved?: boolean; saving?: boolean; onToggleSaved?(id: string, saved: boolean): void;
}) {
  const status = mission.bestOverall === null ? 'New expression' : mission.bestOverall >= 80 ? 'Strong result' : 'Keep practising';
  return <article className={styles.card} data-level={mission.level}>
    <div className={styles.cardTop}><span className={styles.cardLabel}>Level {mission.level} · {mission.tags[0] ?? 'Everyday Korean'}</span>{onToggleSaved && <button type="button" className={styles.save} disabled={saving} aria-pressed={!!saved} aria-label={`${saved ? 'Remove saved expression' : 'Save expression'}: ${mission.meaningEn}`} onClick={() => onToggleSaved(mission.id, !saved)}><span aria-hidden="true">{saved ? '★' : '☆'}</span></button>}</div>
    <Link href={`/app/missions/${mission.id}`} className={styles.cardLink}><Ko className={styles.cardExpression}>{mission.korean}</Ko><span className={styles.cardMeaning}>{mission.meaningEn}</span><span className={styles.cardFooter}><span><b>{status}</b><span>{mission.bestOverall === null ? `Up to ${mission.basePoints} points` : `Best ${mission.bestOverall} · ${mission.pointsEarned}/${mission.basePoints} points`}</span></span><span className={styles.arrow} aria-hidden="true">→</span></span></Link>
  </article>;
}
