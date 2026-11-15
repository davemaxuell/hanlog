import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import Help from '@/app/help/page';

it('provides usable help routes and honest recovery, reporting, and AI guidance', () => {
  const { container } = render(<Help />);
  expect(screen.getByRole('heading', { level: 1, name: 'A little help for your next try.' })).toBeInTheDocument();
  for (const link of screen.getByRole('navigation', { name: 'Help topics' }).querySelectorAll('a')) {
    const target = link.getAttribute('href');
    expect(target).toMatch(/^#/);
    expect(container.querySelector(target!)).toBeInTheDocument();
  }
  const text = container.textContent ?? '';
  for (const fact of ['not a validated language assessment', 'Roles are self-selected', 'Reporting a challenge hides it from your own view', 'Reporting an answer immediately hides its recording', 'Save the new one', 'retry within five minutes', 'recording files are not included', 'does not make these features available offline'])
    expect(text).toContain(fact);
  expect(screen.getByRole('link', { name: 'Open HanLog' })).toHaveAttribute('href', '/app');
  expect(screen.getByRole('link', { name: 'Read the privacy notice →' })).toHaveAttribute('href', '/privacy');
});
