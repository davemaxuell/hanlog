import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import Privacy from '@/app/privacy/page';

it('says what is collected, where it goes, how long it stays, and how to delete it', () => {
  const { container } = render(<Privacy />);
  expect(screen.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeInTheDocument();
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Who runs this', 'What we collect', 'Where it goes', 'How long we keep it', 'How to delete it', 'Age']);
  const text = container.textContent ?? '';
  for (const fact of ['nickname', 'OpenAI', 'Supabase', 'Vercel', '14 days', 'Delete my data', '14 or older', 'not saved'])
    expect(text).toContain(fact);
  expect(screen.getByRole('link', { name: "OpenAI's privacy policy" }).getAttribute('href')).toMatch(/^https:\/\/openai\.com\//);
  expect(screen.getByRole('link', { name: 'Back to HanLog' })).toHaveAttribute('href', '/');
  expect(text).not.toMatch(/we never|100% secure|guarantee/i);
  expect(text).toContain('HanLog team');
  expect(text).toContain('local demo');
  expect(text).toContain('without your profile ID');
});
