import { expect, test } from '@playwright/test';
import { balance, onboard, recordFor } from './helpers';

test('a Korean speaker and a learner complete one exchange in two browsers', async ({ browser }, testInfo) => {
  const settings = { baseURL: 'http://localhost:3100', permissions: ['microphone', 'camera'], viewport: testInfo.project.use.viewport };
  const koreanContext = await browser.newContext(settings);
  const learnerContext = await browser.newContext(settings);
  const korean = await koreanContext.newPage();
  const learner = await learnerContext.newPage();

  await korean.goto('/app');
  await onboard(korean, { nickname: 'Minji', role: 'korean' });
  await korean.getByRole('link', { name: 'Post a challenge' }).first().click();
  await korean.getByLabel('Korean expression').fill('이거 완전 꿀잼이야.');
  await korean.getByLabel('Meaning in English').fill('꿀잼 means really fun.');
  await korean.getByRole('button', { name: 'Post challenge' }).click();
  const code = (await korean.getByTestId('share-code').textContent())!.trim();
  expect(code).toMatch(/^[2-9A-HJ-NP-Z]{6}$/);

  await learner.goto(`/c/${code}`);
  await onboard(learner, { nickname: 'Aisha', role: 'learner', next: `/c/${code}` });
  await expect(learner.getByRole('heading', { name: '이거 완전 꿀잼이야.', exact: true })).toBeVisible();
  await recordFor(learner, 2500);
  await learner.getByRole('button', { name: 'Send answer' }).click();
  await expect(learner.getByText('Sent. Minji will rate it.')).toBeVisible();

  await korean.getByRole('link', { name: 'Community', exact: true }).click();
  await expect(korean.getByRole('heading', { name: /To rate \([1-9]\d*\)/ })).toBeVisible();
  await korean.getByRole('region', { name: /To rate/ }).getByRole('link').filter({ hasText: '이거 완전 꿀잼이야.' }).click();
  const card = korean.getByRole('article', { name: 'Answer from Aisha' });
  await expect(card).toBeVisible();
  // evaluateAll does not wait for the asynchronous response list to arrive.
  // Verify the actual rating controls before measuring their touch targets.
  await expect(card.locator('.hl-stars label')).toHaveCount(10);
  const originalViewport = korean.viewportSize()!;
  for (const width of [320, 390]) {
    await korean.setViewportSize({ width, height: 844 });
    expect(await korean.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const targets = await card.locator('.hl-stars label').evaluateAll(labels => labels.map(label => ({ width: label.getBoundingClientRect().width, height: label.getBoundingClientRect().height })));
    expect(targets).toHaveLength(10);
    expect(targets.every(target => target.width >= 48 && target.height >= 48)).toBe(true);
    if (testInfo.project.name === 'desktop') await korean.screenshot({ path: `output/playwright/rating-${width}.png`, fullPage: true });
  }
  await korean.setViewportSize(originalViewport);
  await card.getByRole('button', { name: 'Play' }).click();
  await expect(card.locator('audio')).toHaveAttribute('src', /^blob:/);
  await card.getByRole('radiogroup', { name: 'Pronunciation' }).getByRole('radio', { name: '4 stars' }).check();
  await card.getByRole('radiogroup', { name: 'Naturalness' }).getByRole('radio', { name: '5 stars' }).check();
  await card.getByRole('button', { name: 'Send rating' }).click();
  await expect(card.getByText('Rated. Thank you.')).toBeVisible();

  await learner.reload();
  await expect(learner.getByRole('img', { name: 'Pronunciation: 4 out of 5' })).toBeVisible();
  await learner.getByRole('radio', { name: '5 stars' }).check();
  await learner.getByRole('button', { name: 'Send feedback' }).click();
  await expect(learner.getByText('Thanks. Your feedback was sent.')).toBeVisible();

  await learner.getByRole('link', { name: 'Community', exact: true }).click();
  await expect(learner.getByRole('region', { name: 'Your feedback inbox' }).getByText('Your answer was rated')).toBeVisible();
  await learner.getByRole('region', { name: 'Your feedback inbox' }).getByRole('link').click();
  await expect(learner.getByText('Thanks. Your feedback was sent.')).toBeVisible();

  await learner.reload();
  await korean.reload();
  expect(await balance(learner)).toBe(32);   // 27 for the rated answer + 5 for giving feedback
  expect(await balance(korean)).toBe(20);    // 10 for rating + 10 for five-star feedback
  await card.getByRole('button', { name: 'Report', exact: true }).click();
  await expect(korean.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await korean.keyboard.press('Escape');
  await expect(card.getByRole('button', { name: 'Report', exact: true })).toBeFocused();
  await card.getByRole('button', { name: 'Report', exact: true }).click();
  await korean.getByRole('button', { name: 'Yes, report it' }).click();
  await expect(korean.getByText('Answer reported.', { exact: true })).toBeVisible();
  await expect(korean.getByText('No answers to review right now.', { exact: true })).toBeVisible();
  await expect(korean.getByRole('heading', { name: 'Answers', exact: true })).toBeFocused();
  await koreanContext.close();
  await learnerContext.close();
});
test('an unknown share code says so', async ({ page }) => {
  await page.goto('/app');
  await onboard(page, { nickname: 'Lost', role: 'learner' });
  await page.goto('/c/ZZZZZZ');
  await expect(page.getByText('This challenge link is not valid.')).toBeVisible();
});
