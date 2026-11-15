import { expect, type Page } from '@playwright/test';

export async function onboard(page: Page, opts: { nickname: string; role: 'learner' | 'korean'; next?: string }) {
  await expect(page).toHaveURL(/\/app\/onboarding/);
  await page.getByLabel('Nickname').fill(opts.nickname);
  await page.getByRole('radio', { name: opts.role === 'learner' ? /I'm learning Korean/ : /I speak Korean/ }).check();
  await page.getByRole('checkbox', { name: /I agree that my voice recordings/ }).check();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page).not.toHaveURL(/\/app\/onboarding/);
  // Share links resolve to the canonical challenge screen after onboarding.
  if (opts.next?.startsWith('/c/')) await expect(page).toHaveURL(/\/app\/challenges\//);
}
export async function recordFor(page: Page, ms: number) {
  await page.getByRole('button', { name: 'Record', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  await page.waitForTimeout(ms);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retake', exact: true })).toBeVisible();
}
export async function balance(page: Page) {
  const chip = page.locator('.hl-app-header .hl-points');
  await expect(chip).toContainText(/\d[\d,]* points/);
  return Number((await chip.innerText()).replace(/[^\d]/g, ''));
}
