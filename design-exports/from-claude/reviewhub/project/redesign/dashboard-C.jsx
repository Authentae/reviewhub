// Direction C — "The Magazine"
// Aggressive density: a single editorial column where every review is a
// horizontal entry with type-driven hierarchy. Negatives use scale (large
// drop-cap rating + serif lede), positives stay quiet and small. Stats
// live in the running header. Highest information density of the three.

function DashboardC({ mobile = false, state = 'default' }) {
  // state: default | empty | loading | error
  const reviews = RH_REVIEWS;

  return (
    <div style={{ background: RH.paper, color: RH.ink, fontFamily: SANS, minHeight: '100%' }}>
      {/* Editorial masthead — one row, no separate stat block */}
      <header style={{
        borderBottom: `2px solid ${RH.ink}`,
        padding: mobile ? '14px 16px 10px' : '18px 32px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <Eyebrow>Vol. III · Issue 247 · Friday 5 May 2026</Eyebrow>
            <h1 style={{
              fontFamily: SERIF, fontSize: mobile ? 34 : 46, fontWeight: 700,
              letterSpacing: '-0.025em', margin: '4px 0 0', lineHeight: 0.95,
            }}>
              The Reviewer
            </h1>
          </div>
          {!mobile && (
            <nav style={{ display: 'flex', gap: 20, fontSize: 12, color: RH.ink2, paddingBottom: 8 }}>
              <a style={{ color: RH.ink, fontWeight: 600, textDecoration: 'none' }}>Inbox</a>
              <a style={{ textDecoration: 'none', color: RH.ink2 }}>Analytics</a>
              <a style={{ textDecoration: 'none', color: RH.ink2 }}>Requests</a>
              <a style={{ textDecoration: 'none', color: RH.ink2 }}>Settings</a>
              <Avatar name="E" size={26} />
            </nav>
          )}
        </div>

        {/* Running stat line */}
        <div style={{
          marginTop: 12, paddingTop: 10, borderTop: `1px solid ${RH.rule}`,
          display: 'flex', alignItems: 'center', gap: mobile ? 14 : 24,
          fontFamily: MONO, fontSize: 11, color: RH.ink2, flexWrap: 'wrap',
        }}>
          <span><b style={{ color: RH.ink }}>247</b> total</span>
          <span style={{ color: RH.ruleS }}>|</span>
          <span><b style={{ color: RH.ink }}>4.3★</b> avg</span>
          <span style={{ color: RH.ruleS }}>|</span>
          <span><b style={{ color: RH.ink }}>76%</b> reply rate</span>
          <span style={{ color: RH.ruleS }}>|</span>
          <span style={{ color: RH.rose, fontWeight: 700 }}>3 NEGATIVE UNREPLIED</span>
          <span style={{ marginLeft: 'auto', display: mobile ? 'none' : 'inline' }}>+18 THIS WEEK ↗</span>
        </div>
      </header>

      <main style={{ maxWidth: mobile ? '100%' : 820, margin: '0 auto', padding: mobile ? '20px 16px 40px' : '28px 32px 60px' }}>
        {/* Filter toolbar — minimal, mono, single line */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24,
          paddingBottom: 12, borderBottom: `1px solid ${RH.rule}`, flexWrap: 'wrap',
        }}>
          <CFilter active>All ({reviews.length})</CFilter>
          <CFilter>Needs reply (4)</CFilter>
          <CFilter>Negative (3)</CFilter>
          <CFilter>This week (18)</CFilter>
          <div style={{ flex: 1 }} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: RH.ink3,
            border: `1px solid ${RH.rule}`, borderRadius: 4, padding: '4px 8px', background: RH.white,
          }}>
            <SearchIconC />
            <input placeholder="Search…" style={{
              border: 'none', outline: 'none', background: 'transparent',
              fontFamily: SANS, fontSize: 12, color: RH.ink, width: 100,
            }} />
          </div>
        </div>

        {state === 'empty'   && <CEmptyState />}
        {state === 'loading' && <CLoadingState />}
        {state === 'error'   && <CErrorState />}

        {state === 'default' && (
          <>
            {/* Lead story — biggest unreplied negative */}
            <CLeadStory review={reviews[0]} mobile={mobile} />

            <Rule style={{ margin: '32px 0 28px', background: RH.ink, height: 1 }} />

            {/* Secondary negatives */}
            <Eyebrow style={{ marginBottom: 14, display: 'block' }}>Also needing your attention</Eyebrow>
            {reviews.slice(1, 3).map(r => (
              <CSecondary key={r.id} review={r} mobile={mobile} />
            ))}

            <Rule style={{ margin: '24px 0 22px' }} />

            {/* The rest — typeset short */}
            <Eyebrow style={{ marginBottom: 12, display: 'block' }}>From the postbag</Eyebrow>
            {reviews.slice(3).map(r => (
              <CBriefRow key={r.id} review={r} mobile={mobile} />
            ))}
          </>
        )}
      </main>
    </div>
  );
}

