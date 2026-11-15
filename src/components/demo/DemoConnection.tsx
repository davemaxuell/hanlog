import { ArrowUpRight, ChatCircleText, Microphone } from '@phosphor-icons/react/ssr';
import { Ko, Surface } from '@/components/ui';
import type { SampleChallenge } from '@/lib/content';
import styles from './story.module.css';

export function DemoConnection({ challenge }: { challenge: SampleChallenge }) {
  return <section className={styles.story} aria-labelledby="demo-connection-heading">
    <header className={styles.heading}>
      <p className={styles.eyebrow}>From practice to people</p>
      <h2 id="demo-connection-heading">A phrase. A little connection.</h2>
    </header>
    <div className={styles.connectionGrid}>
      <div className={styles.connectionCopy}>
        <p className={styles.lead}>Try an expression you might hear from a Korean-speaking friend.</p>
        <div className={styles.context}>
          <p className={styles.label}>When you would say it</p>
          <p>{challenge.situationEn}</p>
        </div>
        <p className={styles.secondary}>In the app, share a short recording and exchange practical feedback with another participant.</p>
        <div className={styles.linkGroup}>
          <a className="hl-link-button" href={`/c/${challenge.code}`} target="_blank" rel="noopener noreferrer">
            Open this sample challenge <ArrowUpRight size={20} aria-hidden="true" />
          </a>
          <p className={styles.caption}>Opens the app in a new tab.</p>
        </div>
      </div>
      <Surface className={styles.exchangePanel}>
        <p className={styles.disclosure}>Illustrative peer exchange</p>
        <div className={styles.promptBubble}>
          <p className={styles.role}><ChatCircleText size={20} aria-hidden="true" /> Korean peer · sample prompt</p>
          <Ko as="p" className={styles.challengePhrase}>{challenge.korean}</Ko>
          <p className={styles.challengeMeaning} aria-label="Sample expression meaning">
            {challenge.meaningEn.split(/([가-힣ㄱ-ㅎㅏ-ㅣ]+)/u).map((part, index) => /[가-힣ㄱ-ㅎㅏ-ㅣ]/u.test(part) ? <Ko key={index}>{part}</Ko> : part)}
          </p>
        </div>
        <div className={styles.replyBubble}>
          <p className={styles.role}><Microphone size={20} aria-hidden="true" /> Learner · your turn</p>
          <p>Try the expression in your own voice.</p>
        </div>
        <div className={styles.peerTip}>
          <p className={styles.role}>Korean peer · possible follow-up</p>
          <p>A tip on pronunciation. A note on when to use it.</p>
        </div>
        <p className={styles.caption}>No recording sent · no peer rating received</p>
      </Surface>
    </div>
  </section>;
}
