import { expect, test, type Locator, type Page } from '@playwright/test';
import { onboard } from './helpers';

// Phone layout guard: common widths from small Android (320) to large iPhone (430).
const WIDTHS = [320, 360, 375, 430];

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'this sweep sets its own phone viewports');
});

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value, 'element is rendered').not.toBeNull();
  return value!;
}

async function expectNoHorizontalScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label} scrolls sideways`).toBeLessThanOrEqual(0);
}

/** Text that is wider than its own box spills past the card edge. */
async function expectTextFits(locator: Locator, label: string) {
  const spill = await locator.evaluate(element => element.scrollWidth - element.clientWidth);
  expect(spill, `${label} spills out of its box`).toBeLessThanOrEqual(0);
}

test('the page reaches the safe areas so the tab bar can clear the home indicator', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
});

test('the landing page stays readable and tappable on phones', async ({ page }) => {
  await page.goto('/');
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    await expectNoHorizontalScroll(page, `Landing at ${width}px`);

    const openApp = page.locator('[data-section="header"]').getByRole('link', { name: 'Open the app' });
    expect((await box(openApp)).height, `"Open the app" stays on one line at ${width}px`).toBeLessThanOrEqual(56);

    for (const tab of await page.getByRole('group', { name: 'Choose a sample everyday phrase' }).getByRole('button').all()) {
      expect((await box(tab)).height, `phrase tab is a comfortable tap target at ${width}px`).toBeGreaterThanOrEqual(40);
    }

    // App tour: step tiles sit above the phone, so tapping one changes a screen that is in view.
    const steps = page.locator('[data-section="how"] li');
    const phone = await box(page.locator('[data-section="how"] [data-phone-screen]'));
    expect(phone.x, `app tour phone starts on screen at ${width}px`).toBeGreaterThanOrEqual(0);
    expect(phone.x + phone.width, `app tour phone ends on screen at ${width}px`).toBeLessThanOrEqual(width);
    for (let index = 0; index < 4; index++) {
      const step = await box(steps.nth(index));
      expect(step.height, `step ${index + 1} is a comfortable tap target at ${width}px`).toBeGreaterThanOrEqual(44);
      expect(step.y + step.height, `step ${index + 1} sits above the phone at ${width}px`).toBeLessThanOrEqual(phone.y);
      await expectTextFits(steps.nth(index).locator('h3'), `Step ${index + 1} title at ${width}px`);
    }
  }
});

test('app screens keep labels, cards, and form controls usable on phones', async ({ page }) => {
  await page.goto('/app/onboarding');
  await onboard(page, { nickname: 'Phone layout', role: 'learner' });

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });

    await page.goto('/app/missions/cafe-iced-americano');
    await expectNoHorizontalScroll(page, `Mission at ${width}px`);
    const level = page.locator('.hl-margin-label').first();
    const expression = page.locator('.hl-mission-expression').first();
    await expectTextFits(level, `Mission level label at ${width}px`);
    expect((await box(level)).y + (await box(level)).height, `mission level sits above the expression at ${width}px`).toBeLessThanOrEqual((await box(expression)).y);

    await page.goto('/app/rewards');
    await expectNoHorizontalScroll(page, `Rewards at ${width}px`);
    for (const heading of await page.getByRole('heading', { level: 3 }).all()) await expectTextFits(heading, `Milestone "${await heading.innerText()}" at ${width}px`);

    for (const route of ['/app/missions', '/app/progress']) {
      await page.goto(route);
      await expectNoHorizontalScroll(page, `${route} at ${width}px`);
      // iOS Safari zooms the whole page when a focused field uses text smaller than 16px.
      const small = await page.locator('input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea').evaluateAll(fields =>
        fields.filter(field => parseFloat(getComputedStyle(field).fontSize) < 16).map(field => field.getAttribute('aria-label') ?? field.closest('label')?.textContent?.trim() ?? field.tagName));
      expect(small, `${route} fields that would make iOS zoom at ${width}px`).toEqual([]);
    }
  }
});

test('the tab bar stays compact on a phone held sideways', async ({ page }) => {
  await page.goto('/app/onboarding');
  await onboard(page, { nickname: 'Landscape', role: 'learner' });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/app');
  const nav = await box(page.getByRole('navigation', { name: 'Main navigation' }));
  expect(nav.height, 'tab bar leaves most of a landscape screen for content').toBeLessThanOrEqual(64);
});
