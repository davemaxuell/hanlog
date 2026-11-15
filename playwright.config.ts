import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3100',
    permissions: ['microphone', 'camera'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${resolve('tests/e2e/fixtures/voice.wav')}`] },
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD === '1' ? 'npx next start -p 3100' : 'npm run build && npx next start -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      NODE_ENV: 'production', SCORING_PROVIDER: 'mock', OPENAI_API_KEY: '',
      SITE_URL: 'http://localhost:3000', VERCEL_ENV: '', VERCEL_URL: '', VERCEL_PROJECT_PRODUCTION_URL: '',
      SESSION_SECRET: 'e2e-session-secret-0123456789abcdef', CRON_SECRET: 'e2e-cron',
      DATABASE_URL: '', POSTGRES_URL: '', PGLITE_DIR: 'memory://', VERCEL: '', MEDIA_DIR: '.data/e2e-media',
      SUPABASE_URL: '', SUPABASE_SECRET_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '',
    },
  },
});
