import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ScoreCard } from '@/components/mission/ScoreCard';
import { errorCopy } from '@/lib/ui/error-copy';
import { samples } from '../fixtures/api/samples';

const repeat = samples.missions.find((m) => m.mode === 'repeat')!;
const use = samples.missions.find((m) => m.mode === 'use')!;
const result = (over: object = {}, score: object = {}): import('@/lib/contracts').AttemptResult => ({ ...samples.attemptResult, ...over, attempt: { ...samples.attemptResult.attempt, ...over, score: { ...samples.attemptResult.attempt.score, overall: 88, pronunciation: 84, accuracy: 96, usage: 88, heard: '아이스 아메리카노 한 잔 주세요', issues: [{ segment: '잔', problem: 'The final ㄴ was soft.', tip: 'Touch the tongue tip behind your teeth.' }], praise: 'Clear and confident.', nextTip: 'Try natural speed.', scoredBy: 'ai' as const, ...score } } });

it('shows the score, the three bars, what was heard, and the feedback', () => {
  render(<ScoreCard result={result({ pointsAwarded: 10 })} mission={repeat} onRetry={vi.fn()} nextHref="/app" />);
  expect(screen.getByRole('heading', { name: '88' })).toBeInTheDocument();
  for (const name of ['Pronunciation', 'Accuracy', 'Naturalness']) expect(screen.getByRole('meter', { name })).toBeInTheDocument();
  expect(screen.getByText('아이스 아메리카노 한 잔 주세요')).toHaveAttribute('lang', 'ko');
  expect(screen.getByText('The final ㄴ was soft.')).toBeInTheDocument();
  expect(screen.getByText('Touch the tongue tip behind your teeth.')).toBeInTheDocument();
  expect(screen.getByText('Clear and confident.')).toBeInTheDocument();
  expect(screen.getByText('+10 points')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Next mission' })).toHaveAttribute('href', '/app');
  expect(screen.queryByText('Demo scoring, not AI')).toBeNull();
});
it('labels the third bar Usage for use missions', () => {
  render(<ScoreCard result={result()} mission={use} onRetry={vi.fn()} />);
  expect(screen.getByRole('meter', { name: 'Usage' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Next mission' })).toBeNull();
});
it('explains a zero-point attempt and flags mock scoring', () => {
  render(<ScoreCard result={result({ pointsAwarded: 0 }, { overall: 42, scoredBy: 'mock' })} mission={repeat} onRetry={vi.fn()} />);
  expect(screen.getByText('No points this time. Scores of 50 and above earn points.')).toBeInTheDocument();
  expect(screen.getByText('Demo scoring, not AI')).toBeInTheDocument();
});
it('has wording for every error code', () => {
  expect(errorCopy('no_speech')).toBe("We couldn't hear any Korean. Move closer to the mic and try again.");
  expect(errorCopy('daily_limit')).toBe("You've reached today's practice limit. Come back tomorrow!");
  expect(errorCopy('budget_exhausted')).toBe('HanLog is resting for today. Too many learners at once. Try again tomorrow.');
  expect(errorCopy('scoring_failed')).toBe("That didn't score yet. Try again.");
  expect(errorCopy('content_rejected')).toBe('Please rephrase that. We keep HanLog friendly for everyone.');
  expect(errorCopy('undecodable')).toBe("That recording didn't work. Please record again.");
  expect(errorCopy('conflict')).toBe('This answer has already been rated.');
  expect(errorCopy('unauthenticated')).toBe('');
});
