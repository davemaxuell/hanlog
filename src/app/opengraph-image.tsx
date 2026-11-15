import { ImageResponse } from 'next/og';

export const alt = 'HanLog · Speak Korean out in the world. Get a score that actually helps.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '70px 88px', background: '#D2F6FC', color: '#1E2436' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 36 }}><div style={{ display: 'flex', width: 24, height: 24, borderTop: '4px solid #B02D63', borderLeft: '4px solid #B02D63' }} />HanLog</div>
      <div style={{ display: 'flex', fontFamily: 'serif', fontSize: 72, fontWeight: 400, lineHeight: 1.16, maxWidth: 1000 }}>Speak Korean out in the world. Get a score that actually helps.</div>
    </div>,
    size,
  );
}
