import { ArrowRight, ChatCircleText } from '@phosphor-icons/react/ssr';
import type { AttemptResult, Mission, Score } from '@/lib/contracts';
import { Ko, Meter, Surface } from '@/components/ui';
import styles from './story.module.css';

// Presentation-only values: these are never an attempt or an earned balance.
const illustrativeFeedback = Object.freeze({
  overall: 88,
  pronunciation: 84,
  accuracy: 96,
  usage: 88,
  praise: 'The main words came through clearly.',
  nextTip: 'Say the sentence slowly once. Then repeat it at a comfortable, connected pace.',
} satisfies Readonly<Pick<Score, 'overall' | 'pronunciation' | 'accuracy' | 'usage' | 'praise' | 'nextTip'>>);

type DemoFeedbackProps = {
  mission: Mission;
  result: AttemptResult | null;
  mode: 'example' | 'live';
};

export function DemoFeedback({ mission, result, mode }: DemoFeedbackProps) {
  const liveResult = mode === 'live' ? result : null;

  if (mode === 'live' && !liveResult) {
    return <section className={styles.story} aria-labelledby="demo-feedback-heading">
      <header className={styles.heading}>
        <p className={styles.eyebrow}>Feedback</p>
        <h2 id="demo-feedback-heading">No live result yet.</h2>
        <p>Finish a recording in Practice to see the feedback from that attempt here.</p>
      </header>
      <Surface className={styles.emptyPanel}>
        <ChatCircleText size={36} weight="duotone" aria-hidden="true" />
        <p>Your transcript, practice score, and one next step will appear after scoring finishes.</p>
      </Surface>
    </section>;
  }

  const score = liveResult?.attempt.score ?? { ...illustrativeFeedback, heard: mission.korean };

  return <section className={styles.story} aria-labelledby="demo-feedback-heading">
    <header className={styles.heading}>
      <p className={styles.eyebrow}>Feedback that keeps you speaking</p>
      <h2 id="demo-feedback-heading">A clear next step.</h2>
      <p>What came through. What to try next.</p>
    </header>
    <p className={styles.disclosure}>
      {liveResult
        ? liveResult.attempt.score.scoredBy === 'mock' ? 'Demo scoring, not AI' : 'AI practice feedback'
        : 'Illustrative example · no audio analysed'}
    </p>
    <div className={styles.feedbackGrid}>
      <Surface className={styles.scorePanel}>
        <div className={styles.scoreTop}>
          <div>
            <p className={styles.label}>{liveResult ? 'Your practice score' : 'Example practice score'}</p>
            <p className={styles.scoreValue} aria-label={`Overall practice score: ${score.overall} out of 100`}>
              <strong>{score.overall}</strong><span>/ 100</span>
            </p>
          </div>
          <span className={styles.scoreMark} aria-hidden="true">✦</span>
        </div>
        <div className={styles.meters}>
          <Meter label="Pronunciation" value={score.pronunciation} />
          <Meter label="Accuracy" value={score.accuracy} />
          <Meter label={mission.mode === 'repeat' ? 'Naturalness' : 'Usage'} value={score.usage} />
        </div>
        <p className={styles.caption}>Use the feedback to guide your next attempt.</p>
      </Surface>
      <div className={styles.feedbackCopy}>
        <div className={styles.transcript}>
          <p className={styles.label}>{liveResult ? 'We heard' : 'Example transcript'}</p>
          <Ko as="p" className={styles.heard}>{score.heard}</Ko>
          <p className={styles.praise}>{score.praise}</p>
        </div>
        <div className={styles.nextTip}>
          <p className={styles.label}><ArrowRight size={20} aria-hidden="true" /> One thing to try next</p>
          <p>{score.nextTip}</p>
        </div>
        {liveResult && <p className={styles.points}>
          {liveResult.attempt.pointsAwarded > 0
            ? `+${liveResult.attempt.pointsAwarded} points this attempt`
            : 'No points added this attempt'}
        </p>}
      </div>
    </div>
  </section>;
}
