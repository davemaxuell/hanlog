'use client';
import { useEffect, useState } from 'react';
import { ChatsCircle, Play, Stop } from '@phosphor-icons/react';
import { useMotionPreference } from '@/components/motion/MotionPreference';
import styles from './intro.module.css';

const BAR_HEIGHTS = [18, 30, 24, 42, 28, 38, 18, 32, 44, 26, 36, 18];

export function ExchangeShowcase() {
  const [playing, setPlaying] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const motion = useMotionPreference();
  const reduced = motion?.reduced ?? false;

  useEffect(() => {
    if (!playing) return;
    const timeout = window.setTimeout(() => setPlaying(false), reduced ? 900 : 1650);
    return () => window.clearTimeout(timeout);
  }, [playing, reduced]);

  return (
    <div className={styles.exchange} data-playing={playing ? 'true' : undefined} aria-label="Example of a peer exchange">
      <div className={styles.exchangeHeader}>
        <ChatsCircle size={28} weight="duotone" aria-hidden="true" />
        <span>What an exchange looks like</span>
      </div>
      <div className={styles.expressionBubble}>
        <span>A phrase to try</span>
        <p lang="ko">이거 완전 꿀잼이야.</p>
        <p>That was so much fun.</p>
      </div>
      <div className={styles.replyBubble}>
        <div className={styles.replyHead}>
          <div>
            <strong>Your turn</strong>
            <p>Say it in a short voice or video reply.</p>
          </div>
          <button
            type="button"
            className={styles.waveButton}
            aria-pressed={playing}
            aria-label={playing ? 'Stop voice wave preview' : 'Preview voice wave'}
            onClick={() => setPlaying(prev => !prev)}
          >
            {playing ? <Stop size={15} weight="fill" aria-hidden="true" /> : <Play size={15} weight="fill" aria-hidden="true" />}
            <span>{playing ? 'Playing' : 'Preview'}</span>
          </button>
        </div>
        <div
          className={styles.wave}
          data-playing={playing && !reduced ? 'true' : undefined}
          aria-hidden="true"
          onPointerLeave={() => setHoveredBar(null)}
        >
          {BAR_HEIGHTS.map((height, i) => {
            const distance = hoveredBar === null ? 99 : Math.abs(hoveredBar - i);
            const hoverBoost = !reduced && distance <= 2 ? (distance === 0 ? 1.32 : distance === 1 ? 1.18 : 1.07) : 1;
            return (
              <i
                key={i}
                style={{
                  height,
                  ['--bar-i' as string]: i,
                  ['--bar-boost' as string]: hoverBoost,
                }}
                onPointerEnter={() => { if (!reduced) setHoveredBar(i); }}
              />
            );
          })}
        </div>
      </div>
      <div className={styles.feedbackBubble}>
        <span aria-hidden="true">✦</span>
        <p>A kind, specific tip.<br /><strong>One more reason to speak again.</strong></p>
      </div>
      <p className={styles.exampleNote}>Illustrated exchange · feedback comes from real participants.</p>
    </div>
  );
}
