import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
it('renders in jsdom', () => {
  render(<p lang="ko">한로그</p>);
  expect(screen.getByText('한로그')).toBeInTheDocument();
});
