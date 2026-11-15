import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { createPgDb } from '@/lib/db/pg';
import { setDbForTests, type Db } from '@/lib/db';
import { applyMigrations } from '@/lib/db/migrate';
import { ensureSeed } from '@/lib/repo/seed';
import { createMemoryMediaStore, setMediaStoreForTests } from '@/lib/media';
import { makeRequest } from '../helpers/api';
import { call } from './_helpers';
import { clientIpHash } from '@/lib/http';

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('real Postgres', () => {
  let db: ReturnType<typeof createPgDb> | undefined;
  const users: string[] = [];
  async function waitsForQueryLock(pattern: string): Promise<boolean> {
    for (let i = 0; i < 200; i++) {
      const [row] = await db!.query<{ waiting: boolean }>("select exists(select 1 from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and wait_event_type = 'Lock' and query like $1) as waiting", [pattern]);
      if (row.waiting) return true;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    return false;
  }
  beforeAll(async () => {
    vi.stubEnv('USER_DAILY_ATTEMPTS', '5');
    db = createPgDb(url!);
    await applyMigrations(db);
    await ensureSeed(db);
    setDbForTests(db);
  });
  afterAll(async () => {
    try {
      if (db && users.length) {
        await db.query('delete from hanlog.scoring_calls where user_id = any($1::uuid[])', [users]);
        await db.query('delete from hanlog.users where id = any($1::uuid[])', [users]);
      }
    } finally { setMediaStoreForTests(null); setDbForTests(null); await db?.close(); vi.unstubAllEnvs(); }
  });

  it('pays a mission once under real concurrency', async () => {
    const { createUser } = await import('@/lib/repo/users');
    const { recordAttempt } = await import('@/lib/repo/attempts');
    const { getMission } = await import('@/lib/content');
    const user = await createUser({ nickname: 'pg-live', role: 'learner', ipHash: `live-${Date.now()}` });
    users.push(user.id);
    const score = { overall: 90, pronunciation: 90, accuracy: 90, usage: 90, heard: 'h', issues: [], praise: 'p', nextTip: 't', scoredBy: 'mock' as const };
    const results = await Promise.all(Array.from({ length: 8 }, () => recordAttempt({ userId: user.id, mission: getMission('campus-group-roles')!, score })));
    expect(results.reduce((sum, r) => sum + r.attempt.pointsAwarded, 0)).toBe(30);
  });
  it('never exceeds the cap under real concurrency', async () => {
    const { createUser } = await import('@/lib/repo/users');
    const { reserveScoringCall } = await import('@/lib/limits');
    const user = await createUser({ nickname: 'pg-live-2', role: 'learner', ipHash: `live2-${Date.now()}` });
    users.push(user.id);
    const settled = await Promise.allSettled(Array.from({ length: 12 }, () => reserveScoringCall({ userId: user.id, ipHash: 'unknown' })));
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(5);
  });
  it('keeps concurrent creation quotas after one of the new profiles is deleted', async () => {
    const { POST } = await import('@/app/api/session/route');
    const { deleteUserCascade } = await import('@/lib/repo/users');
    const priorLimit = process.env.IP_DAILY_SESSIONS;
    vi.stubEnv('IP_DAILY_SESSIONS', '2');
    const request = () => makeRequest('POST', '/api/session', { json: { nickname: 'pg-new-profile', role: 'learner', consent: true }, headers: { 'x-forwarded-for': '203.0.113.74' } });
    const addressHash = clientIpHash(request());
    try {
      const responses = await Promise.all(Array.from({ length: 8 }, () => call(POST, request())));
      expect(responses.filter(response => response.status === 201)).toHaveLength(2);
      expect(responses.filter(response => response.status === 429)).toHaveLength(6);
      const created = await Promise.all(responses.filter(response => response.status === 201).map(async response => (await response.json()).user.id as string));
      users.push(...created);
      await deleteUserCascade(created[0], undefined, 0);
      expect((await call(POST, request())).status).toBe(429);
      expect(await db!.query('select sessions from hanlog.session_creation_limits where ip_hash=$1', [addressHash])).toEqual([{ sessions: 2 }]);
    } finally {
      await db!.query('delete from hanlog.session_creation_limits where ip_hash=$1', [addressHash]);
      if (priorLimit === undefined) delete process.env.IP_DAILY_SESSIONS;
      else process.env.IP_DAILY_SESSIONS = priorLimit;
    }
  });
  it('consumes one recovery nonce atomically and reissues identical retries without another revocation', async () => {
    const { createUser } = await import('@/lib/repo/users');
    const { rotateRecoveryKey, restoreAccount, revokeSessions } = await import('@/lib/repo/accounts');
    const user = await createUser({ nickname: 'pg-recovery', role: 'learner', ipHash: 'live-recovery' });
    users.push(user.id);
    const { recoveryKey } = await rotateRecoveryKey(user.id, 0);
    const nonces = [randomUUID(), randomUUID()];
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, index) => restoreAccount(recoveryKey, nonces[index % 2])));
    const successes = results.flatMap((result, index) => result.status === 'fulfilled' ? [{ ...result.value, nonce: nonces[index % 2] }] : []);
    expect(successes).toHaveLength(4);
    expect(new Set(successes.map(result => result.recoveryKey)).size).toBe(1);
    expect(successes.every(result => result.version === 1)).toBe(true);
    expect((await restoreAccount(recoveryKey, successes[0].nonce)).recoveryKey).toBe(successes[0].recoveryKey);
    await revokeSessions(user.id, 1);
    await expect(restoreAccount(recoveryKey, successes[0].nonce)).rejects.toMatchObject({ code: 'unauthenticated' });
  });
  it('keeps recovery throttling atomic across simultaneous database connections', async () => {
    const { reserveRecoveryAttempt } = await import('@/lib/repo/accounts');
    const addressHash = `live-recovery-${randomUUID()}`;
    try {
      const results = await Promise.allSettled(Array.from({ length: 16 }, () => reserveRecoveryAttempt(addressHash)));
      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(10);
      expect(results.filter(result => result.status === 'rejected')).toHaveLength(6);
    } finally { await db!.query('delete from hanlog.recovery_attempt_limits where ip_hash = $1', [addressHash]); }
  });
  it('finishes an authorized write before sign-out and refuses subsequent stale writes', async () => {
    const { createUser, lockSessionUser } = await import('@/lib/repo/users');
    const { revokeSessions } = await import('@/lib/repo/accounts');
    const { setSavedMission } = await import('@/lib/repo/progress');
    const user = await createUser({ nickname: 'pg-session-write', role: 'learner', ipHash: 'live-session-write' });
    users.push(user.id);
    let started!: () => void; let resume!: () => void;
    const locked = new Promise<void>(resolve => { started = resolve; });
    const release = new Promise<void>(resolve => { resume = resolve; });
    const write = db!.tx(async tx => {
      await tx.query('select pg_advisory_xact_lock(hashtext($1))', [user.id]);
      await lockSessionUser(tx, user.id, 0);
      await tx.query("insert into hanlog.saved_missions(user_id,mission_id) values ($1,'cafe-iced-americano')", [user.id]);
      started(); await release;
    });
    let logout: Promise<void> | undefined;
    try {
      await locked;
      logout = revokeSessions(user.id, 0);
      expect(await waitsForQueryLock('%update hanlog.users set session_version%')).toBe(true);
      resume(); await Promise.all([write, logout]);
      await expect(setSavedMission(user.id, 'cafe-iced-americano', false, 0)).rejects.toMatchObject({ code: 'unauthenticated' });
      expect(await db!.query('select mission_id from hanlog.saved_missions where user_id=$1', [user.id])).toHaveLength(1);
    } finally { resume(); await Promise.allSettled([write, ...(logout ? [logout] : [])]); }
  });
  it('refuses a queued profile deletion after restore without touching storage', async () => {
    const { createUser, deleteUserCascade, getUser } = await import('@/lib/repo/users');
    const { rotateRecoveryKey, restoreAccount } = await import('@/lib/repo/accounts');
    const user = await createUser({ nickname: 'pg-stale-delete', role: 'learner', ipHash: 'live-stale-delete' });
    users.push(user.id);
    const { recoveryKey } = await rotateRecoveryKey(user.id, 0);
    let started!: () => void; let resume!: () => void;
    const locked = new Promise<void>(resolve => { started = resolve; });
    const release = new Promise<void>(resolve => { resume = resolve; });
    const holder = db!.tx(async tx => {
      await tx.query('select pg_advisory_xact_lock(hashtext($1))', [user.id]);
      started(); await release;
    });
    const remove = vi.fn(async () => {});
    let deletion: Promise<unknown> | undefined;
    try {
      await locked;
      deletion = expect(deleteUserCascade(user.id, remove, 0)).rejects.toMatchObject({ code: 'unauthenticated' });
      expect(await waitsForQueryLock('%pg_advisory_xact_lock%')).toBe(true);
      expect((await restoreAccount(recoveryKey, randomUUID())).version).toBe(1);
      resume(); await Promise.all([holder, deletion]);
      expect(remove).not.toHaveBeenCalled();
      expect(await getUser(user.id)).toEqual(user);
    } finally { resume(); await Promise.allSettled([holder, ...(deletion ? [deletion] : [])]); }
  });
  it('refuses a new scoring reservation after deletion has detached profile identifiers', async () => {
    const { createUser, deleteUserCascade } = await import('@/lib/repo/users');
    const { reserveScoringCall } = await import('@/lib/limits');
    const { SYSTEM_USER_ID } = await import('@/lib/contracts');
    const user = await createUser({ nickname: 'pg-delete-quota', role: 'learner', ipHash: 'live-delete-quota' });
    users.push(user.id);
    const address = `delete-quota-${randomUUID()}`;
    const original = await reserveScoringCall({ userId: user.id, ipHash: address, expectedVersion: 0 });
    let started!: () => void; let resume!: () => void; let paused = false;
    const detached = new Promise<void>(resolve => { started = resolve; });
    const release = new Promise<void>(resolve => { resume = resolve; });
    const wrap = (source: Db): Db => ({
      query: async <T>(sql: string, params?: unknown[]) => {
        const rows = await source.query<T>(sql, params);
        if (!paused && sql.startsWith('update hanlog.scoring_calls set user_id')) { paused = true; started(); await release; }
        return rows;
      },
      tx: fn => source.tx(tx => fn(wrap(tx))),
    });
    let deletion: Promise<unknown> | undefined; let reservation: Promise<unknown> | undefined;
    try {
      setDbForTests(wrap(db!));
      deletion = deleteUserCascade(user.id, undefined, 0);
      await detached;
      reservation = reserveScoringCall({ userId: user.id, ipHash: address, expectedVersion: 0 }).then(value => ({ value }), error => ({ error }));
      const waiting = await waitsForQueryLock('%select id,nickname,role,created_at from hanlog.users%');
      resume(); await deletion;
      expect(await db!.query('select id from hanlog.scoring_calls where user_id=$1', [user.id])).toHaveLength(0);
      expect(waiting).toBe(true);
      expect(await reservation).toMatchObject({ error: { code: 'unauthenticated' } });
      expect(await db!.query('select user_id from hanlog.scoring_calls where id=$1', [original.id])).toEqual([{ user_id: SYSTEM_USER_ID }]);
    } finally {
      resume(); await Promise.allSettled([deletion, reservation].filter((value): value is Promise<unknown> => !!value));
      setDbForTests(db!);
      await db!.query('delete from hanlog.scoring_calls where ip_hash=$1', [address]);
    }
  });
  it('keeps cleanup user/content lock ordering compatible with authorized writes', async () => {
    const { createUser, lockSessionUser } = await import('@/lib/repo/users');
    const { createChallenge } = await import('@/lib/repo/challenges');
    const { upsertResponse } = await import('@/lib/repo/responses');
    const { cleanupExpiredMedia } = await import('@/lib/media/cleanup');
    const author = await createUser({ nickname: 'pg-clean-author', role: 'korean', ipHash: 'live-clean-order' });
    const learner = await createUser({ nickname: 'pg-clean-learner', role: 'learner', ipHash: 'live-clean-order' });
    users.push(author.id, learner.id);
    const store = createMemoryMediaStore(); setMediaStoreForTests(store);
    const challenge = await createChallenge({ authorId: author.id, korean: '안녕하세요', meaningEn: 'Hello', situationEn: '' });
    const { record } = await upsertResponse({ challengeId: challenge.id, responderId: learner.id, mediaKind: 'audio', mediaMime: 'audio/webm', ext: 'webm', durationMs: 1000, bytes: new Uint8Array([1]), expectedVersion: 0 });
    await db!.query("update hanlog.challenge_responses set created_at = now() - interval '15 days' where id=$1", [record.id]);
    await db!.query("update hanlog.users set recovery_retry_expires_at = now() - interval '1 second' where id=$1", [learner.id]);
    let started!: () => void; let resume!: () => void;
    const locked = new Promise<void>(resolve => { started = resolve; });
    const release = new Promise<void>(resolve => { resume = resolve; });
    const write = db!.tx(async tx => {
      await tx.query('select pg_advisory_xact_lock(hashtext($1))', [learner.id]);
      await lockSessionUser(tx, learner.id, 0);
      started(); await release;
      await tx.query('update hanlog.challenge_responses set duration_ms=2000 where id=$1', [record.id]);
    });
    let cleanup: Promise<number> | undefined;
    try {
      await locked;
      cleanup = cleanupExpiredMedia();
      expect(await waitsForQueryLock('%update hanlog.users set recovery_previous_hash%')).toBe(true);
      resume(); await write;
      expect(await cleanup).toBe(1);
      expect(await db!.query('select duration_ms,media_path from hanlog.challenge_responses where id=$1', [record.id])).toEqual([{ duration_ms: 2000, media_path: null }]);
      expect(store.paths()).toEqual([]);
    } finally { resume(); await Promise.allSettled([write, ...(cleanup ? [cleanup] : [])]); }
  });
  it('serializes a response report before parent-profile deletion without a lock cycle', async () => {
    const { createUser, deleteUserCascade, getUser } = await import('@/lib/repo/users');
    const { createChallenge } = await import('@/lib/repo/challenges');
    const { upsertResponse } = await import('@/lib/repo/responses');
    const { reportCommunityTarget } = await import('@/lib/repo/community');
    const author = await createUser({ nickname: 'pg-report-author', role: 'korean', ipHash: 'live-report-delete' });
    const learner = await createUser({ nickname: 'pg-report-learner', role: 'learner', ipHash: 'live-report-delete' });
    users.push(author.id, learner.id);
    const store = createMemoryMediaStore(); setMediaStoreForTests(store);
    const challenge = await createChallenge({ authorId: author.id, korean: '안녕하세요', meaningEn: 'Hello', situationEn: '' });
    const { record } = await upsertResponse({ challengeId: challenge.id, responderId: learner.id, mediaKind: 'audio', mediaMime: 'audio/webm', ext: 'webm', durationMs: 1000, bytes: new Uint8Array([1]) });
    let started!: () => void; let resume!: () => void; let paused = false;
    const locked = new Promise<void>(resolve => { started = resolve; });
    const release = new Promise<void>(resolve => { resume = resolve; });
    const wrap = (source: Db): Db => ({
      query: async <T>(sql: string, params?: unknown[]) => {
        const rows = await source.query<T>(sql, params);
        if (!paused && sql === 'select id from hanlog.challenge_responses where id=$1 for update') { paused = true; started(); await release; }
        return rows;
      },
      tx: fn => source.tx(tx => fn(wrap(tx))),
    });
    let report: Promise<unknown> | undefined; let deletion: Promise<unknown> | undefined;
    try {
      setDbForTests(wrap(db!));
      report = reportCommunityTarget(learner, { responseId: record.id, reason: 'privacy', expectedVersion: 0 });
      await locked;
      deletion = deleteUserCascade(author.id, paths => store.remove(paths), 0);
      const waiting = await waitsForQueryLock('%select id from hanlog.challenges where author_id%');
      resume();
      const outcomes = await Promise.allSettled([report, deletion]);
      expect(waiting).toBe(true);
      expect(outcomes.map(outcome => outcome.status)).toEqual(['fulfilled', 'fulfilled']);
      expect(await getUser(author.id)).toBeNull();
      expect(store.paths()).toEqual([]);
    } finally {
      resume(); await Promise.allSettled([report, deletion].filter((value): value is Promise<unknown> => !!value));
      setDbForTests(db!);
    }
  });
  it('does not reveal a response if its report disappears while review is waiting', async () => {
    const { createUser, deleteUserCascade } = await import('@/lib/repo/users');
    const { upsertResponse } = await import('@/lib/repo/responses');
    const { reportCommunityTarget, reviewReport } = await import('@/lib/repo/community');
    const reviewer = await createUser({ nickname: 'pg-gone-reporter', role: 'korean', ipHash: 'live-gone-report' });
    const learner = await createUser({ nickname: 'pg-gone-learner', role: 'learner', ipHash: 'live-gone-report' });
    users.push(reviewer.id, learner.id);
    setMediaStoreForTests(createMemoryMediaStore());
    const [challenge] = await db!.query<{ id: string }>('select id from hanlog.challenges where is_sample limit 1');
    const { record } = await upsertResponse({ challengeId: challenge.id, responderId: learner.id, mediaKind: 'audio', mediaMime: 'audio/webm', ext: 'webm', durationMs: 1000, bytes: new Uint8Array([1]) });
    await reportCommunityTarget(reviewer, { responseId: record.id, reason: 'privacy', expectedVersion: 0 });
    const [report] = await db!.query<{ id: string }>('select id from hanlog.community_reports where reporter_id=$1', [reviewer.id]);
    let started!: () => void; let resume!: () => void; let paused = false;
    const read = new Promise<void>(resolve => { started = resolve; });
    const release = new Promise<void>(resolve => { resume = resolve; });
    const wrap = (source: Db): Db => ({
      query: async <T>(sql: string, params?: unknown[]) => {
        const rows = await source.query<T>(sql, params);
        if (!paused && sql === 'select challenge_id,response_id from hanlog.community_reports where id::text=$1') { paused = true; started(); await release; }
        return rows;
      },
      tx: fn => source.tx(tx => fn(wrap(tx))),
    });
    const review = expect(reviewReport(wrap(db!), report.id, 'actioned')).rejects.toMatchObject({ code: 'not_found' });
    try {
      await read;
      await deleteUserCascade(reviewer.id, undefined, 0);
      resume(); await review;
      expect(await db!.query('select flagged from hanlog.challenge_responses where id=$1', [record.id])).toEqual([{ flagged: true }]);
    } finally { resume(); await Promise.allSettled([review]); }
  });
  it('waits for the tenth in-flight restore before deciding whether its identical retry is limited', async () => {
    const { createUser } = await import('@/lib/repo/users');
    const { rotateRecoveryKey } = await import('@/lib/repo/accounts');
    const { POST } = await import('@/app/api/account/restore/route');
    const user = await createUser({ nickname: 'pg-retry-race', role: 'learner', ipHash: 'live-retry-race' });
    users.push(user.id);
    const { recoveryKey } = await rotateRecoveryKey(user.id, 0);
    const requestId = randomUUID();
    const request = (key = recoveryKey) => makeRequest('POST', '/api/account/restore', { json: { recoveryKey: key, requestId }, headers: { 'x-forwarded-for': '203.0.113.31' } });
    const addressHash = clientIpHash(request());
    let started!: () => void; let resume!: () => void; let paused = false;
    const reserved = new Promise<void>(resolve => { started = resolve; });
    const release = new Promise<void>(resolve => { resume = resolve; });
    const wrap = (source: Db): Db => ({
      query: async <T>(sql: string, params?: unknown[]) => {
        const rows = await source.query<T>(sql, params);
        if (!paused && sql.includes('insert into hanlog.recovery_attempt_limits')) { paused = true; started(); await release; }
        return rows;
      },
      tx: fn => source.tx(tx => fn(wrap(tx))),
    });
    let original: Promise<Response> | undefined; let retry: Promise<Response> | undefined;
    try {
      for (let i = 0; i < 9; i++) expect((await call(POST, request(`hlk_${'z'.repeat(43)}`))).status).toBe(401);
      setDbForTests(wrap(db!));
      original = call(POST, request());
      await reserved;
      let retryFinished = false;
      retry = call(POST, request()).then(response => { retryFinished = true; return response; });
      let waiting = false;
      for (let i = 0; i < 100 && !retryFinished; i++) {
        const [row] = await db!.query<{ waiting: boolean }>("select exists(select 1 from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and query like '%pg_advisory_xact_lock%') as waiting");
        if (row.waiting) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      resume();
      const responses = await Promise.all([original, retry]);
      expect(responses.map(response => response.status)).toEqual([200, 200]);
      expect(waiting).toBe(true);
      expect(await responses[1].json()).toEqual(await responses[0].json());
      expect((await db!.query<{ attempts: number }>('select attempts from hanlog.recovery_attempt_limits where ip_hash = $1', [addressHash]))[0].attempts).toBe(10);
      expect((await db!.query<{ session_version: number }>('select session_version from hanlog.users where id = $1', [user.id]))[0].session_version).toBe(1);
    } finally {
      resume(); await Promise.allSettled([original, retry].filter((request): request is Promise<Response> => !!request));
      setDbForTests(db!);
      await db!.query('delete from hanlog.recovery_attempt_limits where ip_hash = $1', [addressHash]);
    }
  });
  it('bounds recovery lock waiting without telling a retry to wait past its proof window', async () => {
    const { createUser } = await import('@/lib/repo/users');
    const { rotateRecoveryKey } = await import('@/lib/repo/accounts');
    const { POST } = await import('@/app/api/account/restore/route');
    const user = await createUser({ nickname: 'pg-retry-timeout', role: 'learner', ipHash: 'live-retry-timeout' });
    users.push(user.id);
    const { recoveryKey } = await rotateRecoveryKey(user.id, 0);
    const requestId = randomUUID();
    const request = () => makeRequest('POST', '/api/account/restore', { json: { recoveryKey, requestId }, headers: { 'x-forwarded-for': '203.0.113.32' } });
    const addressHash = clientIpHash(request());
    let started!: () => void; let resume!: () => void;
    const locked = new Promise<void>(resolve => { started = resolve; });
    const release = new Promise<void>(resolve => { resume = resolve; });
    const holder = db!.tx(async tx => {
      await tx.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`recovery:${createHash('sha256').update(recoveryKey).digest('hex')}`]);
      started(); await release;
    });
    try {
      await locked;
      const response = await call(POST, request());
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ error: { code: 'service_unavailable' } });
      expect(await db!.query('select attempts from hanlog.recovery_attempt_limits where ip_hash = $1', [addressHash])).toHaveLength(0);
      resume(); await holder;
      expect((await call(POST, request())).status).toBe(200);
    } finally {
      resume(); await holder;
      await db!.query('delete from hanlog.recovery_attempt_limits where ip_hash = $1', [addressHash]);
    }
  });
  it('awards a peer rating once under real row-lock concurrency', async () => {
    const { createUser } = await import('@/lib/repo/users');
    const { createChallenge } = await import('@/lib/repo/challenges');
    const { upsertResponse, rateResponse } = await import('@/lib/repo/responses');
    const { getPoints } = await import('@/lib/repo/points');
    const author = await createUser({ nickname: 'pg-author', role: 'korean', ipHash: 'live-peer' });
    const learner = await createUser({ nickname: 'pg-learner', role: 'learner', ipHash: 'live-peer' });
    users.push(author.id, learner.id);
    setMediaStoreForTests(createMemoryMediaStore());
    const challenge = await createChallenge({ authorId: author.id, korean: '안녕하세요', meaningEn: 'Hello', situationEn: '' });
    const { record } = await upsertResponse({ challengeId: challenge.id, responderId: learner.id, mediaKind: 'audio', mediaMime: 'audio/webm', ext: 'webm', durationMs: 1000, bytes: new Uint8Array([1]) });
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => rateResponse({ responseId: record.id, raterId: author.id, pronunciation: 5, naturalness: 5, comment: '' })));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect((await getPoints(learner.id)).balance).toBe(30);
    expect((await getPoints(author.id)).balance).toBe(10);
  });
  it('waits for an in-flight answer before deleting its profile-owned challenge', async () => {
    const { createUser, deleteUserCascade, getUser } = await import('@/lib/repo/users');
    const { createChallenge } = await import('@/lib/repo/challenges');
    const { upsertResponse } = await import('@/lib/repo/responses');
    const author = await createUser({ nickname: 'pg-delete', role: 'korean', ipHash: 'live-delete' });
    const learner = await createUser({ nickname: 'pg-upload', role: 'learner', ipHash: 'live-delete' });
    users.push(author.id, learner.id);
    const challenge = await createChallenge({ authorId: author.id, korean: '안녕하세요', meaningEn: 'Hello', situationEn: '' });
    const store = createMemoryMediaStore();
    let started!: () => void; let resume!: () => void;
    const uploading = new Promise<void>(resolve => { started = resolve; });
    const release = new Promise<void>(resolve => { resume = resolve; });
    setMediaStoreForTests({ ...store, put: async (path, bytes, mime) => { started(); await release; await store.put(path, bytes, mime); } });
    const upload = upsertResponse({ challengeId: challenge.id, responderId: learner.id, mediaKind: 'audio', mediaMime: 'audio/webm', ext: 'webm', durationMs: 1000, bytes: new Uint8Array([1]) });
    await uploading;
    const deletion = deleteUserCascade(author.id, paths => store.remove(paths));
    resume();
    await Promise.all([upload, deletion]);
    expect(await getUser(author.id)).toBeNull();
    expect(store.paths()).toEqual([]);
  });
  it('waits for an in-flight reference write before deleting its owner', async () => {
    const { createUser, deleteUserCascade, getUser } = await import('@/lib/repo/users');
    const { createChallenge, setChallengeReference } = await import('@/lib/repo/challenges');
    const { queueMediaRemoval } = await import('@/lib/media/pending');
    const author = await createUser({ nickname: 'pg-reference', role: 'korean', ipHash: 'live-reference' });
    users.push(author.id);
    const challenge = await createChallenge({ authorId: author.id, korean: '안녕하세요', meaningEn: 'Hello', situationEn: '' });
    const path = `references/${challenge.id}.webm`;
    const store = createMemoryMediaStore(); setMediaStoreForTests(store);
    await queueMediaRemoval(path, { ownerId: author.id, challengeId: challenge.id, challengeAuthorId: author.id });
    let started!: () => void; let resume!: () => void;
    const uploading = new Promise<void>(resolve => { started = resolve; });
    const release = new Promise<void>(resolve => { resume = resolve; });
    const upload = setChallengeReference(challenge.id, path, 'audio/webm', async () => { started(); await release; await store.put(path, new Uint8Array([1]), 'audio/webm'); });
    await uploading;
    const deletion = deleteUserCascade(author.id, paths => store.remove(paths));
    resume();
    await Promise.all([upload, deletion]);
    expect(await getUser(author.id)).toBeNull();
    expect(store.paths()).toEqual([]);
  });
  it('does not cascade an answer committed while incomplete-challenge compensation waits', async () => {
    const { createUser } = await import('@/lib/repo/users');
    const { createChallenge, removeIncompleteChallenge } = await import('@/lib/repo/challenges');
    const author = await createUser({ nickname: 'pg-catch-author', role: 'korean', ipHash: 'live-catch' });
    const learner = await createUser({ nickname: 'pg-catch-learner', role: 'learner', ipHash: 'live-catch' });
    users.push(author.id, learner.id);
    const challenge = await createChallenge({ authorId: author.id, korean: '안녕하세요', meaningEn: 'Hello', situationEn: '' });
    let started!: () => void; let resume!: () => void;
    const uploading = new Promise<void>(resolve => { started = resolve; });
    const release = new Promise<void>(resolve => { resume = resolve; });
    const answer = db!.tx(async tx => {
      await tx.query('select id from hanlog.challenges where id = $1 for share', [challenge.id]);
      await tx.query("insert into hanlog.challenge_responses(challenge_id,responder_id,media_path,media_kind,media_mime,duration_ms) values ($1,$2,'responses/catch-race.webm','audio','audio/webm',1000)", [challenge.id, learner.id]);
      started(); await release;
    });
    await uploading;
    const compensation = removeIncompleteChallenge(challenge.id);
    // Observe the waiting database lock, ensuring the DELETE/lock query has begun before commit.
    let waiting = false;
    for (let i = 0; i < 100; i++) {
      const rows = await db!.query<{ waiting: boolean }>("select exists(select 1 from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and query like '%hanlog.challenges%') as waiting");
      if (rows[0].waiting) { waiting = true; break; }
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    resume(); await Promise.all([answer, compensation]);
    expect(waiting).toBe(true);
    expect(await db!.query('select id from hanlog.challenges where id = $1', [challenge.id])).toHaveLength(1);
    expect(await db!.query('select id from hanlog.challenge_responses where challenge_id = $1', [challenge.id])).toHaveLength(1);
  });
});
