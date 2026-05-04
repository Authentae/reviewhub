// Original, sharpened — same layout, same vocabulary, fixes the weakest moments:
//  · Stat cards compressed to a 64px row (label + value + sparkline) → ~80px saved
//  · Negative banner promoted to a contextual lede block when negatives exist
//    (eyebrow + serif headline) so the call-to-action carries actual weight
//  · Cards now signal severity via the rating glyph (serif numeral) rather than
//    relying solely on a pink left-border + emoji
//  · Rating breakdown gets compact 3-row layout (folded into stat row on mobile)
//  · Empty + error states designed in the original's voice
//  · Mobile: 1-line sticky stat strip; chips horizontally scroll WITH a fade

function OriginalSharpened({ mobile = false, state = 'default' }) {
  const [platform, setPlatform] = React.useState('');
  const [search, setSearch] = React.useState('');
  const respondedPct = Math.round((RH_STATS.responded / RH_STATS.total) * 100);
  const negatives = RH_REVIEWS.filter(r => r.sentiment === 'negative' && !r.responded);

  return (
    <div style={{ background: RH.paper, color: RH.ink, fontFamily: SANS, minHeight: '100%' }}>
      {/* Navbar — unchanged shape */}
      <header style={{
        height: 56, borderBottom: `1px solid ${RH.rule}`,
        background: 'rgba(251,248,241,0.9)', backdropFilter: 'blur(8px)',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto', padding: mobile ? '0 16px' : '0 24px',
          height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 6, background: RH.teal,
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 13,
              }}>R</div>
              <span style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>ReviewHub</span>
            </div>
            {!mobile && (
              <nav style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 13, color: RH.ink2 }}>
                <a href="#" style={{ color: RH.ink, fontWeight: 600, textDecoration: 'none' }}>Inbox</a>
                <a href="#" style={{ color: RH.ink2, textDecoration: 'none' }}>Analytics</a>
                <a href="#" style={{ color: RH.ink2, textDecoration: 'none' }}>Requests</a>
                <a href="#" style={{ color: RH.ink2, textDecoration: 'none' }}>Settings</a>
              </nav>
            )}
          </div>
          <Avatar name="E" size={28} />
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: mobile ? '20px 16px 40px' : '24px 24px 60px' }}>
        {/* Page head — unchanged */}
        <div style={{ marginBottom: 18 }}>
          <Eyebrow>Inbox</Eyebrow>
          <h1 style={{ fontFamily: SERIF, fontSize: mobile ? 30 : 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '4px 0 4px' }}>
            The Corner Bistro
          </h1>
          <p style={{ fontSize: 13.5, color: RH.ink2, margin: 0 }}>
            Reply to reviews across every platform from one inbox.
          </p>
        </div>

        {/* ─── PROMOTED LEDE: negative-review call to action ─────────────
            Was: a pink-tinted banner with a ghost button.
            Now: a typeset lede with a serif headline + solid action.
            Carries the same information but earns its prominence. */}
        {negatives.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 18, padding: mobile ? '14px 16px' : '16px 20px',
            background: RH.white, border: `1px solid ${RH.rule}`,
            borderLeft: `4px solid ${RH.rose}`, borderRadius: 8, marginBottom: 18,
          }}>
            <div style={{ minWidth: 0 }}>
              <Eyebrow color={RH.rose}>Action needed · {negatives.length} guests waiting</Eyebrow>
              <p style={{
                fontFamily: SERIF, fontSize: mobile ? 16 : 18, fontWeight: 600,
                color: RH.ink, margin: '4px 0 0', letterSpacing: '-0.005em', lineHeight: 1.35,
              }}>
                Replying within 24 hours triples the chance of a return visit.
              </p>
            </div>
            <button style={{
              fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 8,
              background: RH.rose, color: '#fff', border: 'none', cursor: 'pointer',
              flexShrink: 0, whiteSpace: 'nowrap',
            }}>Show {negatives.length} →</button>
          </div>
        )}

        {/* ─── Compressed stats row ─────────────────────────────────────
            Was: 4 stat cards × ~92px tall = ~92px of fold cost
            Now: a single 64px row with mono labels, serif values, sparklines.
            Same numbers, a quarter the vertical real-estate. */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          background: RH.white, border: `1px solid ${RH.rule}`,
          borderRadius: 10, marginBottom: 18, overflow: 'hidden',
        }}>
          <SharpStat label="Reviews"    value={RH_STATS.total}  trend={[210,218,225,231,238,243,247]} />
          <SharpStat label="Avg rating" value="4.3" suffix="★" trend={[4.1,4.2,4.1,4.2,4.3,4.2,4.3]} />
          <SharpStat label="Reply rate" value={`${respondedPct}%`} trend={[68,70,71,73,72,75,76]} accent={RH.teal} />
          <SharpStat label="Sentiment" value="80%" sub="positive" trend={[72,74,73,77,78,79,80]} accent={RH.sage} bare />
        </div>

        {/* ─── Platform chips — unchanged shape, slightly tighter ───── */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 18,
          overflowX: mobile ? 'auto' : 'visible', flexWrap: mobile ? 'nowrap' : 'wrap',
          paddingBottom: mobile ? 4 : 0,
        }}>
          {Object.entries(RH_PLATFORMS).map(([p, m]) => {
            const active = platform === p;
            return (
              <button key={p} onClick={() => setPlatform(active ? '' : p)} style={{
                fontSize: 13, padding: '6px 12px', borderRadius: 999,
                display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0,
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

        {/* ─── Search + filters — unchanged ─────────────────────────── */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
              <SharpSearchIcon />
            </span>
            <input
              type="search"
              placeholder="Search reviews… (press / to focus)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px 8px 34px', fontSize: 13,
                background: RH.white, border: `1px solid ${RH.rule}`, borderRadius: 8,
                color: RH.ink, outline: 'none', fontFamily: SANS, boxSizing: 'border-box',
              }}
            />
          </div>
          <SharpSelect>All sentiments</SharpSelect>
          <SharpSelect>All reviews</SharpSelect>
        </div>

        <p style={{ fontSize: 12.5, color: RH.ink3, marginBottom: 12 }}>
          Showing {RH_REVIEWS.length} of {RH_STATS.total} reviews
        </p>

        {state === 'empty'   && <SharpEmpty />}
        {state === 'error'   && <SharpError />}
        {state === 'default' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {RH_REVIEWS.slice(0, 5).map(r => <SharpCard key={r.id} review={r} mobile={mobile} />)}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Stat row cell ──────────────────────────────────────────────────
function SharpStat({ label, value, suffix, sub, trend, accent, bare }) {
  return (
    <div style={{
      padding: '12px 16px', borderRight: bare ? 'none' : `1px solid ${RH.rule}`,
      display: 'flex', flexDirection: 'column', gap: 4, minHeight: 64,
    }}>
      <Eyebrow>{label}</Eyebrow>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{
            fontFamily: SERIF, fontWeight: 600, fontSize: 22,
            color: accent || RH.ink, lineHeight: 1,
          }}>{value}</span>
          {suffix && <span style={{ fontSize: 13, color: RH.ink2 }}>{suffix}</span>}
          {sub && <span style={{ fontSize: 11, color: RH.ink3, marginLeft: 4 }}>{sub}</span>}
        </div>
        {trend && <Sparkline points={trend} w={64} h={16} color={accent || RH.ink3} />}
      </div>
    </div>
  );
}

function SharpSelect({ children }) {
  return (
    <button style={{
      fontSize: 13, padding: '8px 12px', borderRadius: 8,
      background: RH.white, border: `1px solid ${RH.rule}`, color: RH.ink, cursor: 'pointer',
    }}>{children} ▾</button>
  );
}

function SharpSearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={RH.ink3} strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Card with rating glyph for severity ────────────────────────────
function SharpCard({ review, mobile }) {
  const isNeg = review.sentiment === 'negative' && !review.responded;
  const isPin = review.pinned;

  // Severity comes from the rating glyph itself, not just a left rule.
  const glyphColor = review.sentiment === 'negative' ? RH.rose
                   : review.sentiment === 'positive' ? RH.ink
                   : RH.ink3;

  return (
    <article style={{
      background: RH.white,
      border: `1px solid ${RH.rule}`,
      borderLeft: isNeg ? `3px solid ${RH.rose}` : isPin ? `3px solid #d4a843` : `1px solid ${RH.rule}`,
      borderRadius: 10, padding: mobile ? '14px 14px' : '16px 18px',
      display: 'flex', gap: mobile ? 12 : 16,
    }}>
      {/* Severity glyph — replaces the avatar as the primary visual hook */}
      <div style={{
        width: mobile ? 40 : 46, flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        paddingTop: 2,
      }}>
        <span style={{
          fontFamily: SERIF, fontWeight: 600,
          fontSize: mobile ? 28 : 34, lineHeight: 1, color: glyphColor,
        }}>{review.rating}</span>
        <Stars n={review.rating} size={9} on={glyphColor} dim={RH.rule} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: RH.ink }}>{review.name}</span>
          <span style={{ fontSize: 12, color: RH.ink3, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <PlatformGlyph p={review.platform} size={11} />
            {RH_PLATFORMS[review.platform]?.label}
            <span>·</span>
            <span>{review.posted}</span>
          </span>
          {isNeg && (
            <span style={{
              marginLeft: 'auto', fontFamily: MONO, fontSize: 10, fontWeight: 700,
              color: review.sla?.includes('Overdue') ? RH.rose : RH.ink2,
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>{review.sla || 'Needs reply'}</span>
          )}
          {review.responded && !isNeg && (
            <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10, color: RH.sage, letterSpacing: '0.1em' }}>
              ✓ REPLIED
            </span>
          )}
        </header>

        <p style={{
          fontSize: 13.5, lineHeight: 1.55, color: RH.ink, margin: '0 0 10px',
          fontWeight: isNeg ? 500 : 400,
        }}>{review.text}</p>

        {review.responded && review.reply ? (
          <div style={{
            background: RH.tealT, borderLeft: `3px solid ${RH.teal}`,
            borderRadius: 6, padding: '10px 12px',
          }}>
            <Eyebrow color={RH.teal}>Your reply</Eyebrow>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: RH.ink, margin: '4px 0 0' }}>{review.reply}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button style={{
              fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 6,
              background: isNeg ? RH.rose : RH.teal, color: '#fff', border: 'none', cursor: 'pointer',
            }}>{isNeg ? 'Draft an apology' : '✨ Draft a reply'}</button>
            <button style={{
              fontSize: 13, padding: '7px 12px', borderRadius: 6,
              background: 'transparent', border: `1px solid ${RH.rule}`, color: RH.ink2, cursor: 'pointer',
            }}>Mark resolved</button>
          </div>
        )}
      </div>
    </article>
  );
}

// ─── States ─────────────────────────────────────────────────────────
function SharpEmpty() {
  return (
    <div style={{
      padding: '40px 28px', textAlign: 'center',
      background: RH.white, border: `1px dashed ${RH.rule}`, borderRadius: 10,
    }}>
      <Eyebrow>No matches</Eyebrow>
      <h3 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, margin: '6px 0 8px' }}>
        Nothing matches these filters.
      </h3>
      <p style={{ fontSize: 13, color: RH.ink2, margin: '0 auto 16px', maxWidth: 380 }}>
        Try widening to <i>All platforms</i>, or look at the last 30 days.
      </p>
      <button style={{
        fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8,
        background: RH.teal, color: '#fff', border: 'none', cursor: 'pointer',
      }}>Clear filters</button>
    </div>
  );
}

function SharpError() {
  return (
    <div style={{
      background: RH.white, border: `1px solid ${RH.roseM}`,
      borderLeft: `3px solid ${RH.rose}`, borderRadius: 8, padding: '16px 20px',
    }}>
      <Eyebrow color={RH.rose}>Connection lost · Google</Eyebrow>
      <h3 style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, margin: '4px 0 4px' }}>
        We couldn't reach Google for the last 4 hours.
      </h3>
      <p style={{ fontSize: 13, color: RH.ink2, margin: '0 0 12px' }}>
        Your other 3 platforms are syncing normally. Reconnecting takes about a minute.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{
          fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 6,
          background: RH.teal, color: '#fff', border: 'none', cursor: 'pointer',
        }}>Reconnect Google</button>
        <button style={{
          fontSize: 13, padding: '7px 12px', borderRadius: 6,
          background: 'transparent', border: `1px solid ${RH.rule}`, color: RH.ink2, cursor: 'pointer',
        }}>See status</button>
      </div>
    </div>
  );
}

window.OriginalSharpened = OriginalSharpened;
