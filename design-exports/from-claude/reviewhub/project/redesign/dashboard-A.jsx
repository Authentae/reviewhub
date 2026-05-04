// Direction A — "The Reading Room"
// Split-pane inbox: left = condensed review list, right = focused detail/reply.
// Above-the-fold guarantee: most-recent unreplied review fills the right pane on load.

const A_CHIP = (active) => ({
  fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
  padding: '6px 10px', borderRadius: 4,
  border: `1px solid ${active ? RH.ink : RH.rule}`,
  background: active ? RH.ink : 'transparent',
  color: active ? RH.paper : RH.ink2,
  cursor: 'pointer', fontWeight: 600,
});

function DashboardA({ initialSelected = 0, mobile = false }) {
  const [tab, setTab] = React.useState('needs'); // needs | all | done
  const [selected, setSelected] = React.useState(initialSelected);

  const list = RH_REVIEWS;
  const review = list[selected];

  return (
    <div style={{ background: RH.paper, color: RH.ink, fontFamily: SANS, height: '100%' }}>
      {/* Compressed masthead — single 56px strip, no separate stat block below */}
      <header style={{
        height: 56, borderBottom: `1px solid ${RH.rule}`,
        display: 'flex', alignItems: 'center',
        padding: mobile ? '0 16px' : '0 24px',
        gap: mobile ? 12 : 24, background: RH.paper,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 4, background: RH.teal,
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: SERIF, fontWeight: 700, fontSize: 14,
          }}>R</div>
          <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em' }}>ReviewHub</span>
        </div>

        {!mobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 13 }}>
            <a style={{ color: RH.ink, fontWeight: 600, textDecoration: 'none' }}>Inbox</a>
            <a style={{ color: RH.ink2, textDecoration: 'none' }}>Analytics</a>
            <a style={{ color: RH.ink2, textDecoration: 'none' }}>Requests</a>
            <a style={{ color: RH.ink2, textDecoration: 'none' }}>Settings</a>
          </div>
        )}

        {/* Inline stat ticker — replaces the stat-card grid entirely */}
        <div style={{
          marginLeft: mobile ? 0 : 'auto', display: 'flex', alignItems: 'center',
          gap: mobile ? 14 : 22, flex: mobile ? 1 : 'initial', justifyContent: mobile ? 'flex-end' : 'flex-end',
        }}>
          <Tick label="Avg" value={`${RH_STATS.avg_rating}`} suffix="★" />
          {!mobile && <Tick label="Reply rate" value={`${Math.round((RH_STATS.responded/RH_STATS.total)*100)}%`} />}
          {!mobile && <Tick label="This week" value="+18" sub />}
          <Tick label="Negatives" value={RH_STATS.unresponded_negative} alert />
          {!mobile && <Avatar name="E" size={28} />}
        </div>
      </header>

      {/* Body — split pane (or stacked on mobile) */}
      <div style={{
        display: mobile ? 'block' : 'grid',
        gridTemplateColumns: '380px 1fr',
        height: 'calc(100% - 56px)',
      }}>
        {/* LEFT — list */}
        <aside style={{
          borderRight: mobile ? 'none' : `1px solid ${RH.rule}`,
          background: RH.paper, display: 'flex', flexDirection: 'column',
          height: mobile ? 'auto' : '100%', overflow: 'hidden',
        }}>
          {/* Title block */}
          <div style={{ padding: mobile ? '20px 16px 14px' : '24px 22px 14px' }}>
            <Eyebrow>Inbox · The Corner Bistro</Eyebrow>
            <h1 style={{
              fontFamily: SERIF, fontSize: mobile ? 26 : 30, fontWeight: 600,
              letterSpacing: '-0.02em', margin: '6px 0 0',
            }}>
              7 conversations
            </h1>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 6, padding: mobile ? '0 16px 12px' : '0 22px 12px',
            borderBottom: `1px solid ${RH.rule}`,
          }}>
            <ATab active={tab==='needs'} onClick={() => setTab('needs')} count={4}>Needs reply</ATab>
            <ATab active={tab==='all'} onClick={() => setTab('all')} count={7}>All</ATab>
            <ATab active={tab==='done'} onClick={() => setTab('done')} count={189}>Replied</ATab>
          </div>

          {/* Search */}
          <div style={{ padding: '10px 22px', borderBottom: `1px solid ${RH.rule}` }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', borderRadius: 6, background: RH.white,
              border: `1px solid ${RH.rule}`,
            }}>
              <SearchIcon />
              <input placeholder="Search 247 reviews"
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, background: 'transparent', fontFamily: SANS, color: RH.ink }} />
              <span style={{ fontFamily: MONO, fontSize: 10, color: RH.ink3, padding: '2px 5px', border: `1px solid ${RH.rule}`, borderRadius: 3 }}>/</span>
            </div>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {list.map((r, i) => (
              <AListItem
                key={r.id}
                review={r}
                active={i === selected}
                onClick={() => setSelected(i)}
              />
            ))}
          </div>
        </aside>

        {/* RIGHT — detail pane */}
        {!mobile && (
          <section style={{
            background: RH.white, height: '100%', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            <ADetail review={review} />
          </section>
        )}
      </div>
    </div>
  );
}

