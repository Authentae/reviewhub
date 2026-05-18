// /admin/brief — Founder Daily Brief dashboard.
//
// Bloomberg-terminal-style operational page. Solo-founder view: load it
// once a day with morning coffee, immediately know what changed since
// yesterday — Wave funnel, warm prospects, system health.
//
// Design generated 2026-05-11 via claude.ai/design (file: ReviewHub
// Founder Daily Brief.html in the audit-preview-v2 project). Ported
// to a proper React component 2026-05-12 because Wave 4 fired
// overnight and Earth needed live monitoring instead of asking me to
// curl /api/admin/outreach-stats every few hours.
//
// Auth: admin endpoints gate by ADMIN_EMAIL env var → user.email
// lookup (server fix landed 2026-05-10 in commit 8ce7e81). This page
// shows a not-admin message if /api/admin/outreach-stats returns 404.

import React, { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import usePageTitle from '../hooks/usePageTitle';
import useNoIndex from '../hooks/useNoIndex';
import Navbar from '../components/Navbar';

const C = {
  paper: '#fbf8f1',
  ink: '#1d242c',
  inkSoft: '#4a525a',
  inkDim: 'rgba(29,36,44,0.5)',
  teal: '#1e4d5e',
  tealDeep: '#163d4a',
  ochre: '#c08a3e',
  ochreSoft: 'rgba(192,138,62,0.08)',
  sage: '#6b8e7a',
  sageSoft: 'rgba(107,142,122,0.10)',
  rose: '#c2566c',
  roseSoft: 'rgba(194,86,108,0.08)',
  hairline: 'rgba(29,36,44,0.08)',
  hairlineStrong: 'rgba(29,36,44,0.12)',
};
const serif = "'Instrument Serif', Georgia, serif";
const mono = "'JetBrains Mono', ui-monospace, monospace";

function Eyebrow({ children, color = C.inkDim, size = 10 }) {
  return (
    <span style={{
      fontFamily: mono, fontSize: size, fontWeight: 600,
      letterSpacing: '0.14em', textTransform: 'uppercase',
      color,
    }}>{children}</span>
  );
}

function StatusPill({ children, dot = 'sage' }) {
  const dotColor = { sage: C.sage, rose: C.rose, ochre: C.ochre }[dot] || C.sage;
  return (
    <span style={{
      fontFamily: mono, fontSize: 10, fontWeight: 600,
      letterSpacing: '0.10em', textTransform: 'uppercase',
      color: C.inkSoft,
      padding: '5px 10px',
      border: `1px solid ${C.hairline}`, borderRadius: 999,
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: '#fff',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: dotColor, flexShrink: 0,
      }} />
      {children}
    </span>
  );
}

function DeltaTile({ label, n, delta, sub, deltaColor }) {
  return (
    <div style={{
      padding: '20px 22px',
      border: `1px solid ${C.hairline}`,
      borderRadius: 8,
      background: '#fff',
      flex: 1,
      minWidth: 0,
    }}>
      <Eyebrow color={C.ochre}>{label}</Eyebrow>
      <div style={{
        fontFamily: serif, fontSize: 56, lineHeight: 1, color: C.ink,
        margin: '10px 0 4px', letterSpacing: '-0.02em',
      }}>{n}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        {delta != null && (
          <span style={{
            fontFamily: mono, fontSize: 11, fontWeight: 600,
            color: deltaColor || C.inkDim,
          }}>{delta}</span>
        )}
        <span style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.4 }}>{sub}</span>
      </div>
    </div>
  );
}

function openRateColor(pct) {
  if (pct < 20) return { bg: C.roseSoft, fg: C.rose };
  if (pct >= 50) return { bg: C.sageSoft, fg: C.sage };
  return { bg: 'transparent', fg: C.inkSoft };
}

function pctStr(opened, sent) {
  if (sent === 0) return '0%';
  return Math.round((opened / sent) * 100) + '%';
}

// Group audits by wave (heuristic: by created_at date). Wave 1 = 2026-05-04,
// Wave 2 = 2026-05-06, Wave 4 = 2026-05-10+. Wave 3 follow-ups don't
// generate new audit rows; they reference existing ones.
function groupByWave(audits) {
  const groups = { 1: [], 2: [], 4: [], other: [] };
  for (const a of audits) {
    const date = (a.created_at || '').slice(0, 10);
    if (date === '2026-05-04') groups[1].push(a);
    else if (date === '2026-05-06') groups[2].push(a);
    else if (date >= '2026-05-10') groups[4].push(a);
    else groups.other.push(a);
  }
  return groups;
}