function CFilter({ active, children }) {
  return (
    <button style={{
      fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
      color: active ? RH.paper : RH.ink2,
      background: active ? RH.ink : 'transparent',
      border: `1px solid ${active ? RH.ink : RH.rule}`,
      borderRadius: 3, padding: '5px 9px', cursor: 'pointer', fontWeight: 600,
    }}>{children}</button>
  );
}

function SearchIconC() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={RH.ink3} strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function CLeadStory({ review, mobile }) {
  return (
    <article>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <Eyebrow color={RH.rose}>Lead · 1-Star · {review.sla}</Eyebrow>
      </div>
      <div style={{ display: 'flex', gap: mobile ? 14 : 24, alignItems: 'flex-start' }}>
        <div style={{
          fontFamily: SERIF, fontWeight: 700, fontSize: mobile ? 76 : 110,
          color: RH.rose, lineHeight: 0.85, flexShrink: 0,
          letterSpacing: '-0.04em',
        }}>{review.rating}</div>
        <div style={{ flex: 1, minWidth: 0, paddingTop: mobile ? 2 : 8 }}>
          <h2 style={{
            fontFamily: SERIF, fontSize: mobile ? 22 : 28, fontWeight: 600,
            letterSpacing: '-0.015em', lineHeight: 1.25, margin: '0 0 8px', color: RH.ink,
          }}>
            {review.text}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: RH.ink3, marginBottom: 14 }}>
            <span style={{ fontWeight: 600, color: RH.ink2 }}>{review.name}</span>
            <span>·</span>
            <PlatformGlyph p={review.platform} size={11} />
            <span>{RH_PLATFORMS[review.platform].label}</span>
            <span>·</span>
            <span>{review.posted}</span>
          </div>
          <p style={{
            fontSize: 13, lineHeight: 1.55, color: RH.ink2, margin: '0 0 14px',
            paddingLeft: 12, borderLeft: `2px solid ${RH.rule}`, fontStyle: 'italic',
          }}>
            <b style={{ fontStyle: 'normal', color: RH.ink2 }}>Angle:</b> {review.suggested}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={{
              fontFamily: SANS, fontSize: 13, fontWeight: 600, padding: '8px 16px',
              background: RH.teal, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer',
            }}>Draft a reply</button>
            <button style={CSec()}>Open on {RH_PLATFORMS[review.platform].label}</button>
            <button style={CSec()}>Snooze</button>
          </div>
        </div>
      </div>
    </article>
  );
}

function CSecondary({ review, mobile }) {
  const isNeg = review.sentiment === 'negative';
  return (
    <article style={{
      display: 'flex', gap: mobile ? 12 : 18, padding: '14px 0',
      borderTop: `1px solid ${RH.ruleS}`, alignItems: 'flex-start',
    }}>
      <div style={{
        fontFamily: SERIF, fontWeight: 600, fontSize: mobile ? 36 : 48,
        color: isNeg ? RH.rose : RH.ink, lineHeight: 0.9, flexShrink: 0, width: mobile ? 36 : 50,
      }}>{review.rating}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600 }}>{review.name}</span>
          <span style={{ fontSize: 11, color: RH.ink3, display: 'inline-flex', gap: 5, alignItems: 'center' }}>
            <PlatformGlyph p={review.platform} size={10} />
            {RH_PLATFORMS[review.platform].label} · {review.posted}
          </span>
          <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10, color: isNeg ? RH.rose : RH.ink3, fontWeight: 700, letterSpacing: '0.1em' }}>
            {review.sla?.toUpperCase() || ''}
          </span>
        </div>
        <p style={{
          fontFamily: SERIF, fontSize: mobile ? 15 : 16, lineHeight: 1.5,
          color: RH.ink, margin: '0 0 8px',
        }}>{review.text}</p>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{
            fontFamily: SANS, fontSize: 12, fontWeight: 600, padding: '5px 12px',
            background: RH.ink, color: RH.paper, border: 'none', borderRadius: 3, cursor: 'pointer',
          }}>Draft reply</button>
          <button style={CSec(true)}>Snooze</button>
        </div>
      </div>
    </article>
  );
}

