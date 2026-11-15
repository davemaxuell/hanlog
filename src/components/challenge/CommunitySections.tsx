'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { communityApi } from '@/lib/community-client';
import type { Challenge, ChallengeScope } from '@/lib/contracts';
import { containsHangul } from '@/lib/contracts';
import type { InboxItem } from '@/lib/community-contracts';
import { useApi } from '@/lib/ui/use-api';
import { useAction } from '@/lib/ui/use-action';
import { errorCopy } from '@/lib/ui/error-copy';
import { Button, Ko, StatusNote } from '@/components/ui';
import { ChallengeRow } from './ChallengeRow';
import styles from './community.module.css';

function usePages<T extends { id: string }>(load: (cursor?: string) => Promise<{ items: T[]; nextCursor: string | null }>) {
  const request = useApi(() => load(), []); const action = useAction();
  const [extra, setExtra] = useState<T[]>([]); const [cursor, setCursor] = useState<string | null | undefined>(); const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; }, []);
  const items = [...new Map([...(request.data?.items ?? []), ...extra].map(item => [item.id, item])).values()];
  const next = cursor === undefined ? request.data?.nextCursor : cursor;
  const refresh = () => { generation.current += 1; setExtra([]); setCursor(undefined); request.reload(); };
  const more = async () => {
    if (!next) return; const revision = generation.current;
    const result = await action.run(() => load(next));
    if (result && revision === generation.current) { setExtra(old => [...old, ...result.value.items]); setCursor(result.value.nextCursor); }
  };
  return { items, next, request, action, refresh, more };
}

export function ChallengeSection({ scope, query, id, title, description, empty }: { scope: ChallengeScope; query: string; id: string; title: string; description: string; empty: string }) {
  const pages = usePages<Challenge>(async cursor => { const page = await communityApi.listChallenges(scope, { cursor, q: query, limit: 6 }); return { items: page.challenges, nextCursor: page.nextCursor }; });
  const waiting = pages.items.reduce((total, challenge) => total + challenge.viewer.pendingToRate, 0);
  const label = scope === 'to-rate' ? `${title} (${waiting}${pages.next ? '+' : ''})` : title;
  return <section aria-labelledby={`${id}-heading`} id={id} className={styles.section}>
    <div className={styles.sectionHeading}><div><h2 id={`${id}-heading`}>{label}</h2><p>{description}</p></div><Button variant="text" busy={pages.request.loading} busyLabel="Refreshing…" onClick={pages.refresh} aria-label={`Refresh ${title.toLowerCase()}`}>Refresh</Button></div>
    {!pages.request.data && pages.request.loading && <div className={styles.loading} role="status">Opening the conversation…</div>}
    {pages.request.error && <div className="hl-stack-sm"><StatusNote tone="error">{errorCopy(pages.request.error.code)}</StatusNote><Button variant="secondary" className="hl-fit" onClick={pages.refresh}>Try again</Button></div>}
    {pages.request.data && <>{pages.items.length ? <div className={styles.grid}>{pages.items.map(challenge => <ChallengeRow key={challenge.id} challenge={challenge} />)}</div> : <p className="hl-empty">{empty}</p>}{pages.next && <Button variant="secondary" className="hl-fit" busy={pages.action.busy} onClick={() => void pages.more()}>More challenges</Button>}</>}
    {pages.action.error && <StatusNote tone="error">{pages.action.error}</StatusNote>}
  </section>;
}

export function FeedbackInbox() {
  const pages = usePages<InboxItem>(cursor => communityApi.getInbox(cursor));
  return <section aria-labelledby="feedback-inbox-heading" className={styles.inbox}>
    <div className={styles.sectionHeading}><div><p className="hl-eyebrow">Keep the conversation going</p><h2 id="feedback-inbox-heading">Your feedback inbox</h2></div><Button variant="text" busy={pages.request.loading} onClick={pages.refresh} aria-label="Refresh feedback inbox">Refresh</Button></div>
    {!pages.request.data && pages.request.loading && <p role="status">Checking your conversations…</p>}
    {pages.request.error && <div className="hl-stack-sm"><StatusNote tone="error">Feedback could not load. Your challenges are still available.</StatusNote><Button className="hl-fit" variant="secondary" onClick={pages.refresh}>Retry feedback</Button></div>}
    {pages.request.data && (pages.items.length ? <div className={styles.inboxList}>{pages.items.map(item => <Link key={item.id} href={`/app/challenges/${item.challengeId}?response=${item.responseId}#response-${item.responseId}`} className={styles.inboxItem}>
      <span className={styles.inboxSymbol} aria-hidden="true">{item.kind === 'rating' ? '↗' : '↩'}</span><span className={styles.inboxCopy}><strong>{item.kind === 'rating' ? 'Your answer was rated' : 'Feedback on your rating'}</strong><Ko>{item.korean}</Ko>{item.comment && <span lang={containsHangul(item.comment) ? 'ko' : undefined} className={styles.comment}>{item.comment}</span>}<span className="hl-caption">From <span lang={containsHangul(item.nickname) ? 'ko' : undefined}>{item.nickname}</span> · <time dateTime={item.createdAt}>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(item.createdAt))}</time></span></span><span className={styles.inboxAction}>{item.needsFeedback ? 'Say what helped' : 'View exchange'} <span aria-hidden="true">→</span></span>
    </Link>)}</div> : <div className={styles.inboxEmpty}><strong>A little feedback can change someone&apos;s day.</strong><p>Ratings and replies you receive will appear here. Start with a challenge above.</p></div>)}
    {pages.next && <Button variant="secondary" className="hl-fit" busy={pages.action.busy} onClick={() => void pages.more()}>Earlier feedback</Button>}
    {pages.action.error && <StatusNote tone="error">{pages.action.error}</StatusNote>}
  </section>;
}