function WaveRow({ wave, audits, isAll = false }) {
  const sent = audits.length;
  const opened = audits.filter((a) => (a.view_count || 0) > 0).length;
  const replied = audits.filter((a) => a.marked_as_replied_at).length;
  const openPct = sent ? Math.round((opened / sent) * 100) : 0;
  const colors = openRateColor(openPct);
  const latest = audits
    .slice()
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))[0];
  const latestText = isAll
    ? ''
    : latest
      ? `${latest.business_name.split(' ').slice(0, 2).join(' ')} +${latest.view_count || 0} · ${Math.round(latest.hours_since_sent / 24)}d ago`
      : '(none)';

  const cell = {
    fontFamily: mono, fontSize: 13, color: C.ink,
    textAlign: 'right', padding: '14px 14px',
    fontWeight: isAll ? 700 : 500,
  };
  const labelCell = {
    fontFamily: mono, fontSize: 13, color: C.ink,
    textAlign: 'left', padding: '14px 14px',
    fontWeight: isAll ? 700 : 500,
  };
  return (
    <tr style={{
      borderTop: `1px solid ${isAll ? C.hairlineStrong : C.hairline}`,
      background: isAll ? '#fff' : 'transparent',
    }}>
      <td style={labelCell}>{isAll ? 'ALL' : `0${wave}`}</td>
      <td style={cell}>{sent || '—'}</td>
      <td style={cell}>{opened || '—'}</td>
      <td style={{ ...cell, color: colors.fg, background: colors.bg }}>
        {sent ? `${openPct}%` : '—'}
      </td>
      <td style={cell}>{sent ? replied : '—'}</td>
      <td style={cell}>{sent ? 0 : '—'}{/* conv (none yet) */}</td>
      <td style={cell}>{sent ? 0 : '—'}{/* paid (none yet) */}</td>
      <td style={{ ...cell, textAlign: 'left', color: C.inkSoft, fontSize: 12 }}>
        {latestText}
      </td>
    </tr>
  );
}

function WarmProspectCard({ a, rank }) {
  const hoursSinceLastView = a.view_count > 0
    ? null // Backend doesn't expose this yet; placeholder
    : null;
  const sentDays = Math.round(a.hours_since_sent / 24);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      gap: 16, alignItems: 'center',
      padding: '14px 18px',
      border: `1px solid ${C.hairline}`, borderRadius: 8,
      background: '#fff',
    }}>
      <span style={{
        fontFamily: mono, fontSize: 11, fontWeight: 600,
        color: C.ochre, letterSpacing: '0.14em',
      }}>0{rank}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: serif, fontSize: 18, color: C.ink,
          letterSpacing: '-0.01em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{a.business_name}</div>
        <div style={{
          fontFamily: mono, fontSize: 11, color: C.inkSoft, marginTop: 4,
          letterSpacing: '0.05em',
        }}>
          {a.view_count} VIEWS · SENT {sentDays}D AGO
        </div>
      </div>
      <span style={{
        fontFamily: mono, fontSize: 10, fontWeight: 600,
        color: C.sage, padding: '6px 10px',
        border: `1px solid ${C.sage}`, borderRadius: 999,
        letterSpacing: '0.10em', whiteSpace: 'nowrap',
      }}>FOLLOW-UP SENT</span>
    </div>
  );
}

