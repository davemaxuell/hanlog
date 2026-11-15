import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

const PUBLIC = ['/', '/privacy', '/app/onboarding'];
const SIGNED_IN = ['/app', '/app/challenges', '/app/rewards', '/app/me'];
const WIDTHS = [320, 390, 768, 1440];

const check = async (page: import('@playwright/test').Page, path: string) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} scrolls sideways at ${width}px`).toBeLessThanOrEqual(0);
  }
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${path}: ${v.id}`)).toEqual([]);
};

test.describe('desktop project only', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1000, 'the sweep sets its own widths');
  for (const path of PUBLIC) test(`public ${path}`, async ({ page }) => { await check(page, path); });
  test('signed-in screens, a mission, and a challenge', async ({ page }) => {
    await page.goto('/app');
    await onboard(page, { nickname: 'Sweep', role: 'learner' });
    for (const path of SIGNED_IN) await check(page, path);
    await page.goto('/app');
    await page.getByRole('region', { name: "Today's missions" }).getByRole('link').first().click();
    await check(page, new URL(page.url()).pathname);
    await page.goto('/app/challenges');
    await page.getByRole('region', { name: 'Open challenges' }).getByRole('link').first().click();
    await check(page, new URL(page.url()).pathname);
  });
  test('the whole solo loop works from the keyboard', async ({ page }) => {
    await page.goto('/app');
    await onboard(page, { nickname: 'Keys', role: 'learner' });
    await page.getByRole('region', { name: "Today's missions" }).getByRole('link').first().focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Record' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Stop' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Get my score' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('meter', { name: 'Pronunciation' })).toBeVisible({ timeout: 20_000 });
  });
});
