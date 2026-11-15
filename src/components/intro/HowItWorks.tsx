import { Microphone, ChatsCircle, ChartLineUp, Notebook } from '@phosphor-icons/react/ssr';
import styles from './intro.module.css';
const steps = [
  { title: 'Find your words', body: 'Choose something you can actually use today. Café orders, campus life, making plans and more.', icon: Notebook },
  { title: 'Give it a voice', body: 'Try a short recording. Get specific AI practice feedback, then try again at your own pace.', icon: Microphone },
  { title: 'Make a connection', body: 'Answer a peer challenge with a short voice or video clip. Give and receive thoughtful feedback.', icon: ChatsCircle },
  { title: 'Keep the good bits', body: 'Save expressions, revisit your feedback, and see the little moments of practice add up.', icon: ChartLineUp },
];
export function HowItWorks() {
  return <section data-section="how" id="how" className={styles.section} aria-labelledby="how-heading"><div className={styles.sectionHead}><p className={styles.eyebrow}>A small habit, a bigger world</p><h2 id="how-heading">Less studying for someday.<br />More speaking for today.</h2></div><div className={styles.steps}>{steps.map(({ title, body, icon: Icon }, index) => <article className={styles.step} key={title}><div className={styles.stepTop}><span>0{index + 1}</span><Icon size={36} weight="duotone" aria-hidden="true" /></div><h3>{title}</h3><p>{body}</p></article>)}</div></section>;
}
