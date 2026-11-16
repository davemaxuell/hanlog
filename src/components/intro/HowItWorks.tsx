import styles from './intro.module.css';
import { IntroReveal } from './IntroReveal';
import { AppTour } from './AppTour';
export function HowItWorks() {
  return <IntroReveal data-section="how" id="how" className={styles.section} aria-labelledby="how-heading"><div className={styles.sectionHead}><p className={styles.eyebrow}>A small habit, a bigger world</p><h2 id="how-heading">Less studying for someday.<br />More speaking for today.</h2></div><AppTour /></IntroReveal>;
}
