'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Camera } from '@phosphor-icons/react';
import { socialApi } from '@/lib/social-client';
import type { Post } from '@/lib/social-contracts';
import { useApi } from '@/lib/ui/use-api';
import { errorCopy } from '@/lib/ui/error-copy';
import { Button, StatusNote } from '@/components/ui';
import { CommunityTabs } from '@/components/social/SocialParts';
import { PostCard } from '@/components/social/PostCard';
import styles from '@/components/social/social.module.css';
import { motion } from 'motion/react';
import { JumpingDots } from '@/components/motion/AnimatedNumber';
import { springs } from '@/components/motion/kit';

export default function Feed() {
  const shared = useSearchParams().get('shared');
  const first = useApi(() => socialApi.feed(), []);
  const [more, setMore] = useState<{ posts: Post[]; cursor: string | null } | null>(null);
  const [gone, setGone] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState('');
  const posts = [...(first.data?.posts ?? []), ...(more?.posts ?? [])].filter(post => !gone.includes(post.id));
  const cursor = more ? more.cursor : first.data?.nextCursor ?? null;
  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true); setMoreError('');
    try { const page = await socialApi.feed(cursor); setMore(current => ({ posts: [...(current?.posts ?? []), ...page.posts], cursor: page.nextCursor })); }
    catch { setMoreError(errorCopy('internal')); } finally { setLoadingMore(false); }
  };
  return <div className="hl-stack">
    <CommunityTabs />
    <header className={styles.introRow}>
      <div className={styles.intro}>
        <h1>Korean moments</h1>
        <p>Photos of the Korean you met today: a menu, a sign, a message from a friend. Share one with the expression it taught you.</p>
      </div>
      <Link className="hl-link-button" href="/app/feed/new"><Camera size={20} weight="fill" aria-hidden="true" />Share a moment</Link>
    </header>
    {shared !== null && <StatusNote tone="success">Your moment is on the feed.{Number(shared) > 0 ? ` +${Number(shared)} points.` : ''}</StatusNote>}
    {Number(shared) > 0 && <motion.span className={styles.earnedPop} aria-hidden="true" initial={{ scale: 0.3, y: 16, rotate: -8 }} animate={{ scale: 1, y: 0, rotate: 0 }} transition={{ ...springs.bouncy, delay: 0.2 }}>★ +{Number(shared)}</motion.span>}
    {notice && <StatusNote tone="info">{notice}</StatusNote>}
    {first.error && <div className="hl-stack-sm"><StatusNote tone="error">{errorCopy(first.error.code) || errorCopy('internal')}</StatusNote><Button variant="secondary" className="hl-fit" onClick={first.reload}>Try again</Button></div>}
    {first.loading && !first.data && <JumpingDots label="Loading the feed…" />}
    {first.data && !posts.length && <p className={styles.empty}>No moments yet today. Be the first: snap a menu, a sign, or a chat and share the Korean in it.</p>}
    <div className={styles.feed}>
      {posts.map(post => <PostCard key={post.id} post={post} onGone={(id, message) => { setGone(current => [...current, id]); setNotice(message); }} />)}
    </div>
    {cursor && <Button variant="secondary" className="hl-fit" busy={loadingMore} busyLabel="Loading…" onClick={() => void loadMore()}>Show older moments</Button>}
    {moreError && <StatusNote tone="error">{moreError}</StatusNote>}
  </div>;
}
