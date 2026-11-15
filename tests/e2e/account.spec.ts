import { expect, test, type Page } from '@playwright/test';
import { onboard, recordFor } from './helpers';

// Suppress automatic failure copy-prompts. While a key may be on screen, use
// boolean polling below: locator/page matchers can independently capture DOM.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

// These tests create synthetic credentials. Keep them only in memory and out of
// traces, screenshots, attachments, downloaded files, and assertion diffs.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

async function saveDisplayedKey(page: Page, doneLabel = 'I saved my key') {
  const notice = page.getByRole('region', { name: 'Keep this key somewhere safe.' });
  await expect.poll(() => notice.isVisible(), { message: 'the recovery notice is visible' }).toBe(true);
  await expect.poll(() => notice.getByRole('heading').evaluate(element => element === document.activeElement), { message: 'the recovery heading has focus' }).toBe(true);
  const key = (await notice.locator('code').textContent())?.trim() ?? '';
  expect(/^hlk_[A-Za-z0-9_-]{43}$/.test(key), 'a private recovery key was created').toBe(true);
  await expect.poll(() => notice.getByRole('button', { name: doneLabel, exact: true }).isDisabled(), { message: 'saving the key requires acknowledgment' }).toBe(true);
  await notice.getByRole('checkbox', { name: 'I saved this key in a safe place.' }).check();
  await notice.getByRole('button', { name: doneLabel, exact: true }).click();
  await expect.poll(async () => await notice.count() === 0, { message: 'the acknowledged key is no longer rendered' }).toBe(true);
  return key;
}

