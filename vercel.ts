import type { VercelConfig } from '@vercel/config/v1';
const config: VercelConfig = {
  framework: 'nextjs',
  regions: ['icn1'],
  crons: [{ path: '/api/cron/cleanup', schedule: '0 18 * * *' }],
};
export default config;