function Tick({ label, value, suffix, sub, alert }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: RH.ink3 }}>{label}</span>
      <span style={{
        fontFamily: SERIF, fontWeight: 600, fontSize: 18,
        color: alert ? RH.rose : sub ? RH.sage : RH.ink, lineHeight: 1,
      }}>
        {value}{suffix && <span style={{ marginLeft: 1 }}>{suffix}</span>}
      </span>
    </div>
  );
}

function ATab({ active, count, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 4px', background: 'transparent', border: 'none',
      borderBottom: `2px solid ${active ? RH.ink : 'transparent'}`,
      fontFamily: SANS, fontSize: 13, fontWeight: active ? 600 : 500,
      color: active ? RH.ink : RH.ink2, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 6,
      marginRight: 8,
    }}>
      {children}
      <span style={{
        fontFamily: MONO, fontSize: 10, color: active ? RH.ink2 : RH.ink3,
        background: active ? RH.paper2 : 'transparent', padding: '1px 5px', borderRadius: 3,
      }}>{count}</span>
    </button>
  );
}

function AListItem({ review, active, onClick }) {
  const isNeg = review.sentiment === 'negative';
  const accent = isNeg ? RH.rose : review.sentiment === 'positive' ? RH.sage : RH.ink3;

  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer',
      padding: '14px 22px', background: active ? RH.white : 'transparent',
      borderTop: 'none', borderRight: 'none', borderLeft: `3px solid ${active ? accent : 'transparent'}`,
      borderBottom: `1px solid ${RH.rule}`,
      fontFamily: SANS, color: RH.ink, display: 'block',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Stars n={review.rating} size={11} on={isNeg ? RH.rose : RH.ink} />
        <span style={{ fontWeight: 600, fontSize: 13 }}>{review.name}</span>
        {!review.responded && (
          <span style={{
            marginLeft: 'auto', fontFamily: MONO, fontSize: 9, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: isNeg ? RH.rose : RH.ink3,
          }}>{isNeg ? 'NEEDS REPLY' : 'OPEN'}</span>
        )}
        {review.responded && (
          <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10, color: RH.sage }}>✓</span>
        )}
      </div>
      <p style={{
        fontSize: 13, lineHeight: 1.45, color: RH.ink2, margin: 0,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', textOverflow: 'ellipsis',
        fontWeight: isNeg && !review.responded ? 500 : 400,
      }}>{review.text}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 11, color: RH.ink3 }}>
        <PlatformGlyph p={review.platform} size={10} />
        <span>{RH_PLATFORMS[review.platform].label}</span>
        <span>·</span>
        <span style={{ fontFamily: MONO, color: review.sla?.includes('Overdue') ? RH.rose : RH.ink3 }}>
          {review.sla || review.posted}
        </span>
      </div>
    </button>
  );
}

