import { expect, test } from '@playwright/test';
import { onboard, recordFor } from './helpers';

test('a learner answers a sample challenge with video', async ({ page }) => {
  await page.goto('/app');
  await onboard(page, { nickname: 'Video', role: 'learner' });
  await page.getByRole('link', { name: 'Community', exact: true }).click();
  await page.getByRole('navigation', { name: 'Community' }).getByRole('link', { name: 'Challenges' }).click();
  await page.getByRole('region', { name: 'Open challenges' }).getByRole('link').first().click();
  await page.getByRole('radio', { name: 'Video' }).check();
  await recordFor(page, 2500);
  await expect(page.locator('video')).toBeVisible();
  const [upload] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/responses') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Send answer' }).click(),
  ]);
  expect(upload.status()).toBe(201);
  expect((await upload.json()).response.mediaKind).toBe('video');
});
test('the cleanup job refuses strangers and runs with the secret', async ({ request }) => {
  expect((await request.get('/api/cron/cleanup')).status()).toBe(401);
  const ok = await request.get('/api/cron/cleanup', { headers: { authorization: 'Bearer e2e-cron' } });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toEqual({ deleted: 0 });
});
