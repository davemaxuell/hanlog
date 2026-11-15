import type { Reward } from '@/lib/contracts';
import { PointsChip } from '@/components/ui';
import styles from './intro.module.css';
export function RewardsPreview({ rewards }: { rewards: Reward[] }) {
  return <section data-section="rewards" className={styles.section} aria-labelledby="rewards-heading"><div className={styles.sectionHead}><h2 id="rewards-heading">Points you can spend</h2><p className={styles.muted}>A little motivation to keep speaking. Here is what future rewards could look like.</p></div><div className={styles.rewardGrid}>{rewards.map(reward => <article className={styles.reward} key={reward.id}><p className={styles.category}>{reward.category === 'kpop' ? 'Music' : reward.category}</p><h3>{reward.title}</h3><PointsChip balance={reward.cost} /></article>)}</div><p className={styles.disclaimer}>Example rewards. Partners are not confirmed yet.</p></section>;
}
