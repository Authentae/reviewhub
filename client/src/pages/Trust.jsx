// /trust — the page a hesitant prospect reads BEFORE clicking through Google
// OAuth, asking "is it safe to give this tool review-management permissions?"
//
// Built 2026-05-20 per overnight queue item #1. Closes the #1 customer-flow
// friction identified in the 2026-05-20 strategic audit: pre-OAuth trust gap.
// The page lists what we access, what we DON'T access, our data policy, and
// where data lives — all honest, all conservative. Reduces the "wait, why?"
// hesitation that bounces visitors before they connect their account.
//
// Linked from MarketingFooter under "Company". Designed to match the
// editorial brand: rh-paper bg, Instrument Serif headlines, Inter body,
// JetBrains Mono eyebrows, ochre accents.

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

function H2({ children }) {
  return (
    <h2 style={{
      fontFamily: serif, fontSize: 32, fontWeight: 500,
      lineHeight: 1.15, letterSpacing: '-0.01em',
      color: C.ink, margin: '0 0 16px',
    }}>{children}</h2>
  );
}

function Section({ children, style = {} }) {
  return (
    <section style={{
      padding: '56px 0',
      borderBottom: `1px solid ${C.hairline}`,
      ...style,
    }}>{children}</section>
  );
}

function CheckRow({ ok, label, detail }) {
  return (
    <li style={{
      display: 'flex', gap: 14, alignItems: 'flex-start',
      padding: '14px 0',
      borderTop: `1px solid ${C.hairline}`,
      listStyle: 'none',
    }}>
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 22, height: 22, borderRadius: '50%',
          background: ok ? C.sage : C.rose,
          color: '#fff',
          display: 'grid', placeItems: 'center',
          fontFamily: mono, fontSize: 12, fontWeight: 700,
          marginTop: 2,
        }}
      >{ok ? '✓' : '✕'}</span>
      <div>
        <div style={{
          fontWeight: 600, fontSize: 15, color: C.ink, marginBottom: 4,
        }}>{label}</div>
        <div style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.55 }}>
          {detail}
        </div>
      </div>
    </li>
  );
}

