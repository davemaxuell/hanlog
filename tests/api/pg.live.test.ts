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
