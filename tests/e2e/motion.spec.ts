import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('motion preference persists, syncs tabs, and respects a device request without API writes', async ({ page, context }) => {
  const writes: string[] = [];
  context.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(request.method())) writes.push(request.method()); });
  await page.goto('/demo');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  const second = await context.newPage();
  try {
    await second.goto('/demo');
    await expect(second.locator('html')).toHaveAttribute('data-motion', 'full');
    await page.getByRole('button', { name: 'Reduce animations' }).click();
    await expect(second.locator('html')).toHaveAttribute('data-motion', 'reduce');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Reduce animations' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Next: Feedback', exact: true }).click();
    expect(await page.locator('#demo-stage').evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
    await page.getByRole('button', { name: 'Reduce animations' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.getByRole('button', { name: 'Reduce animations' })).toBeDisabled();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
    expect(await page.locator('#demo-stage').evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
    expect(writes).toEqual([]);
  } finally { await second.close(); }
});

test('pointer scenes settle and keyboard scenes stay instant', async ({ page }) => {
  await page.goto('/demo');
  const nav = page.getByRole('navigation', { name: 'Walkthrough scenes' });
  await nav.getByRole('button', { name: 'Feedback', exact: true }).click();
  await nav.getByRole('button', { name: 'People', exact: true }).click();
  await nav.getByRole('button', { name: 'Progress', exact: true }).click();
  await expect(page.getByRole('main')).toHaveAttribute('aria-label', 'Scene 4 of 4: Progress');
  await expect.poll(() => page.locator('#demo-stage').evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
  await page.locator('#demo-stage').focus(); await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('main')).toHaveAttribute('aria-label', 'Scene 3 of 4: People');
  expect(await page.locator('#demo-stage').evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
});

test('the landing page stays visible and usable without JavaScript', async ({ browser, baseURL, viewport }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const sections = page.locator('section[data-section]');
    expect(await sections.count()).toBeGreaterThan(3);
    for (const section of await sections.all()) await expect(section).toBeVisible();
    await expect(page.getByRole('link', { name: 'Product walkthrough', exact: true })).toHaveAttribute('href', '/demo');
  } finally { await context.close(); }
});

test('reduced motion keeps community cards still while their links remain usable', async ({ page, isMobile }) => {
  await page.goto('/app/challenges');
  await onboard(page, { nickname: 'Motion friend', role: 'learner' });
  const challenge = page.getByRole('region', { name: 'Open challenges' }).getByRole('link').first();
  await expect(challenge).toBeVisible();
  await challenge.hover();
  if (!isMobile) await expect.poll(() => challenge.evaluate(element => getComputedStyle(element).transform)).not.toBe('none');
  await page.getByRole('button', { name: 'Reduce animations' }).click();
  await challenge.hover();
  expect(await challenge.evaluate(element => getComputedStyle(element).transform)).toBe('none');
  await challenge.click();
  await expect(page).toHaveURL(/\/app\/challenges\//);
});
