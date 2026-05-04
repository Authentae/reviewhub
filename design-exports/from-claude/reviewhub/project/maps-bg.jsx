// maps-bg.jsx — Simplified Google Maps review page, used as the background
// the ReviewHub popup floats over. Provides context for the product moment.

function MapsBackground({ platform, review }) {
  const p = PLATFORMS[platform];

  // Per-platform tinted hero header so the background changes with the switcher
  return (
    <div style={{
      width: '100%', height: '100%', background: '#fff',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#202124', overflow: 'hidden',
    }}>
      {/* Platform-specific sub-nav */}
      <div style={{
        height: 56, borderBottom: '1px solid #ebeef1',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: p.color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 700,
        }}>{p.name[0]}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#202124' }}>Ember Coffee House</div>
          <div style={{ fontSize: 11.5, color: '#5f6368' }}>
            {review.stars >= 4 ? '4.7' : '4.2'} ★ · 842 reviews · Coffee shop · 412 Sukhumvit Rd
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Overview', 'Reviews', 'Photos', 'About'].map((t, i) => (
            <div key={t} style={{
              padding: '6px 12px', fontSize: 12, fontWeight: 500,
              color: i === 1 ? p.color : '#5f6368',
              borderBottom: i === 1 ? `2px solid ${p.color}` : '2px solid transparent',
            }}>{t}</div>
          ))}
        </div>
      </div>

      {/* Content layout: left = review list, right = map/info */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{
          flex: '0 0 58%', borderRight: '1px solid #ebeef1',
          padding: '18px 22px', overflow: 'hidden',
        }}>
          {/* Sort + filter row */}
          <div style={{
            display: 'flex', gap: 8, marginBottom: 16,
          }}>
            {['Most relevant', 'Newest', '★ 5', '★ 4', '★ 1-3'].map((f, i) => (
              <div key={f} style={{
                padding: '5px 11px', borderRadius: 999,
                border: '1px solid #dadce0', fontSize: 11.5, fontWeight: 500,
                color: i === 0 ? '#fff' : '#3c4043',
                background: i === 0 ? '#3c4043' : '#fff',
              }}>{f}</div>
            ))}
          </div>

          {/* The actual review — matches what's in the popup */}
          <div style={{ marginBottom: 18, padding: '14px 0', borderBottom: '1px solid #ebeef1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: review.avatar, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 600,
              }}>{review.author.split(' ').map(s => s[0]).join('')}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#202124' }}>{review.author}</div>
                <div style={{ fontSize: 11, color: '#70757a' }}>Local Guide · 12 reviews</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="#5f6368">
                <circle cx="3" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="13" cy="8" r="1.5" />
              </svg>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Stars count={review.stars} size={13} />
              <span style={{ fontSize: 11.5, color: '#5f6368' }}>{review.date}</span>
            </div>
            <p style={{
              margin: 0, fontSize: 13, lineHeight: 1.55, color: '#202124',
            }}>{review.text}</p>

            {/* Reply button — THIS is what triggers the extension */}
            <div style={{ marginTop: 12, display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{
                fontSize: 12, fontWeight: 500, color: p.color,
                padding: '6px 0',
              }}>Reply</div>
              <div style={{ fontSize: 12, color: '#5f6368' }}>Helpful</div>
              <div style={{ fontSize: 12, color: '#5f6368' }}>Share</div>
            </div>
          </div>

          {/* Ghost reviews below */}
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              padding: '14px 0', borderBottom: '1px solid #ebeef1', opacity: 0.55,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e8eaed' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 9, width: 110, borderRadius: 3, background: '#e8eaed', marginBottom: 5 }} />
                  <div style={{ height: 7, width: 70, borderRadius: 3, background: '#f1f3f4' }} />
                </div>
              </div>
              <div style={{ height: 8, width: '92%', borderRadius: 3, background: '#f1f3f4', marginBottom: 5 }} />
              <div style={{ height: 8, width: '78%', borderRadius: 3, background: '#f1f3f4', marginBottom: 5 }} />
              <div style={{ height: 8, width: '45%', borderRadius: 3, background: '#f1f3f4' }} />
            </div>
          ))}
        </div>

        {/* Right: faux map */}
        <div style={{
          flex: 1, position: 'relative',
          background: 'linear-gradient(135deg, #e8f0e8 0%, #eef3ee 50%, #e4ebe2 100%)',
          overflow: 'hidden',
        }}>
          {/* Roads */}
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }} preserveAspectRatio="none">
            <path d="M-20 120 Q 200 100, 400 180 T 900 220" stroke="#fff" strokeWidth="14" fill="none" />
            <path d="M-20 120 Q 200 100, 400 180 T 900 220" stroke="#fbbc04" strokeWidth="3" fill="none" opacity="0.7" />
            <path d="M150 -20 Q 180 200, 260 400 T 380 900" stroke="#fff" strokeWidth="11" fill="none" />
            <path d="M450 -20 Q 470 300, 520 600" stroke="#fff" strokeWidth="9" fill="none" />
            <path d="M-20 350 Q 300 320, 600 380 T 900 420" stroke="#fff" strokeWidth="8" fill="none" />
            <rect x="50" y="250" width="80" height="60" fill="#dde5dd" opacity="0.6" rx="2" />
            <rect x="200" y="280" width="70" height="70" fill="#dde5dd" opacity="0.6" rx="2" />
            <rect x="300" y="450" width="90" height="50" fill="#cadac3" opacity="0.5" rx="2" />
            <rect x="480" y="480" width="100" height="80" fill="#dde5dd" opacity="0.6" rx="2" />
            <circle cx="180" cy="520" r="35" fill="#c3d4bb" opacity="0.6" />
          </svg>

          {/* Pin */}
          <div style={{
            position: 'absolute', top: '42%', left: '44%',
            transform: 'translate(-50%, -100%)',
          }}>
            <svg width="30" height="40" viewBox="0 0 30 40">
              <path d="M15 2 C 7 2, 2 8, 2 15 C 2 24, 15 38, 15 38 S 28 24, 28 15 C 28 8, 23 2, 15 2 Z"
                    fill={p.color} stroke="#fff" strokeWidth="1.5" />
              <circle cx="15" cy="14" r="4" fill="#fff" />
            </svg>
          </div>

          {/* Mini info card on map */}
          <div style={{
            position: 'absolute', top: 16, left: 16,
            background: '#fff', borderRadius: 8, padding: '10px 12px',
            boxShadow: '0 2px 8px rgba(0,0,0,.12)',
            fontSize: 11, color: '#3c4043',
          }}>
            <div style={{ fontWeight: 600, fontSize: 12 }}>Ember Coffee House</div>
            <div style={{ color: '#5f6368', marginTop: 2 }}>Open · Closes 6 PM</div>
          </div>
        </div>
      </div>

      {/* Extension icon in top-right, indicating ReviewHub is active */}
    </div>
  );
}

Object.assign(window, { MapsBackground });
