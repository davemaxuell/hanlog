import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoConnection } from '@/components/demo/DemoConnection';
import { DemoFeedback } from '@/components/demo/DemoFeedback';
import { DemoProgress } from '@/components/demo/DemoProgress';
import { getMissions, getSampleChallenges } from '@/lib/content';
import type { AttemptResult } from '@/lib/contracts';
import { samples } from '../fixtures/api/samples';

const mission = getMissions()[0];
const challenge = getSampleChallenges().find(item => item.code === 'SMPL24')!;
const result: AttemptResult = {
  ...samples.attemptResult,
  balance: 37,
  bestOverall: 93,
  attempt: {
    ...samples.attemptResult.attempt,
    pointsAwarded: 7,
    score: {
      ...samples.attemptResult.attempt.score,
      overall: 79,
      pronunciation: 71,
      accuracy: 92,
      usage: 75,
      heard: '아이스 아메리카노 주세요.',
      praise: 'Your request was easy to follow.',
      nextTip: 'Keep the final consonant in the word for cup clear.',
      scoredBy: 'ai',
    },
  },
};

afterEach(() => vi.restoreAllMocks());

describe('demo feedback', () => {
  it('shows an honest illustration without turning a supplied attempt into an example result', () => {
    render(<DemoFeedback mission={mission} result={result} mode="example" />);
    expect(screen.getByText('Illustrative example · no audio analysed')).toBeVisible();
    expect(screen.getByText('Example transcript')).toBeVisible();
    expect(screen.getByText(mission.korean)).toHaveAttribute('lang', 'ko');
    expect(screen.queryByText(result.attempt.score.heard)).not.toBeInTheDocument();
    expect(screen.queryByText(/personal best|points earned|feedback saved/i)).not.toBeInTheDocument();
  });

  it('uses the actual live score, transcript, feedback, and awarded points', () => {
    render(<DemoFeedback mission={mission} result={result} mode="live" />);
    expect(screen.getByLabelText('Overall practice score: 79 out of 100')).toBeVisible();
    expect(screen.getByRole('meter', { name: 'Pronunciation' })).toHaveAttribute('aria-valuenow', '71');
    expect(screen.getByRole('meter', { name: 'Accuracy' })).toHaveAttribute('aria-valuenow', '92');
    expect(screen.getByRole('meter', { name: 'Naturalness' })).toHaveAttribute('aria-valuenow', '75');
    expect(screen.getByText(result.attempt.score.heard)).toHaveAttribute('lang', 'ko');
    expect(screen.getByText(result.attempt.score.praise)).toBeVisible();
    expect(screen.getByText(result.attempt.score.nextTip)).toBeVisible();
    expect(screen.getByText('+7 points this attempt')).toBeVisible();
    expect(screen.getByText('AI practice feedback')).toBeVisible();
    expect(screen.getByText('Use the feedback to guide your next attempt.')).toBeVisible();
    expect(screen.queryByText('Illustrative example · no audio analysed')).not.toBeInTheDocument();
  });

  it('preserves mock-scoring disclosure and never implies zero points were earned', () => {
    const mockResult: AttemptResult = {
      ...result,
      attempt: { ...result.attempt, pointsAwarded: 0, score: { ...result.attempt.score, scoredBy: 'mock' } },
    };
    render(<DemoFeedback mission={mission} result={mockResult} mode="live" />);
    expect(screen.getByText('Demo scoring, not AI')).toBeVisible();
    expect(screen.getByText('No points added this attempt')).toBeVisible();
    expect(screen.queryByText('AI practice feedback')).not.toBeInTheDocument();
  });

  it('labels the third meter for a use mission', () => {
    render(<DemoFeedback mission={getMissions().find(item => item.mode === 'use')!} result={null} mode="example" />);
    expect(screen.getByRole('meter', { name: 'Usage' })).toBeVisible();
    expect(screen.getByText('Illustrative example · no audio analysed')).toBeVisible();
    expect(screen.queryByText(/points this attempt/i)).not.toBeInTheDocument();
  });

  it('does not substitute example numbers for a missing live result', () => {
    render(<DemoFeedback mission={mission} result={null} mode="live" />);
    expect(screen.getByText('No live result yet.')).toBeVisible();
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    expect(screen.queryByText('Illustrative example · no audio analysed')).not.toBeInTheDocument();
  });
});

