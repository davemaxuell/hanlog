'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Camera } from '@phosphor-icons/react';
import { ApiClientError } from '@/lib/api-client';
import { LIMITS, containsHangul, countChars, hasLink } from '@/lib/contracts';
import { socialApi } from '@/lib/social-client';
import { errorCopy } from '@/lib/ui/error-copy';
import { ImagePrepError, prepareImage, type PreparedImage } from '@/lib/ui/prepare-image';
import { useSession } from '@/lib/ui/session-context';
import { Button, Field, StatusNote, TextArea } from '@/components/ui';
import styles from '@/components/social/social.module.css';
import { motion } from 'motion/react';
import { springs } from '@/components/motion/kit';

const photoError = (reason: ImagePrepError['reason']) => reason === 'too_small'
  ? 'That photo is too small. Choose one at least 120 pixels on each side.'
  : 'That file did not open as a photo. Choose a photo from your camera or gallery.';
function shareError(cause: unknown): string {
  const code = cause instanceof ApiClientError ? cause.code : 'internal';
  if (code === 'media_invalid') return "That photo didn't upload correctly. Choose it again.";
  if (code === 'audio_too_large') return 'That photo is too large. Choose a smaller one.';
  if (code === 'daily_limit') return 'You have shared six moments today. Come back tomorrow to share more.';
  return errorCopy(code) || errorCopy('internal');
}

export default function ShareMoment() {
  const router = useRouter();
  const { refreshBalance } = useSession();
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [korean, setKorean] = useState(''); const [meaning, setMeaning] = useState(''); const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ photo?: string; korean?: string; meaning?: string; note?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setPreparing(true); setErrors(current => ({ ...current, photo: undefined }));
    try { setImage(await prepareImage(file)); }
    catch (cause) { setErrors(current => ({ ...current, photo: photoError(cause instanceof ImagePrepError ? cause.reason : 'undecodable') })); }
    finally { setPreparing(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!image) next.photo = 'Choose a photo to share.';
    if (!containsHangul(korean) || countChars(korean.trim()) > LIMITS.challengeKorean.max) next.korean = 'Write the expression in Korean (한글), up to 60 characters.';
    if (!meaning.trim()) next.meaning = 'Say what it means in English.';
    if ([korean, meaning, note].some(hasLink)) next.form = 'Links are not allowed in posts.';
    setErrors(next);
    if (Object.keys(next).length || !image) return;
    setBusy(true);
    try {
      const created = await socialApi.sharePost({ image: image.blob, korean: korean.trim(), meaningEn: meaning.trim(), note: note.trim() });
      void refreshBalance();
      router.push(`/app/feed?shared=${created.pointsAwarded}`);
    } catch (cause) { setErrors({ form: shareError(cause) }); setBusy(false); }
  };

  return <form className={styles.share} onSubmit={event => void submit(event)} noValidate>
    <Link href="/app/feed" className="hl-back-link"><ArrowLeft size={18} aria-hidden="true" /> Korean moments</Link>
    <header className={styles.intro}>
      <h1>Share a Korean moment</h1>
      <p>A photo of where you met or used Korean today, with the expression it shows.</p>
    </header>
    {image
      ? <div className="hl-stack-sm">
        {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the re-encoded photo. */}
        <motion.div key={image.url} className={styles.preview} initial={{ scale: 0.88, rotate: -3, y: 24 }} animate={{ scale: 1, rotate: 0, y: 0 }} transition={springs.bouncy}><img src={image.url} width={image.width} height={image.height} alt="Preview of the photo you chose" /></motion.div>
        <label className={`hl-button hl-button--secondary hl-fit ${styles.repick}`}>Choose a different photo
          <input type="file" accept="image/*" onChange={event => void choose(event.target.files?.[0])} />
        </label>
      </div>
      : <label className={styles.picker}>
        <Camera size={40} weight="duotone" aria-hidden="true" />
        <strong>{preparing ? 'Preparing your photo…' : 'Choose a photo'}</strong>
        <span>Take one now or pick one from your gallery.</span>
        <input type="file" accept="image/*" aria-describedby="photo-error" onChange={event => void choose(event.target.files?.[0])} />
      </label>}
    {errors.photo && <p id="photo-error" className="hl-field-error" role="alert">{errors.photo}</p>}
    <Field label="Korean expression" lang="ko" value={korean} maxLength={LIMITS.challengeKorean.max} onChange={event => setKorean(event.target.value)} placeholder="아이스 아메리카노 한 잔 주세요" error={errors.korean} counter={{ value: countChars(korean), max: LIMITS.challengeKorean.max }} required />
    <Field label="What it means" value={meaning} maxLength={LIMITS.meaningEn.max} onChange={event => setMeaning(event.target.value)} placeholder="One iced Americano, please" error={errors.meaning} required />
    <TextArea label="Where or when (optional)" value={note} maxLength={LIMITS.postNote.max} onChange={event => setNote(event.target.value)} placeholder="Ordering at the café by the main gate" counter={{ value: countChars(note), max: LIMITS.postNote.max }} />
    <p className={styles.notice}>Everyone signed in to HanLog can see your photo, nickname and words for 14 days. Location and camera details are removed, and photos are checked automatically before they appear. Avoid faces of people who did not agree to be shared.</p>
    {errors.form && <StatusNote tone="error">{errors.form}</StatusNote>}
    <Button type="submit" className="hl-fit" busy={busy} busyLabel="Sharing…" disabled={preparing}>Share moment</Button>
  </form>;
}
