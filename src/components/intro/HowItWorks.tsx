import { MarginRow } from '@/components/ui';
import styles from './intro.module.css';
const steps = [
  ["Get today's expression", 'Choose a short mission for a real situation, from ordering a drink to making plans.'],
  ['Say it for real', 'Read the expression, find your voice, and record a short try. You can try again whenever you like.'],
  ['Get your score and your points', 'See what was clear and what to work on next. Earn points as your best score improves.'],
];
export function HowItWorks() {
  return <section data-section="how" id="how" className={styles.section} aria-labelledby="how-heading"><div className={styles.sectionHead}><h2 id="how-heading">How it works</h2><p className={styles.muted}>One useful expression. One small step forward.</p></div><div className={styles.steps}>{steps.map(([title, body], index) => <MarginRow label={`0${index + 1}`} key={title}><h3>{title}</h3><p>{body}</p></MarginRow>)}</div></section>;
}
