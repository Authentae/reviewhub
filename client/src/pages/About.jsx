// /about — personal founder letter, NOT a corporate "About us" page.
//
// Design generated 2026-05-11 via claude.ai/design from a brief written
// after the audit-preview UX teardown (intervention #2: "we're new and
// that's the trade" + #4: founder voice forward). Built directly as a
// React component from the design screenshot — copy is verbatim from the
// brief so it matches what was approved visually.
//
// Lives on its own route at /about. Linked from:
//   - the marketing nav (under "About")
//   - the audit-preview page (when wave-5 trust intervention ships)
//   - footer "About" link

import React from 'react';
import { Link } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';
import useSocialMeta from '../hooks/useSocialMeta';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';
import Navbar from '../components/Navbar';
import { isLoggedIn } from '../lib/auth';

const C = {
  paper: '#fbf8f1',
  ink: '#1d242c',
  inkSoft: '#4a525a',
  inkDim: 'rgba(29,36,44,0.7)', /* was 0.5 -> ~#8c8e8f on cream = failed AA; 0.7 passes while staying visibly dim */
  teal: '#1e4d5e',
  tealDeep: '#163d4a',
  ochre: '#8a5e14',
  sage: '#6b8e7a',
  rose: '#c2566c',
  hairline: 'rgba(29,36,44,0.08)',
};

const serif = "'Instrument Serif', Georgia, serif";
const mono = "'JetBrains Mono', ui-monospace, monospace";
const thai = "'Noto Sans Thai', 'Sarabun', system-ui, sans-serif";

function Eyebrow({ children, color = C.ochre }) {
  return (
    <p style={{
      fontFamily: mono, fontSize: 11, fontWeight: 600,
      letterSpacing: '0.16em', textTransform: 'uppercase',
      color, margin: 0,
    }}>{children}</p>
  );
}

