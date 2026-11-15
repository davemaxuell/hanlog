import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

// Also suppress Playwright's implicit failure DOM snapshot in this worker.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

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

test('another tab updates the visible profile and clears the previous profile draft', async ({ page, context }) => {
  await page.goto('/app');
  await onboard(page, { nickname: 'Tab check', role: 'learner' });
  await page.getByRole('link', { name: 'Me', exact: true }).click();
  await page.getByLabel('Nickname').fill('An unsaved draft');
  const other = await context.newPage();
  try {
    await other.goto('/app/me');
    await other.getByRole('radio', { name: /I speak Korean/ }).click();
    await expect(other.getByRole('radio', { name: /I speak Korean/ })).toBeChecked();
    await expect(page.getByRole('radio', { name: /I speak Korean/ })).toBeChecked();
    await expect(page.getByLabel('Nickname')).toHaveValue('Tab check');
    // Exercise the real UI's cross-tab session notification. A raw request
    // bypasses it, and bringToFront need not create a focus event headlessly.
    await other.getByRole('button', { name: 'Delete my data', exact: true }).click();
    await other.getByRole('dialog', { name: 'Delete your data?' }).getByRole('button', { name: 'Yes, delete everything', exact: true }).click();
    await expect(other).toHaveURL(/\/$/);
    await expect(page).toHaveURL(/\/app\/onboarding/);
  } finally { await other.close(); }
});
