// /integrations — what ReviewHub connects to.
//
// Built 2026-05-20 per overnight queue item #2. Answers the "what does
// your product actually do" question cleanly, so Pricing FAQ doesn't have
// to. Lemon Squeezy explicitly asked for this during merchant onboarding,
// and every future enterprise/agency buyer will too.
//
// Content is global by design — we serve businesses worldwide via 60+
// CSV platforms + multi-channel chat (LINE / Telegram / WhatsApp coming).
// Do NOT collapse the framing to Bangkok hospitality.
//
// Linked from MarketingFooter under Product.

import React from 'react';
import { Link } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';
import useSocialMeta from '../hooks/useSocialMeta';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';

const C = {
  paper: '#fbf8f1',
  ink: '#1d242c',
  inkSoft: '#4a525a',
  inkDim: 'rgba(29,36,44,0.5)',
  teal: '#1e4d5e',
  tealDeep: '#163d4a',
  ochre: '#c08a3e',
  sage: '#6b8e7a',
  rose: '#c2566c',
  hairline: 'rgba(29,36,44,0.08)',
};
const serif = "'Instrument Serif', Georgia, serif";
const mono = "'JetBrains Mono', ui-monospace, monospace";

function Eyebrow({ children, color = C.ochre }) {
  return (
    <p style={{
      fontFamily: mono, fontSize: 11, fontWeight: 600,
      letterSpacing: '0.16em', textTransform: 'uppercase',
      color, margin: '0 0 14px',
    }}>{children}</p>
  );
}

function StatusBadge({ status }) {
  // status: 'live' | 'beta' | 'roadmap'
  const map = {
    live:    { label: 'LIVE',    bg: C.sage,  fg: '#fff' },
    beta:    { label: 'BETA',    bg: C.ochre, fg: '#fff' },
    roadmap: { label: 'ROADMAP', bg: 'rgba(29,36,44,0.08)', fg: C.inkSoft },
  };
  const m = map[status] || map.live;
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 9px', borderRadius: 4,
      fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
      background: m.bg, color: m.fg,
      verticalAlign: 'middle', marginLeft: 10,
    }}>{m.label}</span>
  );
}

function Integration({ name, status, body }) {
  return (
    <div style={{
      padding: '24px 0',
      borderTop: `1px solid ${C.hairline}`,
    }}>
      <h3 style={{
        fontFamily: serif, fontSize: 24, fontWeight: 500,
        color: C.ink, margin: '0 0 10px', lineHeight: 1.15,
      }}>
        {name}<StatusBadge status={status} />
      </h3>
      <div style={{
        fontSize: 15.5, lineHeight: 1.65, color: C.inkSoft,
      }}>
        {body}
      </div>
    </div>
  );
}

function H2({ children }) {
  return (
    <h2 style={{
      fontFamily: serif, fontSize: 32, fontWeight: 500,
      lineHeight: 1.15, letterSpacing: '-0.01em',
      color: C.ink, margin: '0 0 12px',
    }}>{children}</h2>
  );
}

