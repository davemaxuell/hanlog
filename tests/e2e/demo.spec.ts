import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { AttemptResult } from '../../src/lib/contracts';
import { recordFor } from './helpers';

type MediaProbe = { requests: number; tracks: MediaStreamTrack[]; stops: number; revocations: number };
type ProbeWindow = Window & { __hanlogDemoMedia: MediaProbe };

function captureApiWrites(context: BrowserContext) {
  const writes: string[] = [];
  context.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(`${request.method()} ${path}`);
  });
  return writes;
}

async function instrumentMedia(page: Page) {
  await page.addInitScript(() => {
    const probe: MediaProbe = { requests: 0, tracks: [], stops: 0, revocations: 0 };
    (window as unknown as ProbeWindow).__hanlogDemoMedia = probe;
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      probe.requests++;
      const stream = await getUserMedia(constraints);
      for (const track of stream.getTracks()) {
        probe.tracks.push(track);
        const stop = track.stop.bind(track); let stopped = false;
        track.stop = () => { if (!stopped) { stopped = true; probe.stops++; } stop(); };
      }
      return stream;
    };
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = url => { probe.revocations++; revoke(url); };
  });
}

async function mediaState(page: Page) {
  return page.evaluate(() => {
    const probe = (window as unknown as ProbeWindow).__hanlogDemoMedia;
    return { requests: probe.requests, tracks: probe.tracks.length, stops: probe.stops, live: probe.tracks.filter(track => track.readyState === 'live').length, revocations: probe.revocations };
  });
}

