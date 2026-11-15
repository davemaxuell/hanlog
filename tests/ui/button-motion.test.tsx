import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/Button';
import { Meter } from '@/components/ui/Meter';

it('shows a decorative busy indicator only during the real pending state and keeps the button locked', async () => {
  const submit = vi.fn();
  const { rerender } = render(<Button busy busyLabel="Listening…" onClick={submit}>Get my score</Button>);
  const busy = screen.getByRole('button', { name: 'Listening…' });
  expect(busy).toBeDisabled();
  expect(busy).toHaveAttribute('aria-busy', 'true');
  expect(busy.querySelector('.hl-busy-indicator')).toHaveAttribute('aria-hidden', 'true');
  await userEvent.click(busy);
  expect(submit).not.toHaveBeenCalled();
  rerender(<Button onClick={submit}>Get my score</Button>);
  const ready = screen.getByRole('button', { name: 'Get my score' });
  expect(ready.querySelector('.hl-busy-indicator')).toBeNull();
  expect(ready).not.toHaveAttribute('aria-busy');
  await userEvent.click(ready);
  expect(submit).toHaveBeenCalledOnce();
});

it('does not suggest background work for an ordinary disabled button', () => {
  render(<Button disabled>Save</Button>);
  const button = screen.getByRole('button', { name: 'Save' });
  expect(button.querySelector('.hl-busy-indicator')).toBeNull();
  expect(button).not.toHaveAttribute('aria-busy');
});

it('exposes the actual score immediately while the decorative fill is transformed', () => {
  const { rerender } = render(<Meter label="Pronunciation" value={84} />);
  const meter = screen.getByRole('meter', { name: 'Pronunciation' });
  expect(meter).toHaveAttribute('aria-valuenow', '84');
  expect(screen.getByText('84')).toBeVisible();
  expect(meter.querySelector('.hl-meter-fill')).toHaveStyle({ transform: 'scaleX(0.84)' });
  rerender(<Meter label="Pronunciation" value={0} />);
  expect(meter).toHaveAttribute('aria-valuenow', '0');
  expect(meter.querySelector('.hl-meter-fill')).toHaveStyle({ transform: 'scaleX(0)' });
});
