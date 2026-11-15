import styles from './intro.module.css';
export function Why() {
  return <section data-section="why" className={styles.insight} aria-labelledby="why-heading"><span className={styles.insightStar} aria-hidden="true">✦</span><div><p className={styles.eyebrow}>Made for life between classes</p><h2 id="why-heading">You already have a full day.<br />Korean can be part of it.</h2><p>A few words before your coffee. A voice note to someone new. Small practice that fits the life you&apos;re already living.</p></div></section>;
}
