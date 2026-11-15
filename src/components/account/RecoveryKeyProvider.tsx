'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { RecoveryKeyNotice } from './RecoveryKeyNotice';

type PendingKey = { recoveryKey: string; continueTo?: string };
type RecoveryState = { pending: boolean; showRecoveryKey(key: string, continueTo?: string): void };
const Context = createContext<RecoveryState | null>(null);

// Root-layout memory survives client navigation. Credentials never enter browser storage.
export function RecoveryKeyProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingKey | null>(null);
  const dialog = useRef<HTMLDialogElement>(null); const router = useRouter();
  const showRecoveryKey = useCallback((recoveryKey: string, continueTo?: string) => setPending({ recoveryKey, continueTo }), []);
  useEffect(() => {
    if (!pending || !dialog.current) return;
    dialog.current.showModal(); dialog.current.querySelector('h2')?.focus();
  }, [pending]);
  function finish() {
    const destination = pending?.continueTo;
    dialog.current?.close(); setPending(null);
    if (destination) router.replace(destination);
  }
  return <Context.Provider value={{ pending: !!pending, showRecoveryKey }}>{children}
    {pending && <dialog ref={dialog} className="hl-dialog" aria-labelledby="key-heading" onCancel={event => event.preventDefault()}>
      <RecoveryKeyNotice key={pending.recoveryKey} recoveryKey={pending.recoveryKey} onDone={finish} doneLabel={pending.continueTo ? 'Continue to my profile' : 'I saved my key'} />
    </dialog>}
  </Context.Provider>;
}
export function useRecoveryKey() {
  const context = useContext(Context);
  if (!context) throw new Error('RecoveryKeyProvider is required');
  return context;
}
