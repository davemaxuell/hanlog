'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MissionFlow } from '@/components/mission/MissionFlow';
import type { RecorderDeps } from '@/components/recorder/useRecorder';
import { Button, StatusNote, Surface } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api-client';
import type { AttemptResult, Mission, User } from '@/lib/contracts';
import { errorCopy } from '@/lib/ui/error-copy';
import { CONSENT_TEXT } from '@/lib/ui/session-context';

export function LivePractice({ mission, onScored, onActivityChange, convert, deps }: {
  mission: Mission;
  onScored(result: AttemptResult): void;
  onActivityChange?(active: boolean): void;
  convert?: (blob: Blob) => Promise<Uint8Array>;
  deps?: Partial<RecorderDeps>;
}) {
  const [consent, setConsent] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [missionActive, setMissionActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  const activityCallback = useRef(onActivityChange);
  const currentUser = useRef<User | null>(null);
  const profileRevision = useRef(0);
  const userId = user?.id;

  useEffect(() => {
    activityCallback.current = onActivityChange;
    onActivityChange?.(busy || missionActive);
  }, [busy, missionActive, onActivityChange]);
  useEffect(() => {
    const revisions = profileRevision;
    alive.current = true;
    return () => { alive.current = false; revisions.current++; activityCallback.current?.(false); };
  }, []);

  const requireRestart = useCallback((message: string) => {
    profileRevision.current++; currentUser.current = null;
    setUser(null); setConsent(false); setMissionActive(false); setError(message);
  }, []);
  const validateProfile = useCallback(async () => {
    const expected = currentUser.current; const revision = profileRevision.current;
    if (!alive.current || !expected) return false;
    try {
      const found = await api.getSession();
      if (!alive.current || revision !== profileRevision.current) return false;
      if (!found || found.id !== expected.id) {
        requireRestart('The profile used in this browser has changed. Review consent and start again. Any unsent recording has been discarded.');
        return false;
      }
      currentUser.current = found; setUser(found);
      return true;
    } catch {
      if (alive.current && revision === profileRevision.current) requireRestart("We couldn't verify the profile used in this browser. Reconnect, review consent, and start again. Any unsent recording has been discarded.");
      return false;
    }
  }, [requireRestart]);
  useEffect(() => {
    if (!userId) return;
    const resumed = () => { if (!document.hidden) void validateProfile(); };
    const changed = (event: StorageEvent) => { if (event.key === 'hl_session_changed') void validateProfile(); };
    window.addEventListener('focus', resumed); document.addEventListener('visibilitychange', resumed); window.addEventListener('storage', changed);
    return () => { window.removeEventListener('focus', resumed); document.removeEventListener('visibilitychange', resumed); window.removeEventListener('storage', changed); };
  }, [userId, validateProfile]);

  const start = async () => {
    if (!consent || lock.current || user) return;
    lock.current = true; setBusy(true); setError(null);
    const revision = ++profileRevision.current;
    try {
      const existing = await api.getSession();
      if (!alive.current || revision !== profileRevision.current) return;
      const profile = existing ?? await api.createSession({ nickname: `Guest ${Math.floor(1000 + Math.random() * 9000)}`, role: 'learner' });
      if (alive.current && revision === profileRevision.current) { currentUser.current = profile; setUser(profile); }
    } catch (cause) {
      if (alive.current) setError(errorCopy(cause instanceof ApiClientError ? cause.code : 'internal') || 'Your practice profile could not be opened. Try again.');
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };

  return <div className="hl-stack demo-live-practice">
    {!user ? <Surface tone="apricot"><div className="hl-stack">
      <div className="hl-stack-sm">
        <p className="hl-eyebrow">Your voice, live feedback</p>
        <h2>Ready to try it yourself?</h2>
        <p>Start with the profile already used in this browser. If there is no profile, we will create a guest learner for you.</p>
        <p className="hl-caption">Results are saved to the profile used in this browser. Your recording is sent for scoring only when you choose Get my score.</p>
      </div>
      <label className="hl-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} /><span>{CONSENT_TEXT}</span></label>
      <Link href="/privacy">Read the privacy notice</Link>
      {error && <StatusNote tone="error">{error}</StatusNote>}
      <div className="hl-actions"><Button disabled={!consent} busy={busy} busyLabel="Opening your practice profile…" onClick={() => void start()}>Start live practice</Button></div>
    </div></Surface> : <>
      <p className="hl-caption">Practicing as {user.nickname}. Results are saved to the profile used in this browser.</p>
      <MissionFlow mission={mission} headingLevel={2} presentation beforeSubmit={validateProfile} onScored={onScored} onActivityChange={setMissionActive} convert={convert} deps={deps} />
    </>}
  </div>;
}
