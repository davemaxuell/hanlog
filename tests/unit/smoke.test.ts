import { expect, it } from 'vitest';
it('runs in node', () => { expect(typeof process.version).toBe('string'); });