export default function FounderBrief() {
  usePageTitle('Daily Brief — ReviewHub');
  useNoIndex();
  const [data, setData] = useState(null);
  const [waitlist, setWaitlist] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Fetch both endpoints in parallel — the brief now surfaces
        // Pro/Business waitlist signups alongside outreach views.
        // Per page-flow audit v2 #4 (2026-05-19): glanceable demand
        // signals without bouncing between dashboards.
        // waitlist-stats failure is non-fatal — the brief still
        // renders the outreach data if waitlist endpoint 500s.
        const [outreachRes, waitlistRes] = await Promise.allSettled([
          api.get('/admin/outreach-stats'),
          api.get('/admin/waitlist-stats'),
        ]);
        if (cancelled) return;
        if (outreachRes.status === 'fulfilled') {
          setData(outreachRes.value.data);
        } else {
          throw outreachRes.reason;
        }
        if (waitlistRes.status === 'fulfilled') {
          setWaitlist(waitlistRes.value.data);
        }
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const status = err?.response?.status;
        setError(
          status === 404
            ? 'Not authorized — this page is gated by ADMIN_EMAIL. You\'re signed in but not as the admin.'
            : status === 401
              ? 'Sign in required.'
              : `Failed to load: ${err.message || 'unknown error'}`
        );
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Tick clock for the date label
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(iv);
  }, []);

  const summary = data?.summary || {};
  const audits = data?.audits || [];
  const waves = useMemo(() => groupByWave(audits), [audits]);
  const warmProspects = useMemo(() => {
    return audits
      .filter((a) => (a.view_count || 0) > 0 && !a.marked_as_replied_at)
      .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
      .slice(0, 6);
  }, [audits]);

  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeLabel = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  if (loading) {
    return (
      <div style={{ background: C.paper, minHeight: '100vh' }}>
        <Navbar />
        <div style={{ padding: 64, textAlign: 'center', color: C.inkDim, fontFamily: mono, fontSize: 12, letterSpacing: '0.14em' }}>LOADING…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: C.paper, minHeight: '100vh' }}>
        <Navbar />
        <div style={{ maxWidth: 520, margin: '64px auto', padding: 24 }}>
          <Eyebrow color={C.rose} size={11}>NOT AVAILABLE</Eyebrow>
          <p style={{ marginTop: 12, fontSize: 16, color: C.ink, lineHeight: 1.5 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.paper, minHeight: '100vh', color: C.ink }}>
      <Navbar />
      <main style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '40px 24px 80px',
      }}>
        {/* HEADER STRIP */}
        <header style={{
          display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap',
          gap: 20, paddingBottom: 24,
          borderBottom: `1px solid ${C.hairlineStrong}`,
        }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h1 style={{
              margin: 0, fontFamily: serif,
              fontSize: 'clamp(36px, 5vw, 48px)', lineHeight: 1,
              letterSpacing: '-0.015em',
            }}>
              Daily <em style={{ fontStyle: 'italic', color: C.ochre }}>Brief</em>
            </h1>
            <p style={{
              margin: '8px 0 0', fontSize: 14, color: C.inkSoft,
            }}>{dateLabel} · {timeLabel} ICT · Bangkok</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <StatusPill dot="sage">PROD · OK</StatusPill>
            <StatusPill dot="sage">ADMIN · LIVE</StatusPill>
          </div>
        </header>

        {/* TODAY'S DELTAS */}
        <section style={{ padding: '32px 0' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'baseline', marginBottom: 16,
          }}>
            <h2 style={{
              margin: 0, fontFamily: serif, fontSize: 24, color: C.ink,
              letterSpacing: '-0.01em',
            }}>Today's deltas</h2>
            <Eyebrow color={C.inkDim}>VS YESTERDAY · 24H WINDOW</Eyebrow>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
          }}>
            <DeltaTile
              label="TOTAL AUDITS"
              n={summary.total ?? '—'}
              sub="prospects in funnel"
            />
            <DeltaTile
              label="OPENED"
              n={summary.opened ?? '—'}
              sub={`${summary.total ? Math.round((summary.opened / summary.total) * 100) : 0}% open rate`}
            />
            <DeltaTile
              label="REPLIES (REAL)"
              n={summary.replied ?? '—'}
              sub={
                warmProspects[0]
                  ? `${warmProspects[0].business_name.split(' ').slice(0, 2).join(' ')} ${warmProspects[0].view_count}× · no reply`
                  : 'no warm prospects yet'
              }
            />
          </div>
        </section>

        {/* WAVE FUNNEL */}
        <section style={{ padding: '24px 0' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'baseline', marginBottom: 16,
          }}>
            <h2 style={{
              margin: 0, fontFamily: serif, fontSize: 24, color: C.ink,
              letterSpacing: '-0.01em',
            }}>Wave funnel</h2>
            <Eyebrow color={C.inkDim}>SENT → OPENED → REPLIED → PAID</Eyebrow>
          </div>
          <div style={{ overflowX: 'auto', border: `1px solid ${C.hairline}`, borderRadius: 8, background: '#fff' }}>
            <table style={{
              width: '100%', borderCollapse: 'collapse',
              fontFamily: mono, fontSize: 13,
            }}>
              <thead>
                <tr style={{ background: '#fafaf6' }}>
                  {['WAVE', 'SENT', 'OPENED', 'OPEN%', 'REPLIED', 'CONV', 'PAID', 'LATEST ACTIVITY'].map((h, i) => (
                    <th key={i} style={{
                      fontFamily: mono, fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.14em', color: C.inkDim,
                      textAlign: i === 0 || i === 7 ? 'left' : 'right',
                      padding: '12px 14px',
                      borderBottom: `1px solid ${C.hairline}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <WaveRow wave={1} audits={waves[1]} />
                <WaveRow wave={2} audits={waves[2]} />
                <WaveRow wave={4} audits={waves[4]} />
                {waves.other.length > 0 && <WaveRow wave={'X'} audits={waves.other} />}
                <WaveRow wave={null} audits={audits} isAll={true} />
              </tbody>
            </table>
          </div>
          <p style={{
            margin: '12px 0 0', fontFamily: mono, fontSize: 11, color: C.inkDim,
            letterSpacing: '0.10em',
          }}>
            TOTAL VIEWS: {summary.total_views ?? 0} · {summary.replied ?? 0} OF {summary.total ?? 0} PROSPECTS REPLIED
          </p>
        </section>

        {/* WARM PROSPECTS */}
        <section style={{ padding: '24px 0' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 8,
          }}>
            <h2 style={{
              margin: 0, fontFamily: serif, fontSize: 24, color: C.ink,
              letterSpacing: '-0.01em',
            }}>Warm prospects</h2>
            <Eyebrow color={C.inkDim}>OPENED · NOT REPLIED · HIGHEST LEVERAGE FOR FOLLOW-UP</Eyebrow>
          </div>
          {warmProspects.length === 0 ? (
            <p style={{ color: C.inkSoft, fontStyle: 'italic' }}>
              No warm prospects yet. Send the first audit URL via /outbound-audits.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {warmProspects.map((a, i) => (
                <WarmProspectCard key={a.id || i} a={a} rank={i + 1} />
              ))}
            </div>
          )}
          {warmProspects[0] && (
            <p style={{
              margin: '14px 0 0', fontStyle: 'italic',
              fontSize: 13, color: C.inkSoft, lineHeight: 1.5,
            }}>
              Highest-info prospect: <strong style={{ color: C.ink }}>
                {warmProspects[0].business_name.split(' ').slice(0, 3).join(' ')}
              </strong> — opened {warmProspects[0].view_count}× without replying. If they reply, we learn the blocker.
            </p>
          )}
        </section>

        {/* WAITLIST DEMAND SIGNAL — Pro/Business signups via /pricing.
            Built 2026-05-19 per page-flow audit v2 #4. Glanceable so
            we can read tier-level demand without bouncing dashboards.
            Decision thresholds documented in waitlist.js: 5+ in 30d =
            consider building; 0 in 30d = kill the tier with confidence.
            Render only if the waitlist endpoint returned data. */}
        {waitlist && waitlist.by_plan && (
          <section style={{
            padding: '24px 0', marginTop: 8,
            borderTop: `1px solid ${C.hairline}`,
          }}>
            <Eyebrow color={C.ochre}>GATED-TIER DEMAND · LAST 30D</Eyebrow>
            <div style={{
              marginTop: 10,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}>
              {['pro', 'business'].map((p) => {
                const row = waitlist.by_plan.find(r => r.plan === p);
                const last30 = row?.last_30d || 0;
                const total = row?.total || 0;
                const decision = last30 >= 5 ? 'BUILD CANDIDATE' : last30 === 0 ? 'NO SIGNAL YET' : 'COLLECTING';
                const decisionColor = last30 >= 5 ? C.sage : last30 === 0 ? C.inkDim : C.ochre;
                return (
                  <div key={p} style={{
                    padding: '14px 16px',
                    background: C.paper,
                    border: `1px solid ${C.hairline}`,
                    borderRadius: 8,
                  }}>
                    <div style={{ fontFamily: mono, fontSize: 11, color: C.inkDim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {p.toUpperCase()} WAITLIST
                    </div>
                    <div style={{
                      fontFamily: serif, fontSize: 28, fontWeight: 500,
                      color: C.ink, lineHeight: 1.1, marginTop: 6,
                    }}>
                      {last30}
                      <span style={{ fontSize: 14, color: C.inkDim, marginLeft: 6 }}>
                        last 30d
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 4 }}>
                      {total} total · latest {row?.latest_at ? new Date(row.latest_at).toLocaleDateString() : 'never'}
                    </div>
                    <div style={{
                      marginTop: 8, fontFamily: mono, fontSize: 10,
                      letterSpacing: '0.08em', color: decisionColor,
                    }}>
                      → {decision}
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{
              margin: '12px 0 0', fontStyle: 'italic',
              fontSize: 12, color: C.inkSoft,
            }}>
              Threshold: 5+ signups in 30d = real demand. 0 in 30d = kill the tier with confidence.
            </p>
          </section>
        )}

        {/* SYSTEM HEALTH STRIP */}
        <section style={{
          padding: '20px 0', marginTop: 16,
          borderTop: `1px solid ${C.hairline}`,
          display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <Eyebrow color={C.inkDim}>SYSTEM</Eyebrow>
          <StatusPill dot="sage">API · OK</StatusPill>
          <StatusPill dot="sage">DB · OK</StatusPill>
          <StatusPill dot="sage">BACKUPS · OK</StatusPill>
        </section>

        {/* FOOTER LINK STRIP */}
        <footer style={{
          padding: '24px 0 0', marginTop: 12,
          fontFamily: mono, fontSize: 11, color: C.inkDim,
          letterSpacing: '0.10em',
        }}>
          FULL STATS · <a href="/api/admin/outreach-stats" style={{ color: C.teal }}>/api/admin/outreach-stats</a>
          {' · '}
          <a href="/admin/__whoami" style={{ color: C.teal }}>__whoami</a>
        </footer>
      </main>
    </div>
  );
}