test('the loaded example walkthrough works offline without creating a profile or opening a microphone', async ({ page, context }) => {
  const writes = captureApiWrites(context);
  await instrumentMedia(page);
  const qrLoaded = page.waitForResponse(response => new URL(response.url()).pathname === '/demo/hanlog-qr.svg' && response.ok());
  await page.goto('/demo');
  await qrLoaded;
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('main')).toHaveAttribute('aria-label', 'Scene 1 of 4: Practice');
  await context.setOffline(true);
  try {
    await expect(page.getByRole('status')).toContainText("You're offline. The example walkthrough remains available");
    await page.getByRole('button', { name: 'Next: Feedback', exact: true }).click();
    await expect(page.getByRole('main')).toHaveAttribute('aria-label', 'Scene 2 of 4: Feedback');
    await expect(page.getByText('Illustrative example · no audio analysed', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Next: People', exact: true }).click();
    await expect(page.getByRole('main')).toHaveAttribute('aria-label', 'Scene 3 of 4: People');
    await expect(page.getByText('No recording sent · no peer rating received', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Next: Progress', exact: true }).click();
    await expect(page.getByRole('main')).toHaveAttribute('aria-label', 'Scene 4 of 4: Progress');
    await expect(page.getByText('Illustrative preview · nothing saved', { exact: true })).toBeVisible();
    const qr = page.getByRole('img', { name: 'QR code to open HanLog at hanlog-nine.vercel.app', exact: true });
    await expect(qr).toBeVisible();
    await expect.poll(() => qr.evaluate(element => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await expect(page.getByRole('link', { name: 'Open HanLog website', exact: true })).toHaveAttribute('href', 'https://hanlog-nine.vercel.app/');
    await page.getByRole('button', { name: 'Restart walkthrough', exact: true }).click();
    await expect(page.getByRole('main')).toHaveAttribute('aria-label', 'Scene 1 of 4: Practice');
    await expect(page.getByRole('button', { name: 'Example walkthrough', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Record', exact: true })).toHaveCount(0);
    expect(writes).toEqual([]);
    expect((await mediaState(page)).requests).toBe(0);
    expect((await context.cookies()).some(cookie => cookie.name === 'hl_session')).toBe(false);
  } finally {
    await context.setOffline(false);
  }
});

test('live practice submits once and keeps its actual attempt through scene changes and restart', async ({ page, context }) => {
  const writes = captureApiWrites(context);
  const attemptPath = 'POST /api/missions/cafe-iced-americano/attempts';
  await instrumentMedia(page);
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Live practice', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start live practice', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Record', exact: true })).toHaveCount(0);
  await page.getByRole('checkbox', { name: /I agree that my voice recordings/ }).check();
  expect(writes).toEqual([]);
  expect((await mediaState(page)).requests).toBe(0);
  await page.getByRole('button', { name: 'Start live practice', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Record', exact: true })).toBeVisible();
  expect(writes).toEqual(['POST /api/session']);
  const scenes = page.getByRole('navigation', { name: 'Walkthrough scenes', exact: true });
  await page.getByText('Use a saved voice file', { exact: true }).click();
  await page.getByLabel('Upload a voice file', { exact: true }).setInputFiles('tests/e2e/fixtures/voice.wav');
  await expect(page.getByRole('button', { name: 'Get my score', exact: true })).toBeEnabled();
  await expect(scenes.getByRole('button', { name: 'People', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Example walkthrough', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Retake', exact: true })).toBeEnabled();
  await expect(page.getByText('Choose Get my score, or Retake to discard this clip before changing scenes.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retake', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Record', exact: true })).toBeVisible();
  await expect(scenes.getByRole('button', { name: 'People', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Example walkthrough', exact: true })).toBeEnabled();
  expect(writes.filter(write => write === attemptPath)).toHaveLength(0);
  expect((await mediaState(page)).requests).toBe(0);

  // The helper records the synthetic WAV configured by the existing E2E runner.
  const recording = recordFor(page, 4000);
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  for (const name of ['Practice', 'Feedback', 'People', 'Progress']) await expect(scenes.getByRole('button', { name, exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Example walkthrough', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Prepare demo', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Restart walkthrough', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next: Feedback', exact: true })).toBeDisabled();
  await page.locator('#demo-stage').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('main')).toHaveAttribute('aria-label', 'Scene 1 of 4: Practice');
  await recording;
  await expect(scenes.getByRole('button', { name: 'People', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Example walkthrough', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Retake', exact: true })).toBeEnabled();
  expect(writes.filter(write => write === attemptPath)).toHaveLength(0);

  const scoredResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/missions/cafe-iced-americano/attempts' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Get my score', exact: true }).click();
  const response = await scoredResponse;
  expect(response.ok()).toBe(true);
  const result = await response.json() as AttemptResult;
  expect(result.attempt.score).toMatchObject({ overall: 88, scoredBy: 'mock' });
  await expect(page.getByRole('main')).toHaveAttribute('aria-label', 'Scene 2 of 4: Feedback');
  await expect(page.getByLabel('Overall practice score: 88 out of 100', { exact: true })).toBeVisible();
  await expect(page.getByText('Demo scoring, not AI', { exact: true })).toBeVisible();
  await expect(page.getByText(result.attempt.score.nextTip, { exact: true })).toBeVisible();
  expect(writes.filter(write => write === attemptPath)).toHaveLength(1);

  await scenes.getByRole('button', { name: 'Practice', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your practice is saved.', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Get my score', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'View my result', exact: true }).click();
  await scenes.getByRole('button', { name: 'Progress', exact: true }).click();
  await expect(page.getByText('Latest completed attempt', { exact: true })).toBeVisible();
  const [journal] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('link', { name: 'Open my practice journal', exact: true }).click(),
  ]);
  try {
    await expect(journal).toHaveURL(/\/app\/progress$/);
    await expect(journal.getByRole('heading', { name: 'Your speaking journal.', exact: true })).toBeVisible();
    const attempts = journal.getByRole('list', { name: 'Past speaking attempts', exact: true });
    await expect(attempts.getByRole('listitem')).toHaveCount(1);
    await expect(attempts.getByLabel('88 out of 100', { exact: true })).toBeVisible();
    await page.bringToFront();
    await page.getByRole('button', { name: 'Restart walkthrough', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Example walkthrough', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Live practice', exact: true }).click();
    await page.getByRole('checkbox', { name: /I agree that my voice recordings/ }).check();
    await page.getByRole('button', { name: 'Start live practice', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Record', exact: true })).toBeVisible();
    await expect(page.getByText(/Practicing as Guest \d{4}\./)).toBeVisible();
    expect(writes).toEqual(['POST /api/session', attemptPath]);
    expect((await mediaState(page)).requests).toBe(1);
    await journal.reload();
    await expect(attempts.getByRole('listitem')).toHaveCount(1);
  } finally {
    await journal.close();
  }
});

test('preparation plays and discards local audio and closes an active microphone without API writes', async ({ page, context }) => {
  const writes = captureApiWrites(context);
  await instrumentMedia(page);
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Prepare demo', exact: true }).click();
  const setup = page.getByRole('dialog', { name: 'Prepare your demo', exact: true });
  await expect(setup).toBeVisible();
  await expect(setup.getByText('Your mic-check recording stays in this browser. It is not uploaded or sent to AI.', { exact: true })).toBeVisible();
  expect((await mediaState(page)).requests).toBe(0);
  await recordFor(page, 2500);
  const preview = setup.getByLabel('Recording preview', { exact: true });
  await expect(preview).toBeVisible();
  await preview.evaluate(element => (element as HTMLAudioElement).play());
  await expect.poll(() => preview.evaluate(element => !(element as HTMLAudioElement).paused && (element as HTMLAudioElement).currentTime > 0)).toBe(true);
  await setup.getByRole('button', { name: 'Mic sounds good', exact: true }).click();
  await expect(setup.getByRole('status')).toContainText('The test recording has been discarded.');
  await expect(preview).toHaveCount(0);
  await expect.poll(async () => (await mediaState(page)).revocations).toBeGreaterThan(0);
  expect(await mediaState(page)).toMatchObject({ requests: 1, tracks: 1, stops: 1, live: 0 });

  await setup.getByRole('button', { name: 'Check microphone again', exact: true }).click();
  await setup.getByRole('button', { name: 'Record', exact: true }).click();
  await expect(setup.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  expect((await mediaState(page)).live).toBe(1);
  // A modal preparation sheet keeps background navigation and scene keys inert.
  const backgroundScene = page.locator('nav[aria-label="Walkthrough scenes"] button').nth(2);
  await backgroundScene.evaluate(element => (element as HTMLButtonElement).focus());
  await expect(backgroundScene).not.toBeFocused();
  // Replacing Record with Stop can leave focus on body; Tab must re-enter the modal.
  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#demo-stage')).toHaveAttribute('aria-label', 'Scene 1 of 4: Practice');
  await setup.getByRole('button', { name: 'Close preparation', exact: true }).click();
  await expect(setup).toHaveCount(0);
  await expect.poll(async () => (await mediaState(page)).live).toBe(0);
  expect(await mediaState(page)).toMatchObject({ requests: 2, tracks: 2, stops: 2 });
  expect(writes).toEqual([]);
  expect((await context.cookies()).some(cookie => cookie.name === 'hl_session')).toBe(false);
  await expect(page.getByRole('button', { name: 'Prepare demo', exact: true })).toBeFocused();
});
