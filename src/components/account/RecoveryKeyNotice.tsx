'use client';
import { useEffect, useRef, useState } from 'react';
import { Copy, DownloadSimple, Key } from '@phosphor-icons/react';
import { Button, StatusNote } from '@/components/ui';
import styles from './account.module.css';

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function RecoveryKeyNotice({ recoveryKey, onDone, doneLabel = 'I saved my key' }: { recoveryKey: string; onDone(): void; doneLabel?: string }) {
  const [copied, setCopied] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    if (saved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saved]);
  async function copy() {
    try { await navigator.clipboard.writeText(recoveryKey); setCopied(true); setError(''); }
    catch { setError('Copy is unavailable here. Select the key above, or download it.'); }
  }
  return <section className={styles.keyNotice} aria-labelledby="key-heading">
    <Key size={30} weight="duotone" aria-hidden="true" />
    <h2 id="key-heading" ref={heading} tabIndex={-1}>Keep this key somewhere safe.</h2>
    <p>This is the only time we can show it. It opens your HanLog profile on another device. Anyone with it can access your profile.</p>
    <code className={styles.recoveryKey}>{recoveryKey}</code>
    <div className="hl-actions"><Button variant="secondary" onClick={() => void copy()}><Copy size={18} aria-hidden="true" />{copied ? 'Copied' : 'Copy key'}</Button><Button variant="secondary" onClick={() => downloadBlob(new Blob([`HanLog recovery key\n\n${recoveryKey}\n\nKeep this private. Restore at ${window.location.origin}/app/onboarding?mode=restore\nA restored profile receives a new key; the old one stops working.\n`], { type: 'text/plain;charset=utf-8' }), 'hanlog-recovery-key.txt')}><DownloadSimple size={18} aria-hidden="true" />Download key</Button></div>
    {error && <StatusNote tone="error">{error}</StatusNote>}
    <label className="hl-consent"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)} /><span>I saved this key in a safe place.</span></label>
    <Button disabled={!saved} onClick={onDone}>{doneLabel}</Button>
  </section>;
}
