import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './privacy.module.css';

export const metadata: Metadata = { title: 'Privacy notice · HanLog' };

export default function Privacy() {
  return <main className={styles.page}>
    <Link href="/" className="hl-back-link">Back to HanLog</Link>
    <header className="hl-page-heading"><p className="hl-eyebrow">Your voice, your choice</p><h1>Privacy notice</h1><p>For the HanLog concept demo. Updated 16 November 2026.</p></header>
    <section><h2>Who runs this</h2><p>HanLog is a concept demo run by the HanLog team.</p></section>
    <section><h2>What we collect</h2><p>We keep your nickname, chosen role, scores, feedback, points, challenges, and answers. A browser cookie connects you to your profile. A scrambled form of your network address helps us limit abuse and the number of scoring requests.</p><p>A solo practice recording is used to produce feedback and is not saved by HanLog. If you send a recording to another person, we store it so the people in that exchange can listen and rate it.</p></section>
    <section><h2>Where it goes</h2><p>In AI mode, OpenAI receives your solo recording for scoring and submitted text for content checks. Demo scoring is clearly labelled and makes no scoring request to OpenAI. Read <a href="https://openai.com/policies/privacy-policy/">OpenAI&apos;s privacy policy</a> for information about its handling of data.</p><p>The hosted demo uses Vercel for the application and Supabase for its database and private recording storage. A local copy uses a database and recording folder on the computer running HanLog. Other users cannot browse your private recordings; access is limited to the people allowed to review that exchange.</p></section>
    <section><h2>How long we keep it</h2><p>Recordings sent to other people are available for up to 14 days. After that, access stops and cleanup removes the stored files. The local demo launcher runs cleanup while it is open and on its next start. The hosted setup schedules cleanup daily.</p><p>Your nickname, scores, points, and written contributions stay until you delete your profile. Short-lived abuse counters can remain without your profile ID until the next daily cleanup. OpenAI handles data it receives under its own policies.</p></section>
    <section><h2>How to delete it</h2><p>Open Me in the app, choose Delete my data, and confirm. This removes your profile and its scores, points, challenges, answers, and stored recordings. If storage is temporarily unavailable, HanLog asks you to retry and keeps the profile so it can finish the deletion.</p><p>Clearing browser cookies does not delete stored data and can stop you from accessing your profile. Use Delete my data first.</p></section>
    <section><h2>Age</h2><p>You must be 14 or older to use this demo. Recording is available only after you agree to the notice shown in the app.</p></section>
  </main>;
}
