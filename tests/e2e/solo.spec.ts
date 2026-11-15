import { expect, test } from '@playwright/test';
import { balance, onboard, recordFor } from './helpers';

test('a visitor scores a sentence on the introduction page and carries the points into the app', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Try a mission now' }).click();
  await expect(page.getByRole('button', { name: 'Record' })).toHaveCount(0);            // nothing before consent
  await page.getByRole('checkbox', { name: /I agree that my voice recordings/ }).check();
  await recordFor(page, 2500);
  await page.getByRole('button', { name: 'Get my score' }).click();
  await expect(page.locator('.hl-score-number')).toHaveText('88', { timeout: 20_000 });
  await expect(page.getByText('Demo scoring, not AI')).toBeVisible();
  await expect(page.getByText('+10 points')).toBeVisible();
  await page.getByRole('link', { name: 'Keep going in the app' }).click();
  await expect(page).toHaveURL(/\/app$/);
  expect(await balance(page)).toBe(10);
});
test('a new learner onboards, completes a mission, and cannot be paid twice', async ({ page }) => {
  await page.goto('/app');
  await expect(page).toHaveURL(/\/app\/onboarding\?next=%2Fapp$/);
  await onboard(page, { nickname: 'Aisha', role: 'learner' });
  await expect(page.getByRole('heading', { name: '안녕하세요, Aisha', exact: true })).toBeVisible();
  await page.getByRole('region', { name: "Today's missions" }).getByRole('link').first().click();
  for (const expected of [/^\+\d+ points$/, 'Already earned for this mission.']) {
    await recordFor(page, 2500);
    await page.getByRole('button', { name: 'Get my score' }).click();
    await expect(page.getByRole('meter', { name: 'Pronunciation' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(expected)).toBeVisible();
    if (typeof expected !== 'string') await page.getByRole('button', { name: 'Try again' }).click();
  }
  await page.getByRole('link', { name: 'Rewards' }).click();
  await expect(page.getByText(/^Mission: /)).toHaveCount(1);
});
test('a denied microphone still leaves a way to get a score', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
  });
  await page.goto('/app');
  await onboard(page, { nickname: 'NoMic', role: 'learner' });
  await page.getByRole('region', { name: "Today's missions" }).getByRole('link').first().click();
  await page.getByRole('button', { name: 'Record' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Microphone access is off.');
  await page.getByLabel('Upload a voice file').setInputFiles('tests/e2e/fixtures/voice.wav');
  await page.getByRole('button', { name: 'Get my score' }).click();
  await expect(page.getByRole('meter', { name: 'Pronunciation' })).toBeVisible({ timeout: 20_000 });
});
test('the session survives a reload and Delete my data ends it', async ({ page }) => {
  await page.goto('/app');
  await onboard(page, { nickname: 'Temp', role: 'learner' });
  await page.reload();
  await expect(page.getByRole('heading', { name: '안녕하세요, Temp', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Me', exact: true }).click();
  await page.getByRole('button', { name: 'Delete my data' }).click();
  await page.getByRole('button', { name: 'Yes, delete everything' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/app');
  await expect(page).toHaveURL(/\/app\/onboarding/);
});
