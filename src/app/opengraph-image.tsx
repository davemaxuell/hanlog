import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const alt = 'HanLog · Your day, in Korean. Short speaking practice, useful feedback, and Korean-speaking peers.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
const paperlogy = await readFile(join(process.cwd(), 'src/assets/fonts/Paperlogy-Bold.ttf'));

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#1E2436', color: '#FFFEF9', fontFamily: 'Paperlogy', fontWeight: 700 }}>
      <div style={{ width: 740, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '58px 0 58px 64px' }}>
        <div style={{ display: 'flex', fontSize: 34, gap: 16, alignItems: 'center' }}><div style={{ display: 'flex', width: 18, height: 18, background: '#FC7CAC', borderRadius: 5 }} />HanLog · 한록</div>
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 88, lineHeight: 1.12, letterSpacing: -3 }}><span>Your day,</span><span style={{ color: '#FCFCC6' }}>in Korean.</span></div>
        <div style={{ display: 'flex', fontSize: 24, lineHeight: 1.5, maxWidth: 610, color: '#D2F6FC' }}>Short speaking practice. Useful feedback. A little more confidence, together.</div>
      </div>
      <div style={{ width: 460, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '58px 42px 58px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 350, height: 460, background: '#FFFEF9', border: '3px solid #1E2436', borderRadius: '175px 175px 22px 22px', padding: 26, boxShadow: '9px 9px 0 #FC7CAC' }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: 310, background: '#D2F6FC', border: '3px solid #1E2436', borderRadius: '145px 145px 0 0', overflow: 'hidden' }}>
            <div style={{ display: 'flex', flex: 1, borderBottom: '3px solid #1E2436' }}><div style={{ display: 'flex', width: '50%', alignItems: 'center', justifyContent: 'center', borderRight: '3px solid #1E2436', paddingTop: 32 }}><svg width="72" height="72" viewBox="0 0 100 100"><path d="m50 8 10 29 30 1-24 19 8 30-24-18-25 18 9-30-24-19 30-1Z" fill="#FC7CAC" stroke="#1E2436" strokeWidth="2" /></svg></div><div style={{ display: 'flex', width: '50%', alignItems: 'center', justifyContent: 'center', paddingTop: 32 }}><div style={{ width: 63, height: 63, borderRadius: '50%', border: '2px solid #1E2436', background: '#FCFCC6' }} /></div></div>
            <div style={{ display: 'flex', height: 106 }}><div style={{ display: 'flex', width: '50%', borderRight: '3px solid #1E2436' }} /><div style={{ display: 'flex', width: '50%', justifyContent: 'center', alignItems: 'center', fontSize: 42, color: '#B02D63' }}>한록</div></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#FCFCC6', color: '#1E2436', border: '2px solid #1E2436', borderRadius: 14, marginTop: 22, padding: '15px 10px', fontSize: 22 }}>Speak. Share. Grow.</div>
        </div>
      </div>
    </div>,
    { ...size, fonts: [{ name: 'Paperlogy', data: paperlogy, weight: 700, style: 'normal' }] },
  );
}
