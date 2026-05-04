// Original dashboard — faithful port of uploads/Dashboard.artifact.jsx,
// rendered inside a fixed-width artboard so it can sit on the canvas
// next to the redesigns.

const ORIG_RATING_ROWS = [
  { stars: 5, count: RH_STATS.r5, color: '#5ec79a' },
  { stars: 4, count: RH_STATS.r4, color: '#a3c97a' },
  { stars: 3, count: RH_STATS.r3, color: '#e2b65a' },
  { stars: 2, count: RH_STATS.r1 + RH_STATS.r2, color: '#dd8b56' },
  { stars: 1, count: RH_STATS.r1, color: '#c2566c' },
];

function OriginalDashboard() {
  const [platform, setPlatform] = React.useState('');
  const [activeRating, setActiveRating] = React.useState('');
  const [search, setSearch] = React.useState('');
  const respondedPct = Math.round((RH_STATS.responded / RH_STATS.total) * 100);

  return (
    <div style={{
      background: RH.paper, color: RH.ink,
      fontFamily: SANS, minHeight: '100%',
    }}>
      {/* Navbar */}
      <header style={{
        height: 60, borderBottom: `1px solid ${RH.rule}`,
        background: 'rgba(251,248,241,0.85)', backdropFilter: 'blur(8px)',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto', padding: '0 24px',
          height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6, background: RH.teal,
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 13,
              }}>R</div>
              <span style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>ReviewHub</span>
            </div>
            <nav style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 13, color: RH.ink2 }}>
              <a href="#" style={{ color: RH.ink, fontWeight: 600, textDecoration: 'none' }}>Inbox</a>
              <a href="#" style={{ color: RH.ink2, textDecoration: 'none' }}>Analytics</a>
              <a href="#" style={{ color: RH.ink2, textDecoration: 'none' }}>Requests</a>
              <a href="#" style={{ color: RH.ink2, textDecoration: 'none' }}>Settings</a>
            </nav>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative', width: 24, height: 24 }}>
              <BellIcon />
              <span style={{
                position: 'absolute', top: -2, right: -4, width: 14, height: 14, borderRadius: '50%',
                background: RH.rose, color: '#fff', fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>3</span>
            </div>
            <Avatar name="E" size={30} />
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        {/* Page head */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16, marginBottom: 28,
        }}>
          <div>
            <Eyebrow>Inbox</Eyebrow>
            <h1 style={{ fontFamily: SERIF, fontSize: 38, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 4px' }}>
              The Corner Bistro
            </h1>
            <p style={{ fontSize: 13, color: RH.ink2, margin: 0 }}>
              Reply to reviews across every platform from one inbox.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={origBtn()}>☑ Select</button>
            <button style={origBtn(true)}>↓ Export CSV</button>
          </div>
        </div>

        {/* Negative-review alert */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderRadius: 12, fontSize: 13, marginBottom: 24,
          background: RH.roseT, border: `1px solid ${RH.roseM}`,
        }}>
          <span>⚠ You have <b>3 unresponded negative reviews</b>. Replying within 24 hours triples conversion.</span>
          <button style={{
            fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8,
            color: RH.rose, border: `1px solid ${RH.roseM}`, background: 'transparent',
          }}>Show them</button>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          <OrigStat label="Total reviews" value={RH_STATS.total.toLocaleString()} />
          <OrigStat label="Average rating" value={`${RH_STATS.avg_rating} ★`} />
          <OrigStat label="Positive" value={RH_STATS.positive} accent={RH.sage} />
          <OrigStat label="Response rate" value={`${respondedPct}%`} accent={RH.teal} />
        </div>

        {/* Platform chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
          {Object.entries(RH_PLATFORMS).map(([p, m]) => {
            const active = platform === p;
            return (
              <button key={p} onClick={() => setPlatform(active ? '' : p)} style={{
                fontSize: 13, padding: '6px 12px', borderRadius: 999,
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: active ? RH.teal : RH.white,
                color: active ? '#fff' : RH.ink,
                border: `1px solid ${active ? RH.teal : RH.rule}`,
                cursor: 'pointer',
              }}>
                <PlatformGlyph p={p} size={12} />
                <span>{m.label}</span>
                <span style={{
                  fontFamily: MONO, fontSize: 11,
                  padding: '1px 6px', borderRadius: 999,
                  background: active ? 'rgba(255,255,255,0.18)' : RH.paper,
                  color: active ? '#fff' : RH.ink3,
                }}>{m.count}</span>
              </button>
            );
          })}
        </div>

        {/* Rating distribution */}
        <section style={{
          background: RH.white, border: `1px solid ${RH.rule}`,
          borderRadius: 12, padding: 20, marginBottom: 28,
        }}>
          <Eyebrow>Rating breakdown</Eyebrow>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ORIG_RATING_ROWS.map(({ stars, count, color }) => {
              const pct = Math.round((count / RH_STATS.total) * 100);
              return (
                <div key={stars} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: RH.ink3, width: 30, textAlign: 'right' }}>{stars} ★</span>
                  <div style={{ flex: 1, height: 8, background: RH.paper2, borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: 12, color: RH.ink3, width: 36, textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Search + filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: RH.ink3 }}>🔍</span>
            <input
              type="search"
              placeholder="Search reviews… (press / to focus)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px 10px 36px', fontSize: 13,
                background: RH.white, border: `1px solid ${RH.rule}`, borderRadius: 8,
                color: RH.ink, outline: 'none', fontFamily: SANS, boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <OrigSelect>All platforms</OrigSelect>
            <OrigSelect>All sentiments</OrigSelect>
            <OrigSelect>All reviews</OrigSelect>
            <button style={origBtn()}>★ Pinned only</button>
            <button style={origBtn()}>🚩 Flagged only</button>
          </div>
        </div>

        <p style={{ fontSize: 13, color: RH.ink2, marginBottom: 12 }}>
          Showing {RH_REVIEWS.length} of {RH_STATS.total} reviews
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {RH_REVIEWS.slice(0, 4).map(r => <OrigCard key={r.id} review={r} />)}
        </div>
      </main>
    </div>
  );
}

function OrigStat({ label, value, accent }) {
  return (
    <div style={{ background: RH.white, border: `1px solid ${RH.rule}`, borderRadius: 12, padding: 16 }}>
      <Eyebrow>{label}</Eyebrow>
      <div style={{
        fontFamily: SERIF, fontWeight: 600, fontSize: 30,
        color: accent || RH.ink, marginTop: 8, lineHeight: 1.1,
      }}>{value}</div>
    </div>
  );
}

function OrigSelect({ children }) {
  return (
    <button style={{
      fontSize: 13, padding: '6px 12px', borderRadius: 8,
      background: RH.white, border: `1px solid ${RH.rule}`, color: RH.ink, cursor: 'pointer',
    }}>{children} ▾</button>
  );
}

function origBtn(filled) {
  return {
    fontSize: 13, padding: '8px 12px', borderRadius: 8, fontWeight: 500,
    background: filled ? RH.white : RH.white,
    color: RH.ink, border: `1px solid ${RH.rule}`, cursor: 'pointer',
  };
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={RH.ink2} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function OrigCard({ review }) {
  const sentColor = review.sentiment === 'positive' ? RH.sage : review.sentiment === 'negative' ? RH.rose : RH.ink3;
  const leftBorder = review.flagged ? `4px solid ${RH.rose}` : review.pinned ? `4px solid #d4a843` : `1px solid ${RH.rule}`;

  return (
    <article style={{
      background: RH.white, border: `1px solid ${RH.rule}`,
      borderLeft: leftBorder, borderRadius: 12, padding: 18,
    }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <Avatar name={review.name} size={36} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{review.name}</span>
              {review.pinned && <span style={origTag(RH.amberM, RH.amber)}>★ Pinned</span>}
              {review.flagged && <span style={origTag(RH.roseM, RH.roseD)}>🚩 Flagged</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: RH.ink3, marginTop: 4 }}>
              <PlatformGlyph p={review.platform} size={11} />
              <span>{RH_PLATFORMS[review.platform]?.label}</span>
              <span>·</span>
              <span>{review.posted}</span>
              <span>·</span>
              <Stars n={review.rating} size={11} on={RH.ink} />
            </div>
          </div>
        </div>
        <span style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          padding: '4px 8px', borderRadius: 4,
          background: sentColor + '20', color: sentColor,
        }}>{review.sentiment}</span>
      </header>

      <p style={{ fontSize: 13.5, lineHeight: 1.55, color: RH.ink, margin: '0 0 14px' }}>{review.text}</p>

      {review.responded ? (
        <div style={{
          background: RH.tealT, borderLeft: `3px solid ${RH.teal}`,
          borderRadius: 6, padding: '10px 12px',
        }}>
          <Eyebrow color={RH.teal}>Your reply</Eyebrow>
          <p style={{ fontSize: 13, lineHeight: 1.55, color: RH.ink, margin: '6px 0 0' }}>{review.reply}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={{
            fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8,
            background: RH.teal, color: '#fff', border: 'none', cursor: 'pointer',
          }}>✨ Draft a reply</button>
          <button style={origBtn()}>Mark as resolved</button>
          <button style={{ marginLeft: 'auto', fontSize: 13, padding: '8px 12px', borderRadius: 8, color: RH.ink3, background: 'transparent', border: 'none', cursor: 'pointer' }}>⋯</button>
        </div>
      )}
    </article>
  );
}

function origTag(bg, fg) {
  return {
    fontFamily: MONO, fontSize: 9, fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    padding: '3px 6px', borderRadius: 4, background: bg, color: fg,
  };
}

window.OriginalDashboard = OriginalDashboard;
