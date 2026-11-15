/* eslint-disable react/no-unescaped-entities */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Button, Field, Ko, Meter, PointsChip, Stars, StatusNote } from '@/components/ui';

it('Button disables itself while busy and says why', async () => {
  const onClick = vi.fn();
  render(<Button busy busyLabel="Listening…" onClick={onClick}>Get my score</Button>);
  const button = screen.getByRole('button', { name: 'Listening…' });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
  await userEvent.click(button);
  expect(onClick).not.toHaveBeenCalled();
});
it('Field ties label, hint, error, and counter to the input', () => {
  render(<Field label="Nickname" hint="2 to 20 characters" error="Too short" counter={{ value: 1, max: 20 }} defaultValue="a" />);
  const input = screen.getByLabelText('Nickname');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription(/Too short/);
  expect(screen.getByText('1 / 20')).toBeInTheDocument();
});
it('Stars works as a radio group with keyboard and pointer', async () => {
  const onChange = vi.fn();
  render(<Stars label="Pronunciation" value={null} onChange={onChange} />);
  expect(screen.getByRole('radiogroup', { name: 'Pronunciation' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('radio', { name: '4 stars' }));
  expect(onChange).toHaveBeenCalledWith(4);
});
it('Stars is a labelled image when read-only', () => {
  render(<Stars label="Naturalness" value={4} />);
  expect(screen.getByRole('img', { name: 'Naturalness: 4 out of 5' })).toBeInTheDocument();
  expect(screen.queryByRole('radio')).toBeNull();
});
it('StatusNote announces politely, and errors assertively', () => {
  render(<><StatusNote tone="success">Saved.</StatusNote><StatusNote tone="error">That didn't score yet. Try again.</StatusNote></>);
  expect(screen.getByRole('status')).toHaveTextContent('Saved.');
  expect(screen.getByRole('alert')).toHaveTextContent("That didn't score yet. Try again.");
});
it('Meter exposes its value and shows the number', () => {
  render(<Meter label="Pronunciation" value={84} />);
  const meter = screen.getByRole('meter', { name: 'Pronunciation' });
  expect(meter).toHaveAttribute('aria-valuenow', '84');
  expect(screen.getByText('84')).toBeInTheDocument();
});
it('Ko marks Korean text and PointsChip shows the balance', () => {
  render(<><Ko as="p">안녕하세요</Ko><PointsChip balance={120} /><PointsChip balance={null} /></>);
  expect(screen.getByText('안녕하세요')).toHaveAttribute('lang', 'ko');
  expect(screen.getByText('★ 120 points')).toBeInTheDocument();
  expect(screen.getByText('★ …')).toBeInTheDocument();
});
