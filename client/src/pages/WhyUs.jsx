// /why-us — the manifesto page. Different audience than Landing.
//
// Landing pitches the product. This page tells you what we believe
// about review replies, and why those beliefs shaped the tool. People
// who land here are at the "do I agree with their philosophy" stage —
// usually 1-2 page-views deep, weighing whether to trust us.
//
// Built 2026-05-20 per overnight queue item #7. Linked from
// MarketingFooter under Company.
//
// Voice: first-person plural ("we") to keep it founder-flavored without
// surfacing names. Per Earth's preference 2026-05-20, no personal names
// appear in user-facing copy.

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
  ochre: '#8a5e14',
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

function Belief({ num, title, children }) {
  return (
    <section style={{
      padding: '40px 0',
      borderBottom: `1px solid ${C.hairline}`,
    }}>
      <div style={{
        display: 'flex', gap: 20, alignItems: 'baseline', marginBottom: 14,
      }}>
        <span style={{
          fontFamily: mono, fontSize: 13, fontWeight: 700,
          color: C.ochre, letterSpacing: '0.12em',
          flexShrink: 0, minWidth: 32,
        }}>{num}</span>
        <h2 style={{
          fontFamily: serif, fontSize: 28, fontWeight: 500,
          lineHeight: 1.2, letterSpacing: '-0.01em',
          color: C.ink, margin: 0,
        }}>{title}</h2>
      </div>
      <div style={{
        fontSize: 16.5, lineHeight: 1.7, color: C.inkSoft,
        paddingLeft: 52,
      }}>
        {children}
      </div>
    </section>
  );
}