export default function Trust() {
  usePageTitle('Trust & data access — ReviewHub');
  useSocialMeta({
    title: 'Trust & data access — ReviewHub',
    description: 'Exactly what ReviewHub accesses via Google OAuth, what we never touch, and where your data lives. Honest and conservative — built so you can read it before you click Connect.',
  });

  return (
    <div style={{ background: C.paper, color: C.ink, minHeight: '100vh' }}>
      <MarketingNav />

      <main style={{
        maxWidth: 760, margin: '0 auto', padding: '64px 24px 32px',
      }}>
        {/* HERO */}
        <header style={{ marginBottom: 24 }}>
          <Eyebrow>TRUST · DATA ACCESS · 2026-05-20</Eyebrow>
          <h1 style={{
            fontFamily: serif, fontSize: 'clamp(36px, 5vw, 52px)',
            fontWeight: 400, lineHeight: 1.1, letterSpacing: '-0.015em',
            color: C.ink, margin: '0 0 18px',
          }}>
            What we access. What we never touch.
          </h1>
          <p style={{
            fontSize: 18, lineHeight: 1.55, color: C.inkSoft,
            margin: 0, maxWidth: 600,
          }}>
            Before you click <em>Connect Google</em>, here's exactly what
            ReviewHub does with your account, and the things we deliberately
            stay out of. Read it. If anything feels off, don't connect.
          </p>
        </header>

        {/* WHAT WE ACCESS */}
        <Section>
          <Eyebrow color={C.teal}>VIA GOOGLE OAUTH — WHAT WE READ + WRITE</Eyebrow>
          <H2>Two things, no more.</H2>
          <ul style={{ padding: 0, margin: '20px 0 0' }}>
            <CheckRow
              ok
              label="Read your business's review list"
              detail="So we can show you new reviews as they arrive on your Google Business Profile. We never read reviews of other businesses, and we never read any other Google data."
            />
            <CheckRow
              ok
              label="Post a reply you've approved"
              detail="Only after you tap 'Post reply' inside ReviewHub. We never auto-post. Every reply is reviewed by you first, every time."
            />
          </ul>
        </Section>

        {/* WHAT WE DON'T ACCESS */}
        <Section>
          <Eyebrow color={C.rose}>VIA GOOGLE OAUTH — WHAT WE NEVER TOUCH</Eyebrow>
          <H2>Things people worry about, but we don't request.</H2>
          <ul style={{ padding: 0, margin: '20px 0 0' }}>
            <CheckRow
              ok={false}
              label="Your Gmail inbox or sent mail"
              detail="We don't request Gmail scopes. We can't read your emails, your contacts, or anything you send."
            />
            <CheckRow
              ok={false}
              label="Google Calendar, Drive, Photos, Contacts"
              detail="Not requested, not accessible. The only Google API we connect to is Business Profile, and only for reviews."
            />
            <CheckRow
              ok={false}
              label="Reviews of any business that isn't yours"
              detail="The OAuth scope is locked to businesses you own or manage. We literally can't see other businesses' reviews even if we wanted to."
            />
            <CheckRow
              ok={false}
              label="Your Google search history, ads data, or analytics"
              detail="Different APIs entirely. Not on our request list."
            />
          </ul>
        </Section>

        {/* DATA POLICY */}
        <Section>
          <Eyebrow color={C.teal}>DATA POLICY</Eyebrow>
          <H2>Where your data lives, and what we do with it.</H2>
          <ul style={{ padding: 0, margin: '20px 0 0' }}>
            <CheckRow
              ok
              label="Stored on Railway (US/EU regions), SQLite database"
              detail="Encrypted at rest. Backups every 24 hours. We can export your data to JSON at any time from Settings → Your data."
            />
            <CheckRow
              ok
              label="Reply drafts generated by Anthropic Claude"
              detail="The review text + your business name are sent to Anthropic's API to generate the draft. Anthropic does not train on API inputs (per their data policy). We don't store the prompt — only the draft you see."
            />
            <CheckRow
              ok
              label="We do NOT train any AI on your data"
              detail="No fine-tuning, no model training, no aggregate analysis of your replies. Your reviews and your business context stay yours."
            />
            <CheckRow
              ok
              label="No selling, no sharing with advertisers"
              detail="We have no advertising partnerships and no plans for any. The business model is subscription revenue — that's it."
            />
          </ul>
        </Section>

        {/* DELETE */}
        <Section>
          <Eyebrow color={C.ochre}>DELETION</Eyebrow>
          <H2>You can leave at any time, and take your data with you.</H2>
          <p style={{
            fontSize: 16, lineHeight: 1.65, color: C.inkSoft, margin: '20px 0 0',
          }}>
            From <strong style={{ color: C.ink }}>Settings → Your data</strong>:
            export a complete JSON dump of everything we have on you.
            From <strong style={{ color: C.ink }}>Settings → Danger zone</strong>:
            delete your account. Deletion cascades — every review, every draft,
            every audit log entry tied to you is removed within 24 hours.
          </p>
          <p style={{
            fontSize: 16, lineHeight: 1.65, color: C.inkSoft, margin: '14px 0 0',
          }}>
            If you'd rather have a human walk you through it: email{' '}
            <a href="mailto:privacy@reviewhub.review" style={{
              color: C.teal, textDecoration: 'underline', textUnderlineOffset: 3,
            }}>privacy@reviewhub.review</a> and we'll do it together.
          </p>
        </Section>

        {/* SUB-PROCESSORS */}
        <Section>
          <Eyebrow color={C.teal}>SUB-PROCESSORS</Eyebrow>
          <H2>The handful of vendors who see slices of your data.</H2>
          <p style={{
            fontSize: 16, lineHeight: 1.65, color: C.inkSoft, margin: '20px 0 14px',
          }}>
            These are the only third parties that ever touch your data. Each
            one is named, each one has a specific role, none of them know
            anything about you outside their role.
          </p>
          <div style={{ display: 'grid', gap: 14, marginTop: 8 }}>
            {[
              ['Anthropic', 'Generates AI reply drafts. Receives review text + your business name. Does not train on inputs.'],
              ['Railway', 'Hosts the app + the SQLite database. Encrypted at rest, US/EU regions.'],
              ['Cloudflare', 'CDN + DNS + edge security. Sees request metadata (IP, URL), no body content beyond what static caching needs.'],
              ['Resend', 'Sends transactional + digest emails (welcome, weekly impact, etc.). Receives your email address and the email body we send.'],
              ['Lemon Squeezy', 'Merchant of record for paid plans. Handles all billing. We never see your card; they handle PCI compliance.'],
              ['LINE / Telegram / WhatsApp (when launched)', 'Delivers push notifications when a new review arrives. We pass the review text + reply draft. They don\'t store our message content beyond delivery.'],
            ].map(([name, role]) => (
              <div key={name} style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(140px, 200px) 1fr',
                gap: 18, alignItems: 'baseline',
                paddingBottom: 14,
                borderBottom: `1px solid ${C.hairline}`,
              }}>
                <div style={{
                  fontFamily: mono, fontSize: 13, fontWeight: 600,
                  color: C.ink, letterSpacing: '0.02em',
                }}>{name}</div>
                <div style={{
                  fontSize: 14.5, lineHeight: 1.55, color: C.inkSoft,
                }}>{role}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* QUESTIONS */}
        <Section style={{ borderBottom: 'none' }}>
          <Eyebrow color={C.teal}>STILL HESITANT?</Eyebrow>
          <H2>Ask. We'd rather you ask than connect and regret.</H2>
          <p style={{
            fontSize: 16, lineHeight: 1.65, color: C.inkSoft, margin: '20px 0 14px',
          }}>
            <a href="mailto:security@reviewhub.review" style={{
              color: C.teal, textDecoration: 'underline', textUnderlineOffset: 3,
            }}>security@reviewhub.review</a> — for anything about access,
            scopes, or data handling. The founder reads every one.
          </p>
          <p style={{
            fontSize: 16, lineHeight: 1.65, color: C.inkSoft, margin: '0 0 24px',
          }}>
            Also see: our{' '}
            <Link to="/privacy" style={{
              color: C.teal, textDecoration: 'underline', textUnderlineOffset: 3,
            }}>full Privacy Policy</Link>{' '}for the legal version, and our{' '}
            <Link to="/terms" style={{
              color: C.teal, textDecoration: 'underline', textUnderlineOffset: 3,
            }}>Terms</Link>{' '}for the legal framing of the service.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <Link to="/audit-demo" style={{
              background: C.teal, color: C.paper,
              padding: '12px 22px', borderRadius: 10,
              fontWeight: 600, fontSize: 15,
              textDecoration: 'none',
            }}>See a sample audit (no signup)</Link>
            <Link to="/integrations" style={{
              background: 'transparent', color: C.teal,
              padding: '12px 22px', borderRadius: 10,
              fontWeight: 600, fontSize: 15,
              textDecoration: 'none',
              border: `1px solid ${C.teal}`,
            }}>What we integrate with</Link>
          </div>
        </Section>
      </main>

      <MarketingFooter />
    </div>
  );
}
