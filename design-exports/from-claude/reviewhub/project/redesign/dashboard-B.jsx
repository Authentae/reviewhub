// Direction B — "The Triage Rail"
// A dedicated negative-priority rail pinned to the top of the page,
// with a single column feed below. Negatives feel impossible to ignore
// because they live in their own visual zone — not because of color shouting.

function DashboardB({ mobile = false }) {
  const negatives = RH_REVIEWS.filter(r => r.sentiment === 'negative' && !r.responded);
  const others    = RH_REVIEWS.filter(r => !(r.sentiment === 'negative' && !r.responded));

  return (
    <div style={{ background: RH.paper, color: RH.ink, fontFamily: SANS, minHeight: '100%' }}>
      {/* Top strip: brand + dense stat ticker, single line */}
      <header style={{
        height: 52, borderBottom: `1px solid ${RH.rule}`,
        display: 'flex', alignItems: 'center', padding: mobile ? '0 16px' : '0 28px', gap: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 4, background: RH.teal,
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: SERIF, fontWeight: 700, fontSize: 13,
          }}>R</div>
          <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 15 }}>ReviewHub</span>
        </div>
        {!mobile && (
          <nav style={{ display: 'flex', gap: 16, fontSize: 13, color: RH.ink2, marginLeft: 8 }}>
            <a style={{ color: RH.ink, fontWeight: 600, textDecoration: 'none' }}>Inbox</a>
            <a style={{ color: RH.ink2, textDecoration: 'none' }}>Analytics</a>
            <a style={{ color: RH.ink2, textDecoration: 'none' }}>Requests</a>
            <a style={{ color: RH.ink2, textDecoration: 'none' }}>Settings</a>
          </nav>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <Avatar name="E" size={28} />
        </div>
      </header>

      <main style={{ maxWidth: mobile ? '100%' : 980, margin: '0 auto', padding: mobile ? '20px 16px 40px' : '24px 28px 60px' }}>
        {/* Page lede */}
        <div style={{ marginBottom: 18 }}>
          <Eyebrow>Friday · 5 May · The Corner Bistro</Eyebrow>
          <h1 style={{
            fontFamily: SERIF, fontSize: mobile ? 30 : 38, fontWeight: 600,
            letterSpacing: '-0.02em', margin: '6px 0 6px',
          }}>
            Three guests need a reply.
          </h1>
          <p style={{ fontSize: 14, color: RH.ink2, margin: 0, maxWidth: 540 }}>
            247 reviews · 4.3 average · 76% reply rate. Negative reviews answered within 24 hours
            convert to a return visit <span style={{ color: RH.ink, fontWeight: 600 }}>3× more often</span>.
          </p>
        </div>

        {/* Compressed stat strip — replaces 4-card grid */}
        <div style={{
          display: 'flex', alignItems: 'stretch', gap: 0,
          border: `1px solid ${RH.rule}`, borderRadius: 8, background: RH.white,
          marginBottom: 28, overflow: 'hidden',
        }}>
          <BStat label="Average rating" value="4.3" suffix="★" trend={[4.1,4.2,4.1,4.2,4.3,4.2,4.3]} />
          <BStat label="Reply rate" value="76" suffix="%" trend={[68,70,71,73,72,75,76]} />
          <BStat label="This week" value="+18" sub="reviews" trend={[3,8,4,12,9,14,18]} />
          <BStat label="Sentiment" value="80" suffix="%" sub="positive" trend={[72,74,73,77,78,79,80]} bare />
        </div>

        {/* ── PRIORITY RAIL — negatives ──────────────────────────────── */}
        <section style={{ marginBottom: 36 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${RH.ink}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <Eyebrow style={{ color: RH.ink }}>Priority · {negatives.length} unreplied negatives</Eyebrow>
              <span style={{ fontFamily: MONO, fontSize: 11, color: RH.rose }}>
                Window closing — oldest is 4d overdue
              </span>
            </div>
            <button style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
              color: RH.ink2, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600,
            }}>Reply to all →</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {negatives.map((r, i) => (
              <BPriorityRow key={r.id} review={r} last={i === negatives.length - 1} mobile={mobile} />
            ))}
          </div>
        </section>

        {/* ── REGULAR FEED ──────────────────────────────────────────── */}
        <section>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid ${RH.rule}`,
          }}>
            <Eyebrow>Everything else · {others.length}</Eyebrow>
            <div style={{ display: 'flex', gap: 8 }}>
              <BFilter>All platforms ▾</BFilter>
              <BFilter>Most recent ▾</BFilter>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {others.map((r, i) => (
              <BFeedRow key={r.id} review={r} last={i === others.length - 1} mobile={mobile} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function BStat({ label, value, suffix, sub, trend, bare }) {
  return (
    <div style={{
      flex: 1, padding: '14px 18px',
      borderRight: bare ? 'none' : `1px solid ${RH.rule}`,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <Eyebrow>{label}</Eyebrow>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 24, color: RH.ink, lineHeight: 1 }}>
          {value}
        </span>
        {suffix && <span style={{ fontSize: 13, color: RH.ink2 }}>{suffix}</span>}
        {sub && <span style={{ fontSize: 11, color: RH.ink3, marginLeft: 4 }}>{sub}</span>}
      </div>
      {trend && <Sparkline points={trend} w={120} h={18} color={RH.ink2} />}
    </div>
  );
}

function BPriorityRow({ review, last, mobile }) {
  return (
    <article style={{
      display: 'flex', gap: mobile ? 12 : 18,
      padding: mobile ? '16px 0' : '20px 0',
      borderBottom: last ? 'none' : `1px solid ${RH.ruleS}`,
      alignItems: 'flex-start',
    }}>
      <RatingGlyph n={review.rating} sentiment={review.sentiment} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: RH.ink }}>
            {review.name}
          </span>
          <span style={{ fontSize: 12, color: RH.ink3, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <PlatformGlyph p={review.platform} size={11} />
            {RH_PLATFORMS[review.platform].label} · {review.posted}
          </span>
          <span style={{
            marginLeft: 'auto', fontFamily: MONO, fontSize: 10, fontWeight: 700,
            color: review.sla?.includes('Overdue') ? RH.rose : RH.ink2,
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            {review.sla}
          </span>
        </div>

        <p style={{ fontSize: 14.5, lineHeight: 1.55, color: RH.ink, margin: '0 0 10px', fontWeight: 500 }}>
          {review.text}
        </p>

        <div style={{
          background: RH.paper, border: `1px dashed ${RH.rule}`,
          padding: '10px 14px', borderRadius: 4, marginBottom: 10,
        }}>
          <Eyebrow color={RH.ink2}>Suggested angle</Eyebrow>
          <p style={{ fontSize: 13, color: RH.ink2, margin: '4px 0 0', fontStyle: 'italic' }}>
            {review.suggested}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={{
            fontFamily: SANS, fontSize: 13, fontWeight: 600, padding: '7px 14px',
            background: RH.teal, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
          }}>Draft a reply</button>
          <button style={BSecondary()}>See on {RH_PLATFORMS[review.platform].label}</button>
          <button style={BSecondary()}>Snooze 24h</button>
        </div>
      </div>
    </article>
  );
}

function BFeedRow({ review, last, mobile }) {
  const fg = review.sentiment === 'negative' ? RH.rose : review.sentiment === 'positive' ? RH.sage : RH.ink3;
  return (
    <article style={{
      display: 'flex', gap: mobile ? 12 : 18,
      padding: mobile ? '14px 0' : '16px 0',
      borderBottom: last ? 'none' : `1px solid ${RH.ruleS}`,
      alignItems: 'flex-start',
    }}>
      <div style={{
        width: 44, flexShrink: 0, paddingRight: 12, borderRight: `1px solid ${RH.rule}`, marginRight: 14,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        <span style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: fg, lineHeight: 1 }}>
          {review.rating}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.16em', color: RH.ink3 }}>STAR</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: RH.ink }}>{review.name}</span>
          <span style={{ fontSize: 11, color: RH.ink3, display: 'inline-flex', gap: 5, alignItems: 'center' }}>
            <PlatformGlyph p={review.platform} size={10} />
            {RH_PLATFORMS[review.platform].label} · {review.posted}
          </span>
          {review.responded && (
            <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10, color: RH.sage, letterSpacing: '0.1em' }}>
              ✓ REPLIED
            </span>
          )}
        </div>
        <p style={{
          fontSize: 13.5, lineHeight: 1.5, color: RH.ink2, margin: 0,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{review.text}</p>
      </div>
    </article>
  );
}

function BSecondary() {
  return {
    fontFamily: SANS, fontSize: 12, fontWeight: 500, padding: '6px 12px',
    background: 'transparent', color: RH.ink2,
    border: `1px solid ${RH.rule}`, borderRadius: 6, cursor: 'pointer',
  };
}

function BFilter({ children }) {
  return (
    <button style={{
      fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
      color: RH.ink2, background: 'transparent', border: `1px solid ${RH.rule}`,
      borderRadius: 4, padding: '5px 9px', cursor: 'pointer', fontWeight: 600,
    }}>{children}</button>
  );
}

window.DashboardB = DashboardB;
