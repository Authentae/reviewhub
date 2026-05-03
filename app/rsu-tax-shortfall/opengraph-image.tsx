import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0f172a',
          color: 'white',
          padding: '80px',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 600, color: '#60a5fa' }}>Utility Tools</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05 }}>
            RSU Tax Shortfall Calculator
          </div>
          <div style={{ fontSize: 32, color: '#cbd5e1' }}>
            Estimate the gap between 22% withholding and what you actually owe.
          </div>
        </div>
        <div style={{ fontSize: 24, color: '#94a3b8' }}>2025–2026 tax years · No signup</div>
      </div>
    ),
    size,
  );
}
