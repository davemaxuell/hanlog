'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSession } from '@/lib/ui/session-context';
import { SHARE_CODE_ALPHABET } from '@/lib/contracts';
import { Button, Ko } from '@/components/ui';
import { ChallengeSection, FeedbackInbox } from '@/components/challenge/CommunitySections';
import styles from '@/components/challenge/community.module.css';

export default function Challenges() {
  const { user } = useSession(); const korean = user.role === 'korean'; const router = useRouter();
  const [search, setSearch] = useState(''); const [query, setQuery] = useState('');
  const [code, setCode] = useState(''); const [codeError, setCodeError] = useState('');
  const firstScope = korean ? 'to-rate' : 'open'; const secondScope = korean ? 'mine' : 'answered';
  return <div className="hl-stack">
    <header className={styles.hero}>
      <div className={styles.heroCopy}><p className="hl-eyebrow">Korean, between people</p><h1>Small words.<br />Real connections.</h1><p>{korean ? 'Share the expressions you actually use. Give someone the confidence to join in.' : 'Try an everyday expression. Share your voice and learn from a Korean-speaking peer.'}</p>
        {korean ? <Link className="hl-button hl-button--primary hl-fit" href="/app/challenges/new">Post a challenge</Link> : <a className="hl-button hl-button--primary hl-fit" href="#challenges-first">Find a challenge</a>}
      </div>
      <aside className={styles.invitation}><span className={styles.voiceMark} aria-hidden="true">“</span><Ko as="p" className={styles.invitationKorean}>같이 이야기해요.</Ko><p>Let&apos;s talk, together.</p><span className={styles.note}>A short voice or video answer is enough.</span></aside>
    </header>
    <div className={styles.tools}>
      <form className={styles.search} role="search" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); }}>
        <label htmlFor="community-search">Find an expression</label><div className={styles.inputRow}><input id="community-search" type="search" maxLength={80} placeholder="Korean, meaning, or a friend's name" value={search} onChange={event => setSearch(event.target.value)} /><Button type="submit" variant="secondary">Search</Button></div>
        {query && <button type="button" className={styles.clear} onClick={() => { setSearch(''); setQuery(''); }}>Clear “{query}”</button>}
      </form>
      <form className={styles.code} onSubmit={event => {
        event.preventDefault(); const value = code.trim().toUpperCase();
        if (value.length !== 6 || ![...value].every(letter => SHARE_CODE_ALPHABET.includes(letter))) { setCodeError('Enter the six-character challenge code.'); return; }
        setCodeError(''); router.push(`/c/${value}`);
      }}><label htmlFor="challenge-code">Have an invitation?</label><div className={styles.inputRow}><input id="challenge-code" value={code} onChange={event => { setCode(event.target.value.toUpperCase()); setCodeError(''); }} autoCapitalize="characters" autoComplete="off" maxLength={6} placeholder="ABC234" aria-invalid={!!codeError} aria-describedby={codeError ? 'code-error' : undefined} /><Button type="submit" variant="secondary">Open code</Button></div>{codeError && <p id="code-error" role="alert" className={styles.error}>{codeError}</p>}</form>
    </div>
    <ChallengeSection key={`${user.id}:${firstScope}:${query}`} scope={firstScope} query={query} id="challenges-first" title={korean ? 'To rate' : 'Open challenges'} description={korean ? 'A little encouragement goes a long way.' : 'Pick something you could say in your own day.'} empty={query ? 'No expressions match your search. Try a shorter phrase.' : korean ? 'Nothing to rate right now.' : 'No open challenges yet. Check back soon.'} />
    <FeedbackInbox key={`inbox:${user.id}`} />
    <ChallengeSection key={`${user.id}:${secondScope}:${query}`} scope={secondScope} query={query} id="challenges-second" title={korean ? 'My challenges' : 'My answers'} description="Pick up a conversation where you left it." empty={query ? 'Nothing in your log matches this search.' : korean ? 'You have not posted a challenge yet.' : 'You have not answered a challenge yet.'} />
    <p className={styles.communityNote}>Be kind, keep personal details private, and ask before recording someone else. Korean-speaking peers choose their own role; they are not verified tutors. <Link href="/privacy">How recordings are shared</Link></p>
  </div>;
}
