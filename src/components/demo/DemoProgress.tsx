import Image from 'next/image';
import { ArrowUpRight, Check, Notebook } from '@phosphor-icons/react/ssr';
import type { AttemptResult, Mission } from '@/lib/contracts';
import { Ko, Surface } from '@/components/ui';
import styles from './story.module.css';

type DemoProgressProps = {
  mission: Mission;
  result: AttemptResult | null;
  mode: 'example' | 'live';
};

export function DemoProgress({ mission, result, mode }: DemoProgressProps) {
  const liveResult = mode === 'live' ? result : null;

  if (mode === 'live' && !liveResult) {
    return <section className={styles.story} aria-labelledby="demo-progress-heading">
      <header className={styles.heading}>
        <p className={styles.eyebrow}>Your HanLog</p>
        <h2 id="demo-progress-heading">No live result yet.</h2>
        <p>Complete a practice attempt to add its feedback to your journal.</p>
      </header>
      <Surface className={styles.emptyPanel}>
        <Notebook size={36} weight="duotone" aria-hidden="true" />
        <p>This walkthrough has not completed a live practice attempt yet.</p>
      </Surface>
    </section>;
  }

  return <section className={styles.story} aria-labelledby="demo-progress-heading">
    <header className={styles.heading}>
      <p className={styles.eyebrow}>Your HanLog</p>
      <h2 id="demo-progress-heading">A little practice.<br />Something to build on.</h2>
    </header>
    <div className={styles.progressGrid}>
      <div className={styles.progressCopy}>
        <p className={styles.lead}>{liveResult ? 'Your feedback is saved.' : 'Keep the expressions. Return to the feedback.'}</p>
        <p className={styles.secondary}>{liveResult
          ? 'Revisit this attempt in your practice journal, then bring one small change to your next try.'
          : 'Save expressions you want to use. After each practice attempt, your score and next tip stay in your journal.'}</p>
        <div className={styles.audienceEntry}>
          <Image className={styles.audienceQr} src="/demo/hanlog-qr.svg" width={144} height={144} alt="QR code to open HanLog at hanlog-nine.vercel.app" unoptimized loading="eager" />
          <div className={styles.audienceCopy}>
            <p className={styles.label}>Scan to try HanLog</p>
            <p className={styles.audienceDomain}>hanlog-nine.vercel.app</p>
            <a className={`hl-link-button ${styles.audienceButton}`} href="https://hanlog-nine.vercel.app/" target="_blank" rel="noopener noreferrer">
              Open HanLog website <ArrowUpRight size={18} aria-hidden="true" />
            </a>
            <a className={styles.textLink} href={liveResult ? '/app/progress' : '/app'} target="_blank" rel="noopener noreferrer">
              {liveResult ? 'Open my practice journal' : 'Start your own practice'} <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
      <Surface className={styles.journalPanel}>
        {liveResult
          ? <p className={styles.savedLabel}><Check size={18} weight="bold" aria-hidden="true" /> Latest completed attempt</p>
          : <p className={styles.disclosure}>Illustrative preview · nothing saved</p>}
        <div className={styles.expressionEntry}>
          <p className={styles.label}>{liveResult ? 'Expression practised' : 'Saved-expression preview'}</p>
          <Ko as="p" className={styles.journalPhrase}>{mission.korean}</Ko>
          <p className={styles.secondary}>{mission.meaningEn}</p>
        </div>
        <div className={styles.journalEntry}>
          <p className={styles.label}>{liveResult ? 'In your practice journal' : 'Practice-journal preview'}</p>
          {liveResult ? <>
            <div className={styles.journalScore}>
              <strong>{liveResult.attempt.score.overall} / 100</strong>
              <span>{liveResult.attempt.pointsAwarded > 0
                ? `+${liveResult.attempt.pointsAwarded} points this attempt`
                : 'No points added this attempt'}</span>
            </div>
            <p className={styles.caption}>{liveResult.attempt.score.scoredBy === 'mock' ? 'Demo scoring, not AI' : 'AI practice feedback'}</p>
            <p className={styles.journalTip}>{liveResult.attempt.score.nextTip}</p>
          </> : <>
            <p className={styles.journalPlaceholder}>Your voice → feedback → your next try</p>
            <p className={styles.caption}>A completed attempt adds its score and a practical next step here.</p>
          </>}
        </div>
        {liveResult && <a className={styles.textLink} href={`/app/missions/${mission.id}`} target="_blank" rel="noopener noreferrer">Practise this expression <ArrowUpRight size={18} aria-hidden="true" /></a>}
      </Surface>
    </div>
  </section>;
}