function ADetail({ review }) {
  const isNeg = review.sentiment === 'negative';
  const fg = isNeg ? RH.rose : review.sentiment === 'positive' ? RH.sage : RH.ink3;

  return (
    <>
      {/* Detail header */}
      <div style={{
        padding: '22px 32px 18px', borderBottom: `1px solid ${RH.rule}`,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <PlatformGlyph p={review.platform} size={14} />
            <Eyebrow>{RH_PLATFORMS[review.platform].label} · {review.posted}</Eyebrow>
            {review.flagged && <Eyebrow color={RH.rose}>· Flagged</Eyebrow>}
          </div>
          <h2 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: RH.ink }}>
            {review.name}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <Stars n={review.rating} size={14} on={isNeg ? RH.rose : RH.ink} />
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: fg, fontWeight: 700 }}>
              {review.sentiment}
            </span>
            {review.sla && (
              <span style={{ fontFamily: MONO, fontSize: 11, color: review.sla.includes('Overdue') ? RH.rose : RH.ink3 }}>
                · {review.sla}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <IconBtn>★</IconBtn>
          <IconBtn>↗</IconBtn>
          <IconBtn>⋯</IconBtn>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '28px 32px 24px', overflowY: 'auto', flex: 1 }}>
        {/* Editorial pull-quote */}
        <p style={{
          fontFamily: SERIF, fontSize: 22, lineHeight: 1.45, color: RH.ink,
          margin: 0, fontWeight: 400, letterSpacing: '-0.005em',
        }}>
          <span style={{ fontFamily: SERIF, color: fg, marginRight: 4, fontSize: 28 }}>“</span>
          {review.text}
          <span style={{ fontFamily: SERIF, color: fg, marginLeft: 2, fontSize: 28 }}>”</span>
        </p>

        {/* Reply or compose */}
        <div style={{ marginTop: 28 }}>
          {review.responded ? (
            <div style={{ borderLeft: `3px solid ${RH.teal}`, paddingLeft: 16, background: RH.tealT, padding: '14px 18px', borderRadius: 4 }}>
              <Eyebrow color={RH.teal}>Your reply · {review.posted}</Eyebrow>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: RH.ink, margin: '8px 0 0' }}>{review.reply}</p>
            </div>
          ) : (
            <ASuggestedReply review={review} />
          )}
        </div>
      </div>
    </>
  );
}

function ASuggestedReply({ review }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Eyebrow>Suggested reply · drafted from your last 12 responses</Eyebrow>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={A_CHIP(true)}>Apologetic</button>
          <button style={A_CHIP(false)}>Warm</button>
          <button style={A_CHIP(false)}>Brief</button>
        </div>
      </div>

      <div style={{
        background: RH.paper, border: `1px solid ${RH.rule}`,
        borderRadius: 8, padding: 18, marginBottom: 14,
      }}>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: RH.ink, margin: 0 }}>
          {review.suggested || 'Thank you for taking the time to share this — we want every visit to feel cared for, and clearly we missed the mark on this one. I\'d like to make it right; would you be open to coming back as our guest?'}
        </p>
        <Rule style={{ margin: '14px 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 14, fontSize: 12, color: RH.ink3 }}>
            <span>168 chars</span>
            <span>·</span>
            <span>Reads at grade 7</span>
            <span>·</span>
            <span style={{ color: RH.sage }}>Matches your voice</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={A_CHIP(false)}>Regenerate</button>
            <button style={{
              fontFamily: SANS, fontSize: 13, fontWeight: 600, padding: '8px 16px',
              background: RH.teal, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
            }}>Send reply</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, fontSize: 12, color: RH.ink3 }}>
        <button style={A_CHIP(false)}>Mark resolved</button>
        <button style={A_CHIP(false)}>Snooze 24h</button>
        <button style={A_CHIP(false)}>Escalate</button>
      </div>
    </div>
  );
}

function IconBtn({ children }) {
  return (
    <button style={{
      width: 30, height: 30, borderRadius: 6,
      background: 'transparent', border: `1px solid ${RH.rule}`,
      color: RH.ink2, cursor: 'pointer', fontSize: 14, lineHeight: 1,
    }}>{children}</button>
  );
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={RH.ink3} strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

window.DashboardA = DashboardA;