export default function WhyUs() {
  usePageTitle('Why we built this — ReviewHub');
  useSocialMeta({
    title: 'Why we built this — ReviewHub',
    description: 'Five beliefs about Google review replies that shaped the tool: ChatGPT-paste doesn\'t scale, voice consistency matters, privacy is a feature, ambient triggers beat dashboards, and small is the right size to build it.',
  });

  return (
    <div style={{ background: C.paper, color: C.ink, minHeight: '100vh' }}>
      <MarketingNav />

      <main style={{
        maxWidth: 720, margin: '0 auto', padding: '64px 24px 32px',
      }}>
        {/* HERO */}
        <header style={{ marginBottom: 32 }}>
          <Eyebrow>WHY WE BUILT THIS</Eyebrow>
          <h1 style={{
            fontFamily: serif, fontSize: 'clamp(36px, 5vw, 52px)',
            fontWeight: 400, lineHeight: 1.1, letterSpacing: '-0.015em',
            color: C.ink, margin: '0 0 20px',
          }}>
            Five beliefs about replies that shaped the tool.
          </h1>
          <p style={{
            fontSize: 18, lineHeight: 1.6, color: C.inkSoft,
            margin: 0, maxWidth: 600,
          }}>
            Most review-reply tools sound like enterprise software. We
            built ReviewHub by holding five specific opinions about how
            owners actually live with reviews. If any of these don't
            ring true, the product probably isn't for you.
          </p>
        </header>

        <Belief num="01" title="ChatGPT-paste doesn't scale.">
          <p style={{ margin: '0 0 14px' }}>
            One review a week? ChatGPT is fine. Paste the review, give
            it three sentences of context, copy the draft back. Done in
            two minutes. We're not pretending otherwise.
          </p>
          <p style={{ margin: 0 }}>
            Five reviews a week is where it starts to break. Ten reviews
            a week and the workflow tax stops being "a chore" and starts
            being "the thing you'll handle on Saturday" — which means
            never. We built an ambient trigger that pings your phone the
            moment a review lands, with the draft already written. The
            jump from 2 minutes per reply to 10 seconds is the only
            interesting product question for owners doing this at volume.
          </p>
        </Belief>

        <Belief num="02" title="Voice consistency matters more than perfection.">
          <p style={{ margin: '0 0 14px' }}>
            A reader scrolling your Google reviews notices when reply
            #14 sounds nothing like reply #15. Two different voices
            reads as "a corporate replier" or worse, "a bot." Neither
            builds trust.
          </p>
          <p style={{ margin: 0 }}>
            ChatGPT starts every conversation from zero. We don't. The
            system remembers your tone across reviews, the words you
            actually use, the things you'd never say. Your fourteenth
            reply sounds like the same person who wrote the first.
          </p>
        </Belief>

        <Belief num="03" title="Privacy is a feature, not a checkbox.">
          <p style={{ margin: '0 0 14px' }}>
            Most SaaS pages have a "Privacy" link at the bottom and
            assume nobody reads it. We wrote a{' '}
            <Link to="/trust" style={{
              color: C.teal, textDecoration: 'underline', textUnderlineOffset: 3,
            }}>Trust & data access page</Link>{' '}
            that lists exactly what we touch via Google OAuth (two
            things) and what we never touch (Gmail, Calendar, Drive,
            Contacts, other businesses).
          </p>
          <p style={{ margin: 0 }}>
            We don't train AI on your data. We name every sub-processor.
            Reading the page before you click Connect is the point —
            we'd rather you ask first than connect and regret. People
            with regulated businesses (medical, dental, legal) have
            opinions about this, and those opinions are usually right.
          </p>
        </Belief>

        <Belief num="04" title="Ambient triggers beat dashboards.">
          <p style={{ margin: '0 0 14px' }}>
            The "log into a dashboard every Monday" model loses to the
            "ping me where I already am" model — every time. Your team
            already lives in LINE, Telegram, WhatsApp (coming), or
            email. So that's where new reviews land.
          </p>
          <p style={{ margin: 0 }}>
            No app to remember. No tab to keep open. The push notification
            IS the workflow: you see the review, you see the draft, you
            tap to copy, you paste in Google. Total elapsed time: under
            a minute. That's only possible if the tool lives where you
            already do.
          </p>
        </Belief>

        <Belief num="05" title="Small is the right size to build this.">
          <p style={{ margin: '0 0 14px' }}>
            The biggest review-management platforms are enterprise tools
            for chains with 50+ locations. They have features we'll
            never need and prices a solo café owner can't justify.
          </p>
          <p style={{ margin: 0 }}>
            We're a solo team building for solo owners. The founder
            personally reads every support ticket, activates every
            paid account, and ships the next change based on what
            customers actually ask for. When you email us, a real
            person answers. That's a feature too — not a temporary
            stage we're trying to grow out of.
          </p>
        </Belief>

        {/* CTA */}
        <section style={{ padding: '56px 0 0', textAlign: 'center' }}>
          <Eyebrow color={C.teal}>STILL READING?</Eyebrow>
          <p style={{
            fontFamily: serif, fontSize: 22, lineHeight: 1.45,
            color: C.ink, margin: '0 0 28px', maxWidth: 520,
            marginLeft: 'auto', marginRight: 'auto',
            fontStyle: 'italic',
          }}>
            The fastest way to feel any of this is to try the demo —
            no signup, no card, just a sample audit with a tone switcher
            on real-shaped reviews.
          </p>
          <div style={{
            display: 'flex', gap: 12, flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
            <Link to="/audit-demo" style={{
              background: C.teal, color: C.paper,
              padding: '14px 26px', borderRadius: 10,
              fontWeight: 600, fontSize: 15,
              textDecoration: 'none',
            }}>See the demo →</Link>
            <Link to="/integrations" style={{
              background: 'transparent', color: C.teal,
              padding: '14px 26px', borderRadius: 10,
              fontWeight: 600, fontSize: 15,
              textDecoration: 'none',
              border: `1px solid ${C.teal}`,
            }}>What we integrate with</Link>
            <Link to="/trust" style={{
              background: 'transparent', color: C.teal,
              padding: '14px 26px', borderRadius: 10,
              fontWeight: 600, fontSize: 15,
              textDecoration: 'none',
              border: `1px solid ${C.teal}`,
            }}>Trust & data access</Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
