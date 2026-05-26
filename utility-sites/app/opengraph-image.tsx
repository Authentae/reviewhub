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
        <div style={{ fontSize: 36, fontWeight: 600, color: '#60a5fa' }}>Mathstub</div>
        <div style={{ fontSize: 80, fontWeight: 700, lineHeight: 1.05 }}>
          Small tools for big money moments.
        </div>
        <div style={{ fontSize: 28, color: '#cbd5e1' }}>
          Free calculators. No signup. No email walls.
        </div>
      </div>
    ),
    size,
  );
}