async function submitRecovery(page: Page, key: string) {
  await page.goto('/app/onboarding?mode=restore');
  const input = page.getByLabel('Recovery key', { exact: true });
  await expect.poll(() => input.isEditable(), { message: 'the recovery field is editable' }).toBe(true);
  // Setting the controlled field in-page avoids including the key in a failed
  // locator.fill call log. The user-facing submit button still drives restore.
  await input.evaluate((element, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    setter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, key);
  await page.getByRole('button', { name: 'Restore my profile', exact: true }).click();
}

test('an unsaved recovery key survives browser Back and warns before a reload', async ({ page }) => {
  await page.goto('/app');
  await onboard(page, { nickname: 'Key navigation check', role: 'learner' });
  await page.getByRole('link', { name: 'Me', exact: true }).click();
  await page.getByRole('button', { name: 'Create recovery key', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Keep this key somewhere safe.' });
  await expect.poll(() => dialog.isVisible(), { message: 'the private key dialog opened' }).toBe(true);
  const key = await dialog.locator('code').textContent();
  await page.goBack();
  await expect.poll(() => /\/app$/.test(page.url()), { message: 'browser Back reached the app home' }).toBe(true);
  await expect.poll(() => dialog.isVisible(), { message: 'browser Back kept the private key dialog' }).toBe(true);
  expect((await dialog.locator('code').textContent()) === key, 'navigation retained the same private key in memory').toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => dialog.isVisible(), { message: 'Escape kept the unacknowledged key dialog' }).toBe(true);
  const warning = page.waitForEvent('dialog', { timeout: 10_000 }).then(async event => {
    expect(event.type()).toBe('beforeunload'); await event.dismiss();
  });
  await Promise.all([warning, page.evaluate(() => window.location.reload())]);
  await expect.poll(() => dialog.isVisible(), { message: 'cancelled reload kept the private key dialog' }).toBe(true);
  expect((await dialog.locator('code').textContent()) === key, 'cancelled reload retained the private key').toBe(true);
  await saveDisplayedKey(page);
  expect((await page.request.delete('/api/session')).status()).toBe(204);
});

test('saved practice survives recovery, replacement, export, and deliberate deletion', async ({ page, browser }, testInfo) => {
  test.setTimeout(90_000);
  const missionId = 'cafe-iced-americano';
  await page.goto('/app');
  await onboard(page, { nickname: 'Continuity check', role: 'learner' });
  await page.getByRole('link', { name: 'Practice', exact: true }).click();
  const card = page.getByRole('article').filter({ has: page.locator(`a[href="/app/missions/${missionId}"]`) });
  await expect(card).toHaveCount(1);
  await card.getByRole('button', { name: /^Save expression:/ }).click();
  await expect(card.getByRole('button', { name: /^Remove saved expression:/ })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await page.getByRole('button', { name: /^Saved expressions/ }).click();
  await expect(page.getByRole('list', { name: 'Mission results' }).getByRole('listitem')).toHaveCount(1);
  await card.getByRole('link').click();
  await recordFor(page, 2500);
  await page.getByRole('button', { name: 'Get my score' }).click();
  await expect(page.getByRole('region', { name: 'Your score' }).locator('.hl-score-number')).toHaveText('88', { timeout: 20_000 });
  await page.getByRole('link', { name: 'Progress', exact: true }).click();
  const journal = page.getByRole('list', { name: 'Past speaking attempts' });
  await expect(journal.getByRole('listitem')).toHaveCount(1);
  await journal.locator('summary').click();
  await expect(journal.getByText('What we heard')).toBeVisible();
  await expect(journal.getByText('Try this next', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Me', exact: true }).click();
  await page.getByRole('button', { name: 'Create recovery key', exact: true }).click();
  const firstKey = await saveDisplayedKey(page);

  const context = await browser.newContext({ baseURL: 'http://localhost:3100', viewport: testInfo.project.use.viewport });
  const restored = await context.newPage();
  const replacementContext = await browser.newContext({ baseURL: 'http://localhost:3100', viewport: testInfo.project.use.viewport });
  const replacement = await replacementContext.newPage();
  try {
    await submitRecovery(restored, firstKey);
    const secondKey = await saveDisplayedKey(restored, 'Continue to my profile');
    expect(secondKey !== firstKey, 'restoring replaces the consumed key').toBe(true);
    await expect(restored.getByRole('heading', { name: '안녕하세요, Continuity check', exact: true })).toBeVisible();
    await restored.reload();
    await expect(restored.getByRole('heading', { name: '안녕하세요, Continuity check', exact: true })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/app\/onboarding/);
    await restored.getByRole('link', { name: 'Practice', exact: true }).click();
    await restored.getByRole('button', { name: /^Saved expressions/ }).click();
    await expect(restored.getByRole('list', { name: 'Mission results' }).getByRole('listitem')).toHaveCount(1);
    await expect(restored.locator(`a[href="/app/missions/${missionId}"]`)).toContainText('Strong result');
    await restored.getByRole('link', { name: 'Progress', exact: true }).click();
    await restored.getByLabel('Filter history by expression').selectOption(missionId);
    await expect(restored.getByRole('list', { name: 'Past speaking attempts' }).getByRole('listitem')).toHaveCount(1);

    await restored.getByRole('link', { name: 'Me', exact: true }).click();
    await restored.getByRole('button', { name: 'Replace recovery key', exact: true }).click();
    const rotate = restored.getByRole('dialog', { name: 'Replace your recovery key?' });
    await expect(rotate).toContainText('The old key will stop working.');
    await rotate.getByRole('button', { name: 'Replace my key', exact: true }).click();
    const thirdKey = await saveDisplayedKey(restored);
    expect(thirdKey !== secondKey, 'explicit replacement creates a different key').toBe(true);
    await submitRecovery(replacement, secondKey);
    await expect.poll(async () => (await replacement.getByRole('main').getByRole('alert').textContent())?.includes('That recovery key is invalid or has already been replaced.') === true, { message: 'the consumed key is rejected' }).toBe(true);
    await submitRecovery(replacement, thirdKey);
    const currentKey = await saveDisplayedKey(replacement, 'Continue to my profile');
    await expect(replacement.getByRole('heading', { name: '안녕하세요, Continuity check', exact: true })).toBeVisible();

    await replacement.getByRole('link', { name: 'Me', exact: true }).click();
    const [download] = await Promise.all([
      replacement.waitForEvent('download'),
      replacement.getByRole('button', { name: 'Download my data', exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^hanlog-data-\d{4}-\d{2}-\d{2}\.json$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const exportedText = Buffer.concat(chunks).toString('utf8');
    expect(exportedText.includes('hlk_') || [firstKey, secondKey, thirdKey, currentKey].some(key => exportedText.includes(key)), 'the export excludes recovery credentials').toBe(false);
    expect(/recovery_.*hash|session_version|media_path|sessionSecret/.test(exportedText), 'the export excludes internal credentials and recording paths').toBe(false);
    const exported = JSON.parse(exportedText);
    expect(exported.profile.nickname).toBe('Continuity check');
    expect(exported.savedMissions.map((item: { missionId: string }) => item.missionId)).toEqual([missionId]);
    expect(exported.attempts).toHaveLength(1); expect(exported.attempts[0].missionId).toBe(missionId);
    expect(exported.pointEvents).toHaveLength(1);
    await download.delete();

    await replacement.getByRole('button', { name: 'Delete my data', exact: true }).click();
    await replacement.getByRole('dialog', { name: 'Delete your data?' }).getByRole('button', { name: 'Yes, delete everything', exact: true }).click();
    await expect(replacement).toHaveURL(/\/$/);
    await replacement.goto('/app');
    await expect(replacement).toHaveURL(/\/app\/onboarding/);
    expect((await replacement.request.get('/api/account/export')).status()).toBe(401);
    await submitRecovery(replacement, currentKey);
    await expect.poll(async () => (await replacement.getByRole('main').getByRole('alert').textContent())?.includes('That recovery key is invalid or has already been replaced.') === true, { message: 'the deleted profile key is rejected' }).toBe(true);
  } finally {
    await context.close();
    await replacementContext.close();
  }
});
