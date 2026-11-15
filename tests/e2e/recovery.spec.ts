import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('an expired session returns to stable onboarding and can start again', async ({ page, context }) => {
  await page.goto('/app');
  await onboard(page, { nickname: 'Expiry check', role: 'learner' });
  const sessionCookie = (await context.cookies()).filter(cookie => cookie.name === 'hl_session');
  await page.getByRole('link', { name: 'Me', exact: true }).click();
  await page.getByLabel('Nickname').fill('Expired name');
  await context.clearCookies();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/onboarding/);
  await expect(page.getByLabel('Nickname')).toBeEditable();
  await onboard(page, { nickname: 'Fresh profile', role: 'learner' });
  await page.getByRole('link', { name: 'Me', exact: true }).click();
  await expect(page.getByLabel('Nickname')).toHaveValue('Fresh profile');
  // Both profiles are synthetic test data; remove them through their own sessions.
  expect((await page.request.delete('/api/session')).status()).toBe(204);
  await context.addCookies(sessionCookie);
  expect((await page.request.delete('/api/session')).status()).toBe(204);
});
