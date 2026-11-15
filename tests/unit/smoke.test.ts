import { describe, expect, it, vi } from 'vitest';
import { runSmoke } from '../../scripts/smoke.mjs';

const response = (body: unknown, status = 200, headers = {}) => new Response(body === null ? null : JSON.stringify(body), { status, headers });

describe('deployment smoke checks', () => {
  it('makes only read-only checks by default and does not follow redirects', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(input instanceof Request ? input.url : input);
      expect(init.method ?? 'GET').toBe('GET');
      expect(init.redirect).toBe('error');
      if (url.pathname === '/api/session') return response({ user: null });
      if (url.pathname === '/api/missions') return response({ missions: Array.from({ length: 24 }, () => ({})) });
      if (url.pathname === '/api/cron/cleanup') return response({}, 401);
      return response({}, 200, { 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY' });
    });
    const lines: string[] = [];
    expect(await runSmoke('https://hanlog.example', { fetchImpl, log: (line: string) => lines.push(line) })).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(lines.every(line => line.startsWith('PASS'))).toBe(true);
  });
  it('requires an explicit attempt budget before any live request', async () => {
    const fetchImpl = vi.fn();
    await expect(runSmoke('https://hanlog.example', { live: true, fetchImpl })).rejects.toThrow('Live smoke requires --max-attempts=2');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('deletes its temporary profile even when live scoring fails and never retries', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(input instanceof Request ? input.url : input);
      const call = `${init.method ?? 'GET'} ${url.pathname}`;
      calls.push(call);
      if (call === 'POST /api/session') return response({ user: { id: 'smoke' } }, 201, { 'set-cookie': 'hl_session=temporary; HttpOnly; Secure; SameSite=Lax' });
      if (call === 'DELETE /api/session') { expect(new Headers(init.headers).get('cookie')).toBe('hl_session=temporary'); return response(null, 204); }
      if (call.includes('/attempts')) return response({ error: {} }, 503);
      if (url.pathname === '/api/session') return response({ user: null });
      if (url.pathname === '/api/missions') return response({ missions: Array.from({ length: 24 }, () => ({})) });
      if (url.pathname === '/api/cron/cleanup') return response({}, 401);
      return response({}, 200, { 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY' });
    });
    const result = await runSmoke('https://hanlog.example', { live: true, maxAttempts: 2, fetchImpl, wav: new Uint8Array([1]), log: () => {} });
    expect(result).toBe(false);
    expect(calls.filter(call => call.includes('/attempts'))).toHaveLength(1);
    expect(calls.at(-1)).toBe('DELETE /api/session');
  });
  it('bounds a successful live flow to two attempts and treats deletion failure as a failure', async () => {
    let attempts = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (init.method === 'DELETE') return response({}, 503);
      if (url.pathname === '/api/session' && init.method === 'POST') return response({}, 201, { 'set-cookie': 'hl_session=temporary; HttpOnly; Secure; SameSite=Lax' });
      if (url.pathname === '/api/session') return response({ user: null });
      if (url.pathname === '/api/missions') return response({ missions: Array.from({ length: 24 }, () => ({})) });
      if (url.pathname === '/api/points') return response({ balance: 10 });
      if (url.pathname === '/api/cron/cleanup') return response({}, 401);
      if (url.pathname.endsWith('/attempts')) {
        attempts += 1;
        return attempts === 1 ? response({ score: { scoredBy: 'ai', overall: 88 } }) : response({ error: { code: 'no_speech' } }, 422);
      }
      return response({}, 200, { 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY' });
    });
    expect(await runSmoke('https://hanlog.example', { live: true, maxAttempts: 2, fetchImpl, wav: new Uint8Array([1]), log: () => {} })).toBe(false);
    expect(attempts).toBe(2);
  });
});