function CBriefRow({ review, mobile }) {
  const isPos = review.sentiment === 'positive';
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: mobile ? '24px 1fr' : '28px 100px 1fr 80px',
      gap: 12, padding: '10px 0',
      borderTop: `1px solid ${RH.ruleS}`,
      alignItems: 'baseline', fontSize: 13,
    }}>
      <span style={{
        fontFamily: SERIF, fontWeight: 600, fontSize: 18,
        color: isPos ? RH.ink2 : RH.ink, lineHeight: 1,
      }}>{review.rating}</span>
      {!mobile && (
        <span style={{ fontWeight: 600, color: RH.ink, fontSize: 13 }}>{review.name}</span>
      )}
      <span style={{
        color: RH.ink2, lineHeight: 1.45,
        display: '-webkit-box', WebkitLineClamp: mobile ? 2 : 1, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {mobile && <b style={{ color: RH.ink, marginRight: 6 }}>{review.name}.</b>}
        {review.text}
      </span>
      {!mobile && (
        <span style={{ fontFamily: MONO, fontSize: 10, color: RH.ink3, textAlign: 'right' }}>
          {review.responded ? '✓ REPLIED' : 'OPEN'}
        </span>
      )}
    </div>
  );
}

function CSec(small) {
  return {
    fontFamily: SANS, fontSize: small ? 11 : 12, fontWeight: 500, padding: small ? '4px 10px' : '7px 12px',
    background: 'transparent', color: RH.ink2,
    border: `1px solid ${RH.rule}`, borderRadius: 4, cursor: 'pointer',
  };
}

// ── States ────────────────────────────────────────────────────────────

function CEmptyState() {
  return (
    <div style={{
      padding: '60px 32px', textAlign: 'center',
      borderTop: `1px solid ${RH.rule}`, borderBottom: `1px solid ${RH.rule}`,
      background: `repeating-linear-gradient(45deg, transparent 0 12px, ${RH.ruleS} 12px 13px)`,
    }}>
      <div style={{
        background: RH.paper, display: 'inline-block', padding: '32px 36px',
        border: `1px solid ${RH.rule}`, borderRadius: 4, maxWidth: 460,
      }}>
        <Eyebrow>Empty postbag</Eyebrow>
        <h3 style={{
          fontFamily: SERIF, fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em',
          margin: '8px 0 8px', color: RH.ink,
        }}>
          No reviews match these filters.
        </h3>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, color: RH.ink2, margin: '0 0 20px' }}>
          Try widening to <i>All platforms</i>, or look at the last 30 days.
          The closest match — a <b>2-star Mark T.</b> from this week — is one filter away.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={{
            fontFamily: SANS, fontSize: 13, fontWeight: 600, padding: '8px 16px',
            background: RH.teal, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer',
          }}>Clear filters</button>
          <button style={CSec()}>See last 30 days</button>
        </div>
      </div>
    </div>
  );
}

function CLoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          padding: '18px 0', borderTop: `1px solid ${RH.ruleS}`,
          display: 'flex', gap: 18, alignItems: 'flex-start',
          opacity: 1 - i * 0.25,
        }}>
          <div style={{ width: 44, height: 44, background: RH.paper2, borderRadius: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 12, width: '40%', background: RH.paper2, marginBottom: 10, borderRadius: 2 }} />
            <div style={{ height: 10, width: '92%', background: RH.paper2, marginBottom: 6, borderRadius: 2 }} />
            <div style={{ height: 10, width: '78%', background: RH.paper2, borderRadius: 2 }} />
          </div>
        </div>
      ))}
      <div style={{
        textAlign: 'center', marginTop: 18,
        fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', color: RH.ink3,
      }}>FETCHING FROM 4 PLATFORMS…</div>
    </div>
  );
}

function CErrorState() {
  return (
    <div style={{
      border: `1px solid ${RH.roseM}`, borderLeft: `3px solid ${RH.rose}`,
      padding: '20px 24px', borderRadius: 4, background: RH.roseT,
    }}>
      <Eyebrow color={RH.rose}>Connection lost · Google</Eyebrow>
      <h3 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, margin: '6px 0 6px', color: RH.ink }}>
        We couldn't reach Google for the last 4 hours.
      </h3>
      <p style={{ fontSize: 13.5, lineHeight: 1.55, color: RH.ink2, margin: '0 0 14px' }}>
        Your other 3 platforms are syncing normally. Reconnecting takes about a minute.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{
          fontFamily: SANS, fontSize: 13, fontWeight: 600, padding: '7px 14px',
          background: RH.teal, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer',
        }}>Reconnect Google</button>
        <button style={CSec()}>See status page</button>
      </div>
    </div>
  );
}

window.DashboardC = DashboardC;
