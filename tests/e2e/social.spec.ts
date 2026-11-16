import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('two people share a Korean moment, compare on the leaderboard, and form a group', async ({ browser }, testInfo) => {
  const settings = { baseURL: 'http://localhost:3100', viewport: testInfo.project.use.viewport };
  const suffix = testInfo.project.name === 'phone' ? 'P' : 'D';
  const [hanaContext, leoContext] = [await browser.newContext(settings), await browser.newContext(settings)];
  const hana = await hanaContext.newPage(); const leo = await leoContext.newPage();
  await hana.goto('/app'); await onboard(hana, { nickname: `Hana ${suffix}`, role: 'learner' });
  await leo.goto('/app'); await onboard(leo, { nickname: `Leo ${suffix}`, role: 'korean' });

  // Hana shares a photo with the Korean it taught her.
  await hana.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Community' }).click();
  await expect(hana).toHaveURL(/\/app\/feed$/);
  await hana.getByRole('link', { name: /Share a moment/ }).click();
  await hana.locator('input[type=file]').setInputFiles(resolve('tests/fixtures/media/photo.jpg'));
  await expect(hana.getByRole('img', { name: 'Preview of the photo you chose' })).toBeVisible();
  await hana.getByLabel('Korean expression').fill('영수증은 버려 주세요.');
  await hana.getByLabel('What it means').fill('Please throw the receipt away.');
  await hana.getByRole('button', { name: 'Share moment' }).click();
  await expect(hana.getByText('Your moment is on the feed. +5 points.')).toBeVisible();
  expect(await hana.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  // Leo sees it, the photo loads, and he likes it.
  await leo.goto('/app/feed');
  // The browser suite shares one database across projects, so pick this run's post by its author.
  const card = leo.getByRole('article', { name: '영수증은 버려 주세요.' }).filter({ hasText: `Hana ${suffix}` });
  await expect(card).toBeVisible();
  await expect.poll(() => card.getByRole('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(480);
  await card.getByRole('button', { name: /^Like\./ }).click();
  await expect(card.getByRole('button', { name: 'Like. 1 like' })).toHaveAttribute('aria-pressed', 'true');

  // The leaderboard shows Hana's points to everyone.
  await leo.getByRole('navigation', { name: 'Community' }).getByRole('link', { name: 'Ranks' }).click();
  const board = leo.getByRole('list', { name: "Today's leaderboard" });
  await expect(board.getByRole('listitem').filter({ hasText: `Hana ${suffix}` })).toContainText('5 pts');

  // Hana starts a group; Leo joins with the code and both compare.
  await hana.goto('/app/groups');
  await hana.getByLabel('Group name').fill(`Demo table ${suffix}`);
  await hana.getByRole('button', { name: 'Start group' }).click();
  await expect(hana.getByRole('heading', { level: 1, name: `Demo table ${suffix}` })).toBeVisible();
  const code = (await hana.locator('b').filter({ hasText: /^[2-9A-HJ-NP-Z]{6}$/ }).textContent())!;
  await leo.goto(`/app/groups?join=${code}`);
  await leo.getByRole('button', { name: 'Join group' }).click();
  const members = leo.getByRole('list', { name: `Demo table ${suffix} members` });
  await expect(members.getByRole('listitem')).toHaveCount(2);
  await expect(members.getByRole('listitem').first()).toContainText(`Hana ${suffix}`);
  await expect(members.getByRole('listitem').nth(1)).toContainText('You');
  expect(await leo.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await hanaContext.close(); await leoContext.close();
});