function PortraitPlaceholder({ size = 160 }) {
  // Soft circle with serif "E" monogram. Replace by uploading a real photo
  // and swapping this component for an <img>. Earth: see /public/founder.jpg
  // when you upload — then change this to <img src="/founder.jpg" />.
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle at 30% 30%, ${C.teal}, ${C.tealDeep} 70%)`,
      color: C.paper,
      display: 'grid', placeItems: 'center',
      fontFamily: serif, fontSize: size * 0.5, fontWeight: 400,
      flexShrink: 0,
      boxShadow: '0 18px 32px -16px rgba(20,30,40,0.30), 0 0 0 1px rgba(255,255,255,0.06) inset',
    }} aria-label="Founder portrait — Earth Singharash">E</div>
  );
}

function ReviewDraftCard() {
  return (
    <div style={{
      width: '100%', maxWidth: 380,
      background: '#fff',
      borderRadius: 16,
      border: `1px solid ${C.hairline}`,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 6px 14px rgba(20,30,40,0.06)',
      overflow: 'hidden',
    }}>
      <div style={{ height: 4, background: C.ochre }} />
      <div style={{ padding: '14px 18px 4px' }}>
        <Eyebrow>REVIEW · LILIT BANG LAMPHU · 4★</Eyebrow>
      </div>
      <div style={{ padding: '6px 18px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, #c8d5db, #1e4d5e)',
            color: '#fff', display: 'grid', placeItems: 'center',
            fontWeight: 600, fontSize: 12,
          }}>O</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: C.ink }}>Olga K.</div>
            <div style={{ fontSize: 11, color: '#8a929c' }}>2 hours ago</div>
          </div>
        </div>
        <p style={{
          margin: 0, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.55,
          color: C.inkSoft,
        }}>
          &quot;Lovely small hotel, location perfect for Old Town. Only minor
          issues — luggage hallway has no lock, floor 1 keycard needed at
          odd hours.&quot;
        </p>
      </div>
      <div style={{
        background: '#fdf8ec',
        borderTop: '1px solid rgba(192,138,62,0.18)',
        padding: '12px 18px',
      }}>
        <Eyebrow>AI DRAFT · TH</Eyebrow>
        <p style={{
          margin: '6px 0 0', fontFamily: thai,
          fontSize: 13, lineHeight: 1.65, color: C.ink,
        }}>
          ขอบคุณ Olga ที่แบ่งปันค่ะ ดีใจที่ทำเลถูกใจ — เราจะติดล็อคที่
          luggage hallway ในเดือนนี้ และจะดู keycard system ใหม่ค่ะ
        </p>
      </div>
    </div>
  );
}

function StatTile({ label, n, sub }) {
  return (
    <div style={{
      padding: '20px 22px',
      border: `1px solid ${C.hairline}`,
      borderRadius: 12,
      background: '#fff',
      flex: 1,
      minWidth: 0,
    }}>
      <Eyebrow>{label}</Eyebrow>
      <div style={{
        fontFamily: serif, fontSize: 56, lineHeight: 1, color: C.ink,
        margin: '8px 0 6px', letterSpacing: '-0.02em',
      }}>{n}</div>
      <p style={{ margin: 0, fontSize: 13, color: C.inkSoft, lineHeight: 1.45 }}>{sub}</p>
    </div>
  );
}

function CommitmentRow({ icon, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 16,
      padding: '14px 0',
      borderBottom: `1px solid ${C.hairline}`,
    }}>
      <span style={{ fontSize: 22, lineHeight: 1, marginTop: 2 }} aria-hidden="true">{icon}</span>
      <p style={{
        margin: 0, fontFamily: serif, fontSize: 20, lineHeight: 1.4,
        color: C.ink, letterSpacing: '-0.005em',
      }}>{children}</p>
    </div>
  );
}

function ContactCard({ label, value, href }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      style={{
        display: 'block', padding: '18px 20px',
        border: `1px solid ${C.hairline}`, borderRadius: 12,
        background: '#fff', textDecoration: 'none',
        flex: 1, minWidth: 0,
        transition: 'transform .15s ease, box-shadow .2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 18px -10px rgba(20,30,40,0.18)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <Eyebrow>{label}</Eyebrow>
      <div style={{
        marginTop: 6, fontFamily: serif, fontSize: 22, color: C.ink,
        letterSpacing: '-0.01em', wordBreak: 'break-all',
      }}>{value}</div>
    </a>
  );
}

export default function About() {
  usePageTitle('About · Earth · ReviewHub');
  useSocialMeta({
    title: 'About the founder · ReviewHub',
    description: 'Solo founder building ReviewHub from Bangkok. Why this tool exists, how it helps businesses get more Google reviews, and how to reach me directly.',
  });
  const loggedIn = isLoggedIn();

  return (
    <div style={{ background: C.paper, color: C.ink, minHeight: '100vh' }}>
      {loggedIn ? <Navbar /> : <MarketingNav />}

      <main
        style={{
          maxWidth: 880, margin: '0 auto',
          padding: '64px 24px 96px',
        }}
      >
        {/* HERO */}
        <section style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: 40, alignItems: 'center',
          paddingBottom: 56,
          borderBottom: `1px solid ${C.hairline}`,
        }} className="rh-about-hero">
          <div>
            <Eyebrow>A LETTER FROM THE FOUNDER · BANGKOK · 2026</Eyebrow>
            <h1 style={{
              fontFamily: serif, fontSize: 'clamp(40px, 6vw, 64px)',
              lineHeight: 1.04, letterSpacing: '-0.015em',
              color: C.ink, margin: '20px 0 18px',
            }}>I'm building ReviewHub from Bangkok.</h1>
            <p style={{
              margin: 0, fontSize: 20, lineHeight: 1.5, color: C.inkSoft,
              maxWidth: 540,
            }}>
              Solo founder, pre-revenue, shipping in public. Here's what
              that means for you.
            </p>
            <div style={{ marginTop: 28, display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <span style={{
                fontFamily: serif, fontSize: 22, color: C.ink,
                letterSpacing: '-0.01em',
              }}>Earth · Singharash</span>
              <Eyebrow color={C.inkDim}>FOUNDER</Eyebrow>
            </div>
          </div>
          <PortraitPlaceholder />
        </section>

        {/* WHY I'M BUILDING THIS */}
        <section style={{ padding: '56px 0', borderBottom: `1px solid ${C.hairline}` }}>
          <Eyebrow>WHY I'M BUILDING THIS</Eyebrow>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 0.85fr)',
            gap: 36, alignItems: 'start', marginTop: 18,
          }} className="rh-about-two-col">
            <p style={{
              margin: 0, fontFamily: serif, fontSize: 22, lineHeight: 1.55,
              color: C.ink, letterSpacing: '-0.005em',
            }}>
              I noticed something working in Bangkok hospitality: small
              owners barely get reviews, and reply to maybe 1 in 4 of the
              ones they do. The reviews don't come because happy customers
              mean to leave one, then forget. So ReviewHub sends your
              customers a one-tap reminder, and the reviews you've earned
              actually show up. Then it drafts your reply in your voice, in
              the language the customer wrote, ready on LINE in 30 seconds.
              Getting more reviews is the main job. The drafting is the
              bonus.
            </p>
            <ReviewDraftCard />
          </div>
        </section>

        {/* WHERE WE ARE TODAY */}
        <section style={{ padding: '56px 0', borderBottom: `1px solid ${C.hairline}` }}>
          <Eyebrow>AS OF MAY 2026</Eyebrow>
          <h2 style={{
            fontFamily: serif, fontSize: 36, lineHeight: 1.1,
            color: C.ink, margin: '16px 0 28px', letterSpacing: '-0.015em',
          }}>Where we are today.</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16, marginBottom: 28,
          }}>
            <StatTile label="CUSTOMERS PAYING" n="0" sub="Acknowledging it." />
            <StatTile label="FREE SIGNUPS" n="17" sub="Welcome." />
            <StatTile label="BUILDING IN PUBLIC SINCE" n="Apr 2026" sub="Track at /roadmap." />
          </div>
          <p style={{
            margin: 0, fontSize: 17, lineHeight: 1.6, color: C.inkSoft,
            maxWidth: 640,
          }}>
            We're pre-revenue. That means if you become one of my first 50
            paying customers, you'd get founder-level access — direct
            email, feature priority, no SaaS-support-bot. The trade is:
            you're trusting an early product. If that's not your fit, that's
            fair. If it is, you'd be helping shape what ships next.
          </p>
        </section>

        {/* WHAT I COMMIT TO */}
        <section style={{ padding: '56px 0', borderBottom: `1px solid ${C.hairline}` }}>
          <Eyebrow>WHAT I COMMIT TO</Eyebrow>
          <div style={{ marginTop: 18 }}>
            <CommitmentRow icon="📩">
              I reply to every email myself, within 24h.
            </CommitmentRow>
            <CommitmentRow icon="🔧">
              I ship something every week (track at{' '}
              <Link to="/roadmap" style={{ color: C.teal, textDecoration: 'underline' }}>/roadmap</Link>).
            </CommitmentRow>
            <CommitmentRow icon="📤">
              If you cancel, I refund the current month, no questions.
            </CommitmentRow>
          </div>
        </section>

        {/* THE NEXT 90 DAYS */}
        <section style={{ padding: '56px 0', borderBottom: `1px solid ${C.hairline}` }}>
          <Eyebrow>WHAT'S NEXT</Eyebrow>
          <h2 style={{
            fontFamily: serif, fontSize: 36, lineHeight: 1.1,
            color: C.ink, margin: '16px 0 24px', letterSpacing: '-0.015em',
          }}>The next 90 days.</h2>
          <ul style={{
            margin: 0, paddingLeft: 0, listStyle: 'none',
            fontFamily: serif, fontSize: 20, lineHeight: 1.6, color: C.ink,
          }}>
            {[
              'Google Business Profile API approval lands → one-tap auto-post.',
              'More platforms: Yelp, TripAdvisor, Wongnai.',
              'Languages 11–20: Korean, Bahasa Indonesia, Vietnamese.',
            ].map((line, i) => (
              <li key={i} style={{
                display: 'flex', gap: 14, alignItems: 'baseline',
                padding: '10px 0',
                borderTop: i === 0 ? `1px solid ${C.hairline}` : 'none',
                borderBottom: `1px solid ${C.hairline}`,
              }}>
                <span style={{
                  fontFamily: mono, fontSize: 11, color: C.ochre, fontWeight: 600,
                  letterSpacing: '0.14em', minWidth: 28,
                }}>0{i + 1}</span>
                <span style={{ letterSpacing: '-0.005em' }}>{line}</span>
              </li>
            ))}
          </ul>
          <p style={{
            margin: '20px 0 0', fontSize: 13, color: C.inkDim, fontStyle: 'italic',
          }}>
            Roadmap lives at{' '}
            <Link to="/roadmap" style={{ color: C.teal, textDecoration: 'underline' }}>reviewhub.review/roadmap</Link>
          </p>
        </section>

        {/* HOW TO REACH ME */}
        <section style={{ padding: '56px 0', borderBottom: `1px solid ${C.hairline}` }}>
          <Eyebrow>HOW TO REACH ME</Eyebrow>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16, marginTop: 18,
          }}>
            <ContactCard
              label="EMAIL"
              value="earth@reviewhub.review"
              href="mailto:earth@reviewhub.review"
            />
            <ContactCard
              label="X (TWITTER)"
              value="@reviewhubreview"
              href="https://x.com/reviewhubreview"
            />
            <ContactCard
              label="BUILD IN PUBLIC"
              value="github.com/Authentae"
              href="https://github.com/Authentae/reviewhub"
            />
          </div>
        </section>

        {/* SIGN-OFF */}
        <section style={{ padding: '56px 0 0', textAlign: 'center' }}>
          <p style={{
            margin: 0, fontFamily: serif, fontSize: 24, fontStyle: 'italic',
            color: C.inkSoft, letterSpacing: '-0.005em',
          }}>
            Thanks for reading this far. — Earth
          </p>
        </section>
      </main>

      {/* responsive overrides — hero collapses to single column on mobile */}
      <style>{`
        @media (max-width: 720px) {
          .rh-about-hero { grid-template-columns: 1fr !important; gap: 24px !important; }
          .rh-about-hero > div:last-child { justify-self: start; }
          .rh-about-two-col { grid-template-columns: 1fr !important; gap: 24px !important; }
        }
      `}</style>

      <MarketingFooter />
    </div>
  );
}
