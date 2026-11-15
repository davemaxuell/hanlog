import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the four presentation scenes fit a projector and remain accessible on narrow phones', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'this sweep sets its own viewport');
  test.setTimeout(120_000);
  await page.goto('/demo');
  await page.waitForLoadState('networkidle');
  for (const scene of ['Practice', 'Feedback', 'People', 'Progress']) {
    await page.getByRole('navigation', { name: 'Walkthrough scenes' }).getByRole('button', { name: scene, exact: true }).click();
    for (const width of [320, 390, 1440, 1366]) {
      await page.setViewportSize({ width, height: width === 1366 ? 768 : 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${scene} at ${width}px`).toBeLessThanOrEqual(0);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    // Contrast applies to the settled scene, after its short entrance fade.
    await page.getByRole('main').evaluate(async element => {
      await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined)));
    });
    const footer = await page.getByRole('contentinfo').boundingBox();
    expect(footer, `${scene} has a navigation footer`).not.toBeNull();
    expect(footer!.y + footer!.height, `${scene} footer fits the 1366×768 projector`).toBeLessThanOrEqual(768);
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(scan.violations.filter(item => item.impact === 'serious' || item.impact === 'critical').map(item => ({ scene, rule: item.id, nodes: item.nodes.map(node => ({ target: node.target, reason: node.failureSummary })) }))).toEqual([]);
  }
  await page.locator('#demo-stage').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('main')).toHaveAttribute('aria-label', 'Scene 3 of 4: People');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('main')).toHaveAttribute('aria-label', 'Scene 4 of 4: Progress');
  await page.getByRole('button', { name: 'Live practice', exact: true }).click();
  for (const width of [320, 390, 1366]) {
    await page.setViewportSize({ width, height: 768 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `Live consent at ${width}px`).toBeLessThanOrEqual(0);
  }
  await page.getByRole('button', { name: 'Prepare demo', exact: true }).click();
  const preparation = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(preparation.violations.filter(item => item.impact === 'serious' || item.impact === 'critical').map(item => item.id)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Prepare demo', exact: true })).toBeFocused();
});