describe('demo connection', () => {
  it('uses the real sample challenge and distinguishes the exchange illustration from activity', () => {
    render(<DemoConnection challenge={challenge} />);
    expect(screen.getByText('Illustrative peer exchange')).toBeVisible();
    expect(screen.getByText(challenge.korean)).toHaveAttribute('lang', 'ko');
    expect(screen.getByLabelText('Sample expression meaning')).toHaveTextContent(challenge.meaningEn);
    expect(screen.getByText('꿀잼', { exact: true })).toHaveAttribute('lang', 'ko');
    expect(screen.getByText(challenge.situationEn)).toBeVisible();
    expect(screen.getByText('No recording sent · no peer rating received')).toBeVisible();
    expect(screen.getByRole('link', { name: /Open this sample challenge/i })).toHaveAttribute('href', `/c/${challenge.code}`);
    expect(screen.getByRole('link', { name: /Open this sample challenge/i })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: /Open this sample challenge/i })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByText(/verified|partner|online now|rated you/i)).not.toBeInTheDocument();
  });
});

describe('demo progress', () => {
  it('offers an accessible audience QR with its visible public destination', () => {
    render(<DemoProgress mission={mission} result={null} mode="example" />);
    expect(screen.getByText('Scan to try HanLog')).toBeVisible();
    expect(screen.getByText('hanlog-nine.vercel.app')).toBeVisible();
    const qr = screen.getByRole('img', { name: 'QR code to open HanLog at hanlog-nine.vercel.app' });
    expect(qr).toHaveAttribute('src', '/demo/hanlog-qr.svg');
    expect(qr).toHaveAttribute('width', '144');
    expect(qr).toHaveAttribute('height', '144');
    expect(screen.getByRole('link', { name: /Open HanLog website/i })).toHaveAttribute('href', 'https://hanlog-nine.vercel.app/');
    expect(screen.getByRole('link', { name: /Open HanLog website/i })).toHaveAttribute('target', '_blank');
  });

  it('labels the saved-expression and journal preview without claiming a saved result', () => {
    render(<DemoProgress mission={mission} result={result} mode="example" />);
    expect(screen.getByText('Illustrative preview · nothing saved')).toBeVisible();
    expect(screen.getByText('Saved-expression preview')).toBeVisible();
    expect(screen.getByText('Practice-journal preview')).toBeVisible();
    expect(screen.queryByText('Your feedback is saved.')).not.toBeInTheDocument();
    expect(screen.queryByText(/streak|personal best|points this attempt/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start your own practice/i })).toHaveAttribute('href', '/app');
  });

  it('shows the real completed result and progress link after a live attempt', () => {
    render(<DemoProgress mission={mission} result={result} mode="live" />);
    expect(screen.getByText('Your feedback is saved.')).toBeVisible();
    expect(screen.getByText('79 / 100')).toBeVisible();
    expect(screen.getByText('+7 points this attempt')).toBeVisible();
    expect(screen.getByText(result.attempt.score.nextTip)).toBeVisible();
    expect(screen.getByRole('link', { name: /Open my practice journal/i })).toHaveAttribute('href', '/app/progress');
    expect(screen.queryByText('Illustrative preview · nothing saved')).not.toBeInTheDocument();
  });

  it('does not claim saved feedback before a live result exists', () => {
    render(<DemoProgress mission={mission} result={null} mode="live" />);
    expect(screen.getByText('No live result yet.')).toBeVisible();
    expect(screen.queryByText('Illustrative preview · nothing saved')).not.toBeInTheDocument();
    expect(screen.queryByText('Your feedback is saved.')).not.toBeInTheDocument();
  });
});

it.each(['example', 'live'] as const)('renders %s story panels without API calls or browser-storage writes', mode => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
  render(<>
    <DemoFeedback mission={mission} result={result} mode={mode} />
    <DemoConnection challenge={challenge} />
    <DemoProgress mission={mission} result={result} mode={mode} />
  </>);
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(storageSpy).not.toHaveBeenCalled();
});
