import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const assert = (condition, message) => { if (!condition) throw new Error(message); };

function silenceWav() {
  const rate = 16000, length = rate * 2 * 2;
  const wav = Buffer.alloc(44 + length);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + length, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(length, 40);
  return wav;
}

/**
 * Defaults to GET-only checks. Live mode creates and deletes one temporary profile,
 * and submits at most two recordings, without retries. It never reads local secrets.
 * @param {string} baseUrl
 * @param {{live?: boolean, maxAttempts?: number, fetchImpl?: typeof fetch, wav?: Uint8Array, log?: (line: string) => void}} options
 */
export async function runSmoke(baseUrl, options = {}) {
  const { live = false, maxAttempts = 0, fetchImpl = fetch, log = console.log } = options;
  const base = new URL(baseUrl);
  assert(['http:', 'https:'].includes(base.protocol) && !base.username && !base.password && base.pathname === '/' && !base.search && !base.hash, 'Supply an http(s) origin without credentials, a path, query, or fragment.');
  if (live) assert(maxAttempts === 2, 'Live smoke requires --max-attempts=2 (one speech recording and one silence check).');
  const wav = live ? options.wav ?? await readFile(new URL('../tests/fixtures/scoring/native-cafe.wav', import.meta.url)) : null;
  let cookie = '', attempts = 0, ok = true;
  const request = (path, init = {}) => fetchImpl(new URL(path, base), {
    ...init, redirect: 'error', signal: AbortSignal.timeout(60_000),
    headers: { origin: base.origin, ...(cookie ? { cookie } : {}), ...init.headers },
  });
  const check = async (name, action) => {
    try { await action(); log(`PASS ${name}`); return true; }
    catch { ok = false; log(`FAIL ${name}`); return false; }
  };
  await check('session starts empty', async () => {
    const res = await request('/api/session');
    assert(res.ok && (await res.json()).user === null, 'Unexpected session');
  });
  await check('24 missions available', async () => {
    const res = await request('/api/missions');
    assert(res.ok && (await res.json()).missions?.length === 24, 'Unexpected missions');
  });
  await check('page security headers', async () => {
    const res = await request('/');
    assert(res.ok && res.headers.get('x-content-type-options') === 'nosniff' && res.headers.get('x-frame-options') === 'DENY', 'Missing headers');
  });
  await check('cleanup refuses an unauthenticated request', async () => {
    assert((await request('/api/cron/cleanup')).status === 401, 'Cleanup exposed');
  });
  if (!live || !ok) return ok;

  const attempt = async audio => {
    assert(attempts < maxAttempts, 'Attempt budget exhausted');
    attempts += 1;
    const form = new FormData();
    form.set('audio', new Blob([new Uint8Array(audio)], { type: 'audio/wav' }), 'smoke.wav');
    return request('/api/missions/cafe-iced-americano/attempts', { method: 'POST', body: form });
  };
  try {
    if (!await check('temporary profile has a secure session', async () => {
      const res = await request('/api/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nickname: 'Smoke check', role: 'learner', consent: true }) });
      const setCookie = res.headers.get('set-cookie') ?? '';
      cookie = setCookie.match(/(?:^|,\s*)(hl_session=[^;]+)/)?.[1] ?? '';
      assert(res.status === 201 && cookie && /;\s*Secure(?:;|$)/i.test(setCookie) && /;\s*HttpOnly(?:;|$)/i.test(setCookie), 'Invalid session');
    })) return false;
    if (!await check('one AI speech attempt scores at least 80', async () => {
      const res = await attempt(wav);
      assert(res.ok, 'Scoring unavailable');
      const body = await res.json();
      assert(body.score?.scoredBy === 'ai' && body.score.overall >= 80, 'AI score outside smoke expectation');
    })) return false;
    if (!await check('silence is rejected without a score', async () => {
      const res = await attempt(silenceWav());
      assert(res.status === 422 && (await res.json()).error?.code === 'no_speech', 'Silence unexpectedly scored');
    })) return false;
    await check('points were awarded', async () => {
      const res = await request('/api/points');
      assert(res.ok && (await res.json()).balance > 0, 'No points');
    });
  } finally {
    if (cookie) await check('temporary profile deleted', async () => {
      assert((await request('/api/session', { method: 'DELETE' })).status === 204, 'Profile deletion failed');
    });
  }
  return ok;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [baseUrl, ...flags] = process.argv.slice(2);
  if (!baseUrl || flags.some(flag => !['--live', '--max-attempts=2'].includes(flag))) {
    console.error('Usage: node scripts/smoke.mjs <origin> [--live --max-attempts=2]');
    process.exitCode = 1;
  } else {
    try { if (!await runSmoke(baseUrl, { live: flags.includes('--live'), maxAttempts: flags.includes('--max-attempts=2') ? 2 : 0 })) process.exitCode = 1; }
    catch { console.error('FAIL preflight: check the URL, fixture, and explicit live attempt budget.'); process.exitCode = 1; }
  }
}
