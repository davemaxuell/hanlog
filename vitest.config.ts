import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };
export default defineConfig({
  test: {
    projects: [
      { resolve: { alias }, test: { name: 'node', environment: 'node', include: ['tests/unit/**/*.test.ts', 'tests/api/**/*.test.ts'], testTimeout: 15000, hookTimeout: 30000 } },
      { plugins: [react()], resolve: { alias }, test: { name: 'ui', environment: 'jsdom', include: ['tests/ui/**/*.test.tsx'], setupFiles: ['tests/helpers/ui-setup.ts'] } },
    ],
  },
});
