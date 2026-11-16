'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { press } from 'motion';
import { AnimatePresence, motion } from 'motion/react';
import { Heart, Flag, Trash } from '@phosphor-icons/react';
import { ApiClientError } from '@/lib/api-client';
import type { ReportReason } from '@/lib/community-contracts';
import { socialApi } from '@/lib/social-client';
import type { Post } from '@/lib/social-contracts';
import { errorCopy } from '@/lib/ui/error-copy';
import { Ko } from '@/components/ui';
import { useMotionPreference } from '@/components/motion/MotionPreference';
import { riseOnView, springs } from '@/components/motion/kit';
import { Avatar, roleLabel, timeAgo } from './SocialParts';
import styles from './social.module.css';

const reasons: [ReportReason, string][] = [['inappropriate', 'Inappropriate'], ['harassment', 'Harassment'], ['privacy', 'Shows private information'], ['spam', 'Spam'], ['other', 'Something else']];

/** One shared Korean moment: the photo, the expression it shows, likes (button or double tap), and a way to report or remove it. */
export function PostCard({ post, onGone }: { post: Post; onGone(id: string, message: string): void }) {
  const titleId = useId();
  const reduced = useMotionPreference()?.reduced ?? true;
  const card = useRef<HTMLElement>(null);
  const photo = useRef<HTMLDivElement>(null);
  const [likes, setLikes] = useState({ count: post.likes, mine: post.likedByMe });
  const current = useRef(likes);
  const [popped, setPopped] = useState(false);
  const [bursts, setBursts] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const fail = (cause: unknown) => setError(errorCopy(cause instanceof ApiClientError ? cause.code : 'internal') || errorCopy('internal'));

  const setLiked = async (next: boolean) => {
    const before = current.current;
    if (before.mine === next) return;
    const optimistic = { count: before.count + (next ? 1 : -1), mine: next };
    current.current = optimistic; setLikes(optimistic); setPopped(next);
    try {
      const result = await socialApi.setLike(post.id, next);
      current.current = { count: result.likes, mine: result.likedByMe }; setLikes(current.current);
    } catch (cause) { current.current = before; setLikes(before); fail(cause); }
  };
  const latestSetLiked = useRef(setLiked);
  useEffect(() => { latestSetLiked.current = setLiked; });

  // Double tap the photo to like it (motion.dev "Double tap to like"). It only ever adds a like, like most photo apps.
  useEffect(() => {
    const target = photo.current;
    if (!target) return;
    return press(target, () => ({
      onActive: () => {
        const id = Date.now();
        setBursts(list => [...list, id]);
        window.setTimeout(() => setBursts(list => list.filter(item => item !== id)), 800);
        void latestSetLiked.current(true);
      },
    }), { count: 2 });
  }, []);
  useEffect(() => card.current ? riseOnView([card.current], { y: 32 }) : undefined, [reduced]);

  const report = async (reason: ReportReason) => {
    setBusy(true);
    try { await socialApi.reportPost(post.id, reason); onGone(post.id, "Thanks for reporting. You won't see that post again."); }
    catch (cause) { fail(cause); setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await socialApi.deletePost(post.id); onGone(post.id, 'Your post was deleted.'); }
    catch (cause) { fail(cause); setBusy(false); }
  };

  return <article ref={card} className={styles.post} aria-labelledby={titleId}>
    <header className={styles.postHead}>
      <Avatar name={post.author.nickname} />
      <span className={styles.who}><span className={styles.name}>{post.author.nickname}</span><span className={styles.meta}>{roleLabel(post.author.role)} · <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time></span></span>
    </header>
    <div ref={photo} className={styles.photoWrap}>
      {/* eslint-disable-next-line @next/next/no-img-element -- private, session-only images cannot use the image optimizer. */}
      <img className={styles.photo} src={post.imageUrl} width={post.width} height={post.height} alt={`Photo shared with the expression meaning “${post.meaningEn}”`} loading="lazy" decoding="async" draggable={false} />
      <AnimatePresence>
        {bursts.map(id => <motion.span key={id} className={styles.burst} aria-hidden="true"
          initial={{ scale: 0.2, rotate: -12, opacity: 0 }} animate={{ scale: [0.2, 1.25, 1], rotate: [-12, 6, 0], opacity: 1 }} exit={{ scale: 1.4, opacity: 0, y: -24 }} transition={springs.bouncy}>
          <Heart size={110} weight="fill" />
        </motion.span>)}
      </AnimatePresence>
    </div>
    <div className={styles.postBody}>
      <Ko as="h2" className={styles.postKorean}><span id={titleId}>{post.korean}</span></Ko>
      <p className={styles.postMeaning}>{post.meaningEn}</p>
      {post.note && <p className={styles.postNote}>{post.note}</p>}
    </div>
    <div className={styles.postActions}>
      <button type="button" className={styles.like} aria-pressed={likes.mine} onClick={() => void setLiked(!likes.mine)} aria-label={`Like. ${likes.count} ${likes.count === 1 ? 'like' : 'likes'}`}>
        <motion.span key={likes.mine ? 'liked' : 'not-liked'} className={styles.likeIcon} initial={popped && likes.mine ? { scale: 0.3, rotate: -20 } : false} animate={{ scale: 1, rotate: 0 }} transition={springs.bouncy}>
          <Heart size={22} weight={likes.mine ? 'fill' : 'regular'} aria-hidden="true" />
        </motion.span>
        <span lang="ko">좋아요</span><b>{likes.count}</b>
      </button>
      {post.mine
        ? confirmDelete
          ? <span className={styles.confirm}><button type="button" className={styles.danger} disabled={busy} onClick={() => void remove()}>Delete for good</button><button type="button" className={styles.quiet} onClick={() => setConfirmDelete(false)}>Keep it</button></span>
          : <button type="button" className={styles.quiet} onClick={() => setConfirmDelete(true)}><Trash size={18} aria-hidden="true" />Delete</button>
        : <details className={styles.reportMenu}>
          <summary><Flag size={18} aria-hidden="true" />Report</summary>
          <div className={styles.reportList} role="group" aria-label="Why are you reporting this post?">
            {reasons.map(([reason, label]) => <button key={reason} type="button" disabled={busy} onClick={() => void report(reason)}>{label}</button>)}
          </div>
        </details>}
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </article>;
}
