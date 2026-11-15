'use client';

import { useState } from 'react';
import { Recorder } from '@/components/recorder/Recorder';
import type { RecorderDeps } from '@/components/recorder/useRecorder';
import { Button, StatusNote } from '@/components/ui';

export function DemoPreparation({ onClose, deps }: { onClose(): void; deps?: Partial<RecorderDeps> }) {
  const [confirmed, setConfirmed] = useState(false);

  return <section className="hl-stack demo-preparation" aria-labelledby="demo-preparation-title">
    <header className="hl-stack-sm">
      <p className="hl-eyebrow">Before you present</p>
      <h2 id="demo-preparation-title">Check your microphone</h2>
      <p>Record a few words, stop, and play them back. Confirm only if you can hear yourself clearly.</p>
      <p className="hl-caption">Your mic-check recording stays in this browser. It is not uploaded or sent to AI.</p>
    </header>
    {confirmed ? <div className="hl-stack-sm">
      <StatusNote tone="success">You confirmed that playback sounds clear. The test recording has been discarded.</StatusNote>
      <div className="hl-actions"><Button variant="secondary" onClick={() => setConfirmed(false)}>Check microphone again</Button></div>
    </div> : <>
      <Recorder modes={['audio']} submitLabel="Mic sounds good" onSubmit={() => setConfirmed(true)} deps={deps} />
      <p className="hl-caption">The microphone level shows input volume. It does not assess speech quality.</p>
    </>}
    <div className="hl-actions"><Button variant="secondary" onClick={onClose}>Close preparation</Button></div>
  </section>;
}
