'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api-client';
import { errorCopy } from '@/lib/ui/error-copy';
import { Button, StatusNote } from '@/components/ui';

export default function ShareLink() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void api.getChallenge(code).then(detail => {
      if (active) router.replace(`/app/challenges/${encodeURIComponent(detail.challenge.id)}`);
    }).catch(cause => {
      if (!active) return;
      if (cause instanceof ApiClientError && cause.code === 'unauthenticated') router.replace(`/app/onboarding?next=${encodeURIComponent(`/c/${code}`)}`);
      else setError(cause instanceof ApiClientError && cause.code === 'not_found' ? 'This challenge link is not valid.' : errorCopy(cause instanceof ApiClientError ? cause.code : 'internal'));
    });
    return () => { active = false; };
  }, [code, revision, router]);
  return <main className="hl-app-main hl-stack"><h1 className="hl-heading">A little Korean, shared.</h1>{error ? <><StatusNote tone="error">{error}</StatusNote><div className="hl-actions"><Button variant="secondary" onClick={() => { setError(''); setRevision(value => value + 1); }}>Try again</Button><Link href="/app/challenges">Open challenges</Link></div></> : <p role="status">Opening your challenge…</p>}</main>;
}
