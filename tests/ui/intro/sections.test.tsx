import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Hero, HowItWorks, IntroFooter, IntroHeader, PeerExchange, Questions, RewardsPreview, Why } from '@/components/intro';
import { getRewards } from '@/lib/content';

const all = () => render(<><IntroHeader /><Hero /><Why /><HowItWorks /><PeerExchange /><RewardsPreview rewards={getRewards()} /><Questions /><IntroFooter /></>);

it('says what HanLog is and where to start', () => {
  all();
  expect(screen.getByRole('heading', { level: 1, name: 'Speak Korean out in the world. Get a score that actually helps.' })).toBeInTheDocument();
  expect(screen.getByText('Real expressions, your real voice, feedback in seconds, and points you can spend.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Try a mission now' })).toHaveAttribute('href', '#try');
  expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '#how');
  expect(screen.getByRole('link', { name: 'Open the app' })).toHaveAttribute('href', '/app');
  expect(screen.getAllByText('한로그')[0]).toHaveAttribute('lang', 'ko');
});
it('has the sections in the spec, each with its heading', () => {
  all();
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(
    ["Why it's hard to get better", 'How it works', 'Trade expressions with Korean friends', 'Points you can spend', 'Questions']);
  const how = within(screen.getByRole('heading', { name: 'How it works' }).closest('section')!);
  expect(how.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(["Get today's expression", 'Say it for real', 'Get your score and your points']);
  expect(screen.getByRole('heading', { name: 'How it works' }).closest('section')).toHaveAttribute('id', 'how');
});
it('shows every example reward with the disclaimer', () => {
  all();
  for (const reward of getRewards()) expect(screen.getByText(reward.title)).toBeInTheDocument();
  expect(screen.getByText('Example rewards. Partners are not confirmed yet.')).toBeInTheDocument();
});
it('answers the four questions honestly', () => {
  all();
  expect(screen.getByText('No. It is practice feedback from an AI model, not an exam result.')).toBeInTheDocument();
  expect(screen.getByText(/is sent to OpenAI to be scored and is not saved/)).toBeInTheDocument();
  expect(screen.getByText(/stored for up to 14 days/)).toBeInTheDocument();
  expect(screen.getByText('No. This is a concept demo.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Read the privacy notice' })).toHaveAttribute('href', '/privacy');
  expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
  expect(screen.getByText('Concept demo · 2026')).toBeInTheDocument();
});
it('makes none of the forbidden claims', () => {
  const { container } = all();
  const text = container.textContent ?? '';
  for (const forbidden of [/official score/i, /TOPIK/i, /certified/i, /partner(ed|ship)? with/i, /sponsored by/i, /app store/i, /google play/i, /download the app/i, /redeem now/i, /guarantee/i])
    expect(text).not.toMatch(forbidden);
});
