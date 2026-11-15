import { expect, test } from '@playwright/test';

test('the introduction page loads without console errors', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Speak Korean out in the world. Get a score that actually helps.');
  expect(errors).toEqual([]);
  expect(await page.getByRole('heading', { level: 1 }).evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(32);
  await page.screenshot({ path: `output/playwright/intro-${testInfo.project.name}.png`, fullPage: true });
  const action = await page.getByRole('link', { name: 'Try a mission now' }).boundingBox();
  expect(action!.y + action!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});
test('the API is up and has no session', async ({ request }) => {
  expect(await (await request.get('/api/session')).json()).toEqual({ user: null });
  expect((await (await request.get('/api/missions')).json()).missions).toHaveLength(24);
});
