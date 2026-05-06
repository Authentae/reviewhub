// /tools — index page tying together the three free tools we've shipped:
// /tools/review-reply-generator, /tools/reply-roaster, /tools/review-impact.
//
// Why this exists: each tool was reachable only via direct URL or deep
// link from blog posts. No central /tools page meant (a) Google couldn't
// crawl them as a related cluster, (b) humans who tried one tool had no
// way to discover its siblings.
//
// Editorial voice matches the marketing landing pages — eyebrow / serif
// headline / sub / structured grid.

import React from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';
import usePageTitle from '../hooks/usePageTitle';
import useSocialMeta from '../hooks/useSocialMeta';
import { useI18n } from '../context/I18nContext';

const TOOLS = [
  {
    href: '/tools/review-reply-generator',
    eyebrow: 'Generator · uses AI',
    title: 'Review Reply Generator',
    descEn: 'Paste a Google review. Get an AI-drafted reply in your business voice. Edits in 10 seconds, free. Auto-detects 10 languages.',
    descTh: 'วาง Google review รับคำตอบที่ AI ร่างให้ในเสียงของร้าน แก้ได้ใน 10 วินาที ฟรี รองรับ 10 ภาษาอัตโนมัติ',
    bestFor: 'When you have a review and need a reply.',
  },
  {
    href: '/tools/reply-roaster',
    eyebrow: 'Critique · no AI',
    title: 'Reply Roaster',
    descEn: 'Wrote a reply at 11pm and not sure if it sounds defensive? Paste it. We score 0-100 against every "bad-reply" pattern — defensive clichés, generic closers, missing acknowledgment.',
    descTh: 'เขียนคำตอบไว้ตอนตี 4 แล้วไม่แน่ใจว่าฟังดูแก้ตัวมั้ย? วางมา ระบบให้คะแนน 0-100 พร้อม pattern ที่จับผิดทันที',
    bestFor: 'When you have a draft and want a sanity check.',
  },
  {
    href: '/tools/review-impact',
    eyebrow: 'Damage scorer · no AI',
    title: 'Review Impact Scorer',
    descEn: 'A 1-star just landed. Paste it. Get an instant damage score (0-100), reviewer-type guess (legitimate / venting / extortion), and a recommended action — apologize, clarify, flag, or ignore.',
    descTh: 'รีวิว 1 ดาวเพิ่งเข้ามา วางมา รับคะแนนความเสียหาย 0-100, ประเภทผู้รีวิว, และการกระทำที่แนะนำ — ขอโทษ, ชี้แจง, แจ้ง Google, หรือ ignore',
    bestFor: 'When a 1-star just landed and you\'re panicking.',
  },
];

export default function ToolsIndex() {
  const { lang } = useI18n();
  const isThai = lang === 'th';

  usePageTitle(isThai ? 'เครื่องมือฟรี — ReviewHub' : 'Free tools for Google review replies — ReviewHub');
  useSocialMeta({
    title: isThai ? 'เครื่องมือฟรีของ ReviewHub' : 'Free tools — Google review reply generator, critic, and impact scorer',
    description: 'Three free tools for owners managing Google reviews. AI reply generator, draft-reply critic, and negative-review impact scorer. No signup, instant results.',
  });

  return (
    <div className="rh-design min-h-screen" style={{ background: 'var(--rh-paper, #fbf8f1)', color: 'var(--rh-ink, #1d242c)' }}>
      <MarketingNav />

      <main className="max-w-3xl mx-auto px-6 py-16">
        {/* Editorial hero */}
        <div className="mb-12">
          <p
            className="text-[11px] uppercase tracking-[0.15em] mb-3 font-bold"
            style={{ color: 'var(--rh-ochre-deep, #a07d20)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
          >
            {isThai ? 'เครื่องมือฟรี' : 'Free tools'}
          </p>
          <h1
            className="text-5xl font-bold mb-6"
            style={{
              fontFamily: 'Instrument Serif, Georgia, serif',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
            }}
          >
            {isThai ? 'สามเครื่องมือฟรี ไม่ต้องสมัคร' : 'Three free tools, no signup.'}
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
            {isThai
              ? 'ทุกเครื่องมือทำงานในเบราเซอร์ของคุณ ไม่เก็บข้อมูล ไม่ต้องบัตร แต่ละเครื่องมือแก้ปัญหาคนละช่วงของวงจรการตอบรีวิว — ตั้งแต่ "ฉันต้องการคำตอบ" ไปจนถึง "รีวิวนี้แย่แค่ไหน?"'
              : 'Each tool runs in your browser. No data stored, no card needed. Each one solves a different moment in the review-reply cycle — from "I need a draft" to "how bad is this?"'}
          </p>
        </div>

        {/* Tool grid */}
        <div className="space-y-6">
          {TOOLS.map((tool) => (
            <Link
              key={tool.href}
              to={tool.href}
              className="block p-6 rounded-xl"
              style={{
                background: 'var(--rh-card)',
                border: '1px solid var(--rh-rule, #e8e3d6)',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'border-color 0.15s ease, transform 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--rh-teal, #1e4d5e)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--rh-rule, #e8e3d6)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <p
                className="text-[10px] uppercase tracking-[0.15em] mb-2 font-bold"
                style={{ color: 'var(--rh-ochre-deep, #a07d20)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
              >
                {tool.eyebrow}
              </p>
              <h2
                className="text-2xl mb-3"
                style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontWeight: 600, letterSpacing: '-0.015em' }}
              >
                {tool.title}
              </h2>
              <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
                {isThai ? tool.descTh : tool.descEn}
              </p>
              <p className="text-xs" style={{ color: 'var(--rh-ink-3, #8b939c)', fontStyle: 'italic' }}>
                {isThai ? 'เหมาะสำหรับ: ' : 'Best for: '}
                {tool.bestFor}
              </p>
              <p className="text-sm mt-4 font-semibold" style={{ color: 'var(--rh-teal, #1e4d5e)' }}>
                {isThai ? 'เปิด →' : 'Open →'}
              </p>
            </Link>
          ))}
        </div>

        {/* Cross-link to the bigger product */}
        <section
          className="mt-12 p-6 rounded-xl text-center"
          style={{ background: 'var(--rh-cream, #f3ecdb)', border: '1px solid var(--rh-rule, #e8e3d6)' }}
        >
          <p className="text-sm mb-4" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
            {isThai
              ? 'ใช้เครื่องมือเหล่านี้บ่อยมั้ย? ReviewHub เป็นแอปที่รวมทุกอย่าง — รับรีวิวอัตโนมัติ ร่างคำตอบ และโพสต์กลับไป Google ในที่เดียว'
              : 'Using these tools often? ReviewHub is the app that bundles all of it — auto-syncs your reviews, drafts replies in your voice, and posts back to Google. One inbox.'}
          </p>
          <Link
            to="/audit"
            className="inline-block px-5 py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: 'var(--rh-teal, #1e4d5e)', color: '#fff', textDecoration: 'none' }}
          >
            {isThai ? 'ขอ audit ฟรี →' : 'Get a free audit →'}
          </Link>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
