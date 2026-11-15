import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => (await import('../_helpers')).navigationMock);
vi.mock('@/lib/api-client', async (original) => ({ ...(await original<typeof import('@/lib/api-client')>()), api: (await import('../_helpers')).mockApi }));

import IntroPage, { metadata } from '@/app/page';

it('lays the sections out in the spec order with the live panel third', () => {
  render(<IntroPage />);
  const order = [...document.querySelectorAll('header, main > section, footer')].map((el) => el.getAttribute('data-section'));
  expect(order).toEqual(['header', 'hero', 'try', 'why', 'how', 'peer', 'rewards', 'questions', 'footer']);
  expect(document.getElementById('try')).not.toBeNull();
  expect(document.getElementById('how')).not.toBeNull();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByText('아이스 아메리카노 한 잔 주세요.')).toBeInTheDocument();
});
it('describes itself for links and search', () => {
  expect(metadata.title).toBe('HanLog · Speak Korean out in the world');
  expect(String(metadata.description)).toContain('Real expressions, your real voice');
});
