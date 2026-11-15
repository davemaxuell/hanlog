import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => (await import('../_helpers')).navigationMock);
vi.mock('@/lib/api-client', async (original) => ({ ...(await original<typeof import('@/lib/api-client')>()), api: (await import('../_helpers')).mockApi }));

import IntroPage, { metadata } from '@/app/page';

it('introduces the everyday practice loop and keeps a linked live practice panel', () => {
  render(<IntroPage />);
  const order = [...document.querySelectorAll('header, main > section, footer')].map((el) => el.getAttribute('data-section'));
  expect(order).toEqual(['header', 'hero', 'how', 'why', 'peer', 'try', 'rewards', 'questions', 'footer']);
  expect(document.getElementById('try')).not.toBeNull();
  expect(document.getElementById('how')).not.toBeNull();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(document.getElementById('try')).toHaveTextContent('아이스 아메리카노 한 잔 주세요.');
});
it('describes itself for links and search', () => {
  expect(metadata.title).toBe('HanLog · Your day, in Korean');
  expect(String(metadata.description)).toContain('Short speaking missions');
  expect(String(metadata.description)).not.toContain('points you can spend');
});
