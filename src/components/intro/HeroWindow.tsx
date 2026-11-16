'use client';
import Link from 'next/link';
import { useRef, useState, type PointerEvent } from 'react';
import { ArrowUpRight, Microphone } from '@phosphor-icons/react';
import { useMotionPreference } from '@/components/motion/MotionPreference';
import styles from './intro.module.css';

const SAMPLE_PHRASES = [
  {
    id: 'cafe-iced-americano',
    tab: 'Café',
    context: 'A moment at the café',
    lines: ['아이스 아메리카노', '한 잔 주세요.'],
    meaning: 'One iced Americano, please.',
    href: '/app/missions/cafe-iced-americano',
  },
  {
    id: 'greet-nice-to-meet',
    tab: 'Campus',
    context: 'A moment on campus',
    lines: ['만나서', '반갑습니다.'],
    meaning: 'Nice to meet you.',
    href: '/app/missions/greet-nice-to-meet',
  },
  {
    id: 'campus-restroom',
    tab: 'Question',
    context: 'A quick question',
    lines: ['화장실이', '어디에 있어요?'],
    meaning: 'Where is the restroom?',
    href: '/app/missions/campus-restroom',
  },
] as const;

export function HeroWindow() {
  const [index, setIndex] = useState(0);
  const [switched, setSwitched] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);
  const motion = useMotionPreference();
  const reduced = motion?.reduced ?? false;
  const current = SAMPLE_PHRASES[index];

  const isReducedMotion = () =>
    reduced || Boolean(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || isReducedMotion() || !windowRef.current) return;
    const rect = windowRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = (event.clientX - rect.left) / rect.width - 0.5;
    const ny = (event.clientY - rect.top) / rect.height - 0.5;
    windowRef.current.style.setProperty('--tilt-x', `${(-ny * 5.5).toFixed(2)}deg`);
    windowRef.current.style.setProperty('--tilt-y', `${(nx * 6.5).toFixed(2)}deg`);
    windowRef.current.style.setProperty('--sky-x', `${(nx * 14).toFixed(1)}px`);
    windowRef.current.style.setProperty('--sky-y', `${(ny * 10).toFixed(1)}px`);
  };

  const resetTilt = () => {
    if (!windowRef.current) return;
    windowRef.current.style.setProperty('--tilt-x', '0deg');
    windowRef.current.style.setProperty('--tilt-y', '0deg');
    windowRef.current.style.setProperty('--sky-x', '0px');
    windowRef.current.style.setProperty('--sky-y', '0px');
  };

  return (
    <div
      ref={windowRef}
      className={styles.window}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
    >
      <div className={styles.windowSky} data-scene={index} aria-hidden="true">
        <span className={styles.starLarge}>✦</span>
        <span className={styles.sun} />
        <span className={styles.starSmall}>✦</span>
      </div>
      <div className={styles.phraseCard}>
        <div className={styles.phraseTop}>
          <span className={styles.phraseContext}>{current.context}</span>
          <div className={styles.phraseTabs} role="group" aria-label="Choose a sample everyday phrase">
            {SAMPLE_PHRASES.map((phrase, itemIndex) => (
              <button
                key={phrase.id}
                type="button"
                className={styles.phraseTab}
                aria-pressed={index === itemIndex}
                onClick={() => {
                  if (itemIndex === index) return;
                  setIndex(itemIndex);
                  setSwitched(true);
                }}
              >
                {phrase.tab}
              </button>
            ))}
          </div>
        </div>
        <div
          key={current.id}
          className={switched && !reduced ? `${styles.phraseBody} ${styles.phraseSwap}` : styles.phraseBody}
        >
          <p lang="ko">{current.lines[0]}<br />{current.lines[1]}</p>
          <span>{current.meaning}</span>
        </div>
        <Link href={current.href}>
          <Microphone size={20} weight="fill" aria-hidden="true" />
          Practise this phrase
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>
      <div className={styles.windowCaption}><span lang="ko">한록</span> Little moments. More you.</div>
    </div>
  );
}
