import styles from './intro.module.css';
const reasons = [
  ["Koreans switch to English", 'You have the words in your head. Finding a moment to say them is the hard part.'],
  ["Textbook Korean isn't street Korean", 'A cafe, a group project, a chat with a friend. Everyday life has its own expressions.'],
  ['Nobody tells you how you really sound', 'A kind, specific tip can make your next try feel a little easier.'],
];
export function Why() {
  return <section data-section="why" className={styles.section} aria-labelledby="why-heading"><div className={styles.sectionHead}><p className={styles.eyebrow}>Small moments, familiar hurdles</p><h2 id="why-heading">Why it&apos;s hard to get better</h2></div><div className={styles.entries}>{reasons.map(([title, body], index) => <div className={styles.entry} key={title}><span className={styles.entryNumber}>0{index + 1}</span><h3>{title}</h3><p className={styles.muted}>{body}</p></div>)}</div></section>;
}