export default function Integrations() {
  usePageTitle('Integrations — ReviewHub');
  useSocialMeta({
    title: 'Integrations — ReviewHub',
    description: 'What ReviewHub connects to: Google Business Profile, LINE OA, Telegram, WhatsApp (coming), CSV import for 60+ review platforms, and email forwarding for Booking / Airbnb / TripAdvisor.',
  });

  return (
    <div style={{ background: C.paper, color: C.ink, minHeight: '100vh' }}>
      <MarketingNav />

      <main style={{
        maxWidth: 760, margin: '0 auto', padding: '64px 24px 32px',
      }}>
        {/* HERO */}
        <header style={{ marginBottom: 40 }}>
          <Eyebrow>INTEGRATIONS · WHAT WE CONNECT TO</Eyebrow>
          <h1 style={{
            fontFamily: serif, fontSize: 'clamp(36px, 5vw, 52px)',
            fontWeight: 400, lineHeight: 1.1, letterSpacing: '-0.015em',
            color: C.ink, margin: '0 0 18px',
          }}>
            Reviews come in. Drafts go to your chat. Replies post to the platform.
          </h1>
          <p style={{
            fontSize: 18, lineHeight: 1.55, color: C.inkSoft,
            margin: 0, maxWidth: 620,
          }}>
            The full list of what ReviewHub talks to — review platforms
            on one side, chat apps on the other. Anything not in the
            list, we don't touch yet.
          </p>
        </header>

        {/* REVIEW SOURCES */}
        <section style={{ marginBottom: 56 }}>
          <Eyebrow color={C.teal}>WHERE REVIEWS COME IN</Eyebrow>
          <H2>Six ways to get your reviews into ReviewHub.</H2>

          <Integration
            name="Google Business Profile"
            status="live"
            body={
              <>
                <p style={{ margin: '0 0 10px' }}>
                  Two paths, picked automatically based on your account:
                </p>
                <ul style={{ margin: '0 0 0 22px', padding: 0 }}>
                  <li style={{ marginBottom: 6 }}>
                    <strong style={{ color: C.ink }}>Business Profile API v4</strong> — the
                    full sync. Requires Google's allow-list approval (we have
                    it). New reviews appear in your feed within 30 minutes.
                  </li>
                  <li>
                    <strong style={{ color: C.ink }}>Places API (NEW) v1 fallback</strong> — read-only.
                    Activates when allow-list approval isn't in place. Polls
                    your profile every 30 minutes. Works the same for you.
                  </li>
                </ul>
              </>
            }
          />

          <Integration
            name="CSV import — for the platforms we don't auto-poll"
            status="live"
            body={
              <>
                <p style={{ margin: '0 0 10px' }}>
                  Google is the only platform we auto-poll today. For every
                  other review platform, export to CSV, drop it in, and
                  ReviewHub parses + dedups + drafts. Works on every plan.
                </p>
                <p style={{
                  margin: '0 0 10px', fontFamily: mono, fontSize: 13,
                  color: C.inkSoft, lineHeight: 1.7,
                }}>
                  Confirmed working: Yelp · Facebook · TripAdvisor · Trustpilot ·
                  Booking.com · Airbnb · Wongnai · Tabelog · Naver · Dianping ·
                  TheFork · OpenTable · Klook · Hostelworld · Expedia ·
                  Hotels.com · Agoda · Traveloka · HolidayCheck · Reclame Aqui.
                </p>
                <p style={{ margin: 0, fontSize: 14, color: C.inkSoft }}>
                  Your platform not in the list? Drop us a sample CSV at{' '}
                  <a href="mailto:integrations@reviewhub.review" style={{
                    color: C.teal, textDecoration: 'underline', textUnderlineOffset: 3,
                  }}>integrations@reviewhub.review</a>{' '}— most additions ship in 1-2 days.
                </p>
              </>
            }
          />

          <Integration
            name="Email forward — Booking / Airbnb / TripAdvisor / others"
            status="live"
            body={
              <>
                <p style={{ margin: '0 0 10px' }}>
                  Set a forward rule on your Google Workspace inbox to send
                  new-review notification emails to your unique{' '}
                  <code style={{
                    fontFamily: mono, fontSize: 13,
                    background: 'rgba(29,36,44,0.06)',
                    padding: '2px 6px', borderRadius: 4,
                  }}>reviews+yoursecret@reviewhub.review</code>{' '}
                  address. We parse the email, extract the review, and insert
                  it into your dashboard.
                </p>
                <p style={{ margin: 0 }}>
                  Works for platforms with closed APIs that don't let us pull
                  reviews directly. The address shows up in Settings once
                  you've connected at least one business.
                </p>
              </>
            }
          />
        </section>

        {/* CHAT CHANNELS */}
        <section style={{ marginBottom: 56 }}>
          <Eyebrow color={C.teal}>WHERE DRAFTS LAND</Eyebrow>
          <H2>Pick the chat app you already live in.</H2>
          <p style={{
            fontSize: 16, lineHeight: 1.6, color: C.inkSoft,
            margin: '0 0 8px', maxWidth: 620,
          }}>
            We push every new review to your chat with the AI-drafted reply
            ready to copy-paste. No new app to open, no dashboard to remember.
          </p>

          <Integration
            name="LINE Official Account"
            status="live"
            body={
              <p style={{ margin: 0 }}>
                For owners in Asia (especially Thailand, Japan, Taiwan). Connect
                in Settings with a one-time link code. Push notifications via
                LINE Flex Cards — the draft reply renders inline, you tap to
                copy, paste in Google.
              </p>
            }
          />

          <Integration
            name="Telegram Bot"
            status="live"
            body={
              <p style={{ margin: 0 }}>
                For owners worldwide who use Telegram for business. Same flow as
                LINE — link in Settings, every new review pings you with the
                draft. Telegram's reach is global (heavy in tech, EU, LATAM,
                MENA) so this is the default outside Asia.
              </p>
            }
          />

          <Integration
            name="WhatsApp Business"
            status="roadmap"
            body={
              <p style={{ margin: 0 }}>
                Coming Q3 2026 via the WhatsApp Business Cloud API. WhatsApp is
                the dominant chat app in most of LATAM, India, Africa, and parts
                of Europe — this opens the product to the rest of the world
                where LINE and Telegram are less common.
              </p>
            }
          />

          <Integration
            name="Email digest"
            status="live"
            body={
              <p style={{ margin: 0 }}>
                If you'd rather batch reviews than get a push per review, the
                weekly digest email rolls everything up Monday mornings — with
                drafts inline. Works alongside or instead of LINE/Telegram.
              </p>
            }
          />
        </section>

        {/* AI + DRAFTING */}
        <section style={{ marginBottom: 56 }}>
          <Eyebrow color={C.teal}>WHO DRAFTS THE REPLIES</Eyebrow>
          <H2>Anthropic Claude, in 10 languages.</H2>
          <p style={{
            fontSize: 16, lineHeight: 1.65, color: C.inkSoft, margin: '0 0 14px',
          }}>
            Every draft is generated by Anthropic Claude. The model receives the
            review text + your business name + your selected tone (warm /
            concise / formal) and returns a draft. <strong style={{ color: C.ink }}>
            Anthropic does not train on our inputs.</strong> Drafts ship in
            English, Thai, Japanese, Korean, Chinese (Simplified), Spanish,
            French, German, Portuguese, and Italian — auto-detected from the
            review's language or set by you.
          </p>
          <p style={{
            fontSize: 16, lineHeight: 1.65, color: C.inkSoft, margin: 0,
          }}>
            Industry-specific guardrails are built in for regulated verticals.
            Dental and medical drafts never confirm patient identity or
            treatment specifics (PHI safe). Legal drafts avoid client-attorney
            details. Adding more verticals on request.
          </p>
        </section>

        {/* DON'T SEE YOURS */}
        <section style={{
          padding: '40px 32px',
          background: 'rgba(192,138,62,0.06)',
          borderRadius: 16,
          marginBottom: 40,
        }}>
          <Eyebrow color={C.ochre}>DON'T SEE YOUR PLATFORM?</Eyebrow>
          <H2>Tell us. We'll add it.</H2>
          <p style={{
            fontSize: 16, lineHeight: 1.65, color: C.inkSoft, margin: '0 0 18px',
          }}>
            Email{' '}
            <a href="mailto:integrations@reviewhub.review" style={{
              color: C.teal, textDecoration: 'underline', textUnderlineOffset: 3,
            }}>integrations@reviewhub.review</a>{' '}
            with the platform name + a sample notification email (if it's an
            email-forward play) or a link to their public reviews export
            (if CSV). Most additions take 1-2 days.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/audit-demo" style={{
              background: C.teal, color: C.paper,
              padding: '12px 22px', borderRadius: 10,
              fontWeight: 600, fontSize: 15,
              textDecoration: 'none',
            }}>See a sample audit</Link>
            <Link to="/trust" style={{
              background: 'transparent', color: C.teal,
              padding: '12px 22px', borderRadius: 10,
              fontWeight: 600, fontSize: 15,
              textDecoration: 'none',
              border: `1px solid ${C.teal}`,
            }}>What we access (Trust)</Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
