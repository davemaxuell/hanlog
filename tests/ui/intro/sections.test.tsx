import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Hero, HowItWorks, IntroFooter, IntroHeader, PeerExchange, Questions, RewardsPreview, Why } from '@/components/intro';
import { getRewards } from '@/lib/content';
const all = () => render(<><IntroHeader /><Hero /><Why /><HowItWorks /><PeerExchange /><RewardsPreview rewards={getRewards()} /><Questions /><IntroFooter /></>);
it('introduces everyday Korean with working practice and return paths', () => {
  all();
  expect(screen.getByRole('heading', { level:1, name:/Your day.*In Korean/ })).toBeInTheDocument();
  expect(screen.getByRole('link', { name:'Try a mission now' })).toHaveAttribute('href','#try');
  expect(screen.getByRole('link', { name:'How it works' })).toHaveAttribute('href','#how');
  expect(screen.getByRole('link', { name:'Open the app' })).toHaveAttribute('href','/app');
  expect(screen.getByRole('link', { name:'Already here? Come back' })).toHaveAttribute('href','/app/onboarding?mode=restore');
  expect(screen.getAllByText('한록')[0]).toHaveAttribute('lang','ko');
});
it('connects practice, peer exchange, and continuing progress', () => {
  all();
  const section = screen.getByRole('heading', { name:/Less studying for someday/ }).closest('section')!;
  expect(section).toHaveAttribute('id','how');
  expect(within(section).getAllByRole('heading',{level:3}).map(h=>h.textContent)).toEqual(['Find your words','Give it a voice','Make a connection','Keep the good bits']);
  expect(screen.getByRole('link',{name:'Explore the challenges'})).toHaveAttribute('href','/app/challenges');
  expect(screen.getByText(/Illustrated exchange/)).toBeInTheDocument();
});
it('gives points an honest participation purpose without promising redemption', () => {
  all();
  expect(screen.getByRole('heading',{name:'Your own phrasebook'})).toBeInTheDocument();
  expect(screen.getByText('Points track participation. Partner rewards and redemption are not available.')).toBeInTheDocument();
  expect(screen.queryByText('Points you can spend')).not.toBeInTheDocument();
});
it('explains AI limits, private recording retention, recovery and support', () => {
  all();
  expect(screen.getByText(/not an exam result/)).toBeInTheDocument();
  expect(screen.getByText(/sent to OpenAI for scoring and is not saved/)).toBeInTheDocument();
  expect(screen.getByText(/available for up to 14 days/)).toBeInTheDocument();
  expect(screen.getByText(/there is no email or password reset/)).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Read the privacy notice'})).toHaveAttribute('href','/privacy');
  expect(screen.getByRole('link',{name:'Get recording help'})).toHaveAttribute('href','/help');
  expect(screen.getByRole('link',{name:'Restore your profile'})).toHaveAttribute('href','/app/onboarding?mode=restore');
});
it('makes none of the unverified claims', () => {
  const { container }=all();
  for(const forbidden of [/official score/i,/TOPIK/i,/certified/i,/partner(ed|ship)? with/i,/sponsored by/i,/app store/i,/google play/i,/redeem now/i,/guarantee/i]) expect(container.textContent).not.toMatch(forbidden);
});
