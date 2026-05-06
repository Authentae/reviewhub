// /blog — index page listing all published posts.
//
// Why this exists: the three blog posts at /public/blog/*.html were
// only reachable via direct URL. No internal entry point meant Google
// found them via sitemap.xml but had no internal-link signal that they
// were part of the site, and human visitors had no way to discover
// post #2 after reading post #1. This index page fixes both:
// internal linking authority + a real reading destination.
//
// The post list is hand-curated (not auto-generated from a CMS) — same
// philosophy as the changelog. Three posts is fine; when there are 30,
// revisit.

import React from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';
import usePageTitle from '../hooks/usePageTitle';
import useSocialMeta from '../hooks/useSocialMeta';
import { useI18n } from '../context/I18nContext';

// Hand-curated post list. Order = newest first. Add an entry here when
// publishing a new post in /public/blog/.
const POSTS = [
  {
    slug: 'how-to-remove-google-review',
    title: 'How to remove a Google review (and what Google actually allows)',
    description: 'The honest playbook: what Google will and won\'t remove, the flag-and-wait process, the escalation path most owners don\'t know exists, and what to do when the review stays up.',
    date: '2026-05-07',
    readingMins: 9,
    lang: 'en',
  },
  {
    slug: 'how-to-ask-for-google-reviews',
    title: 'How to ask for Google reviews without being pushy (and without giving discounts)',
    description: 'Five natural moments to ask, the wording that doesn\'t sound desperate, the QR-code mistake most owners make, why coupons-for-reviews violate Google policy, and the 1-star prevention move.',
    date: '2026-05-06',
    readingMins: 7,
    lang: 'en',
  },
  {
    slug: 'transfer-google-business-profile-ownership',
    title: 'How to transfer Google Business Profile ownership (the actual steps)',
    description: 'Adding a manager vs transferring primary ownership, the 7-day waiting period, and the shortcut nobody mentions — written for owners not consultants.',
    date: '2026-05-06',
    readingMins: 8,
    lang: 'en',
  },
  {
    slug: 'why-respond-to-google-reviews',
    title: 'Why your Google reviews need owner replies (with a 1-star template)',
    description: 'The data on why owner replies move conversion more than the reviews themselves — plus copy-paste templates for 1-star, 5-star, and the awkward 3-star middle.',
    date: '2026-05-04',
    readingMins: 6,
    lang: 'en',
  },
  {
    slug: 'fake-extortion-google-reviews',
    title: 'How to respond to fake or extortion Google reviews (without making it worse)',
    description: 'The owner playbook for fake reviews, extortion attempts ("pay or I\'ll keep this 1-star"), and competitor sabotage on Google. What to reply, when to flag, what NOT to do.',
    date: '2026-05-04',
    readingMins: 8,
    lang: 'en',
  },
  {
    slug: 'reply-1-star-google-review-th',
    title: 'วิธีตอบรีวิว 1 ดาวบน Google ให้กลายเป็นโอกาส (พร้อมตัวอย่าง 2026)',
    description: 'คู่มือเจ้าของร้านไทย: ตอบรีวิว 1 ดาวบน Google อย่างมืออาชีพ ใน 5 สถานการณ์จริง พร้อมเทมเพลตที่คัดลอกใช้ได้ทันที',
    date: '2026-04-27',
    readingMins: 7,
    lang: 'th',
  },
];

export default function BlogIndex() {
  const { lang } = useI18n();
  const isThai = lang === 'th';

  usePageTitle(isThai ? 'บล็อก — เคล็ดลับการตอบรีวิว Google' : 'Blog — Google review-reply playbooks & templates');
  useSocialMeta({
    title: isThai ? 'บล็อก ReviewHub' : 'ReviewHub Blog',
    description: 'Practical writing for small business owners on managing Google reviews, replying to feedback, and handling fake or extortion reviews.',
  });

  return (
    <div className="rh-design min-h-screen" style={{ background: 'var(--rh-paper, #fbf8f1)', color: 'var(--rh-ink, #1d242c)' }}>
      <MarketingNav />

      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <p
            className="text-[11px] uppercase tracking-[0.15em] mb-2 font-bold"
            style={{ color: 'var(--rh-ochre-deep, #a07d20)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
          >
            {isThai ? 'การเขียน' : 'Writing'}
          </p>
          <h1
            className="text-5xl font-bold mb-3"
            style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05 }}
          >
            {isThai ? 'บล็อก' : 'Blog'}
          </h1>
          <p className="text-base" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
            {isThai
              ? 'บทความสำหรับเจ้าของร้านเรื่องรีวิว Google การตอบลูกค้า และการจัดการรีวิวปลอม'
              : 'Practical writing for owners on Google reviews, replying to feedback, and handling fake or extortion reviews.'}
          </p>
        </div>

        <ul className="space-y-8">
          {POSTS.map((p) => (
            <li
              key={p.slug}
              className="pb-8"
              style={{ borderBottom: '1px solid var(--rh-rule, #e8e3d6)' }}
            >
              <a
                href={`/blog/${p.slug}`}
                className="block group"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <p
                  className="text-[10px] uppercase tracking-[0.15em] mb-2"
                  style={{ color: 'var(--rh-ink-3, #8b939c)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
                >
                  {p.date} · {p.readingMins} min read · {p.lang === 'th' ? 'ภาษาไทย' : 'English'}
                </p>
                <h2
                  className="text-2xl mb-2 group-hover:underline"
                  style={{
                    fontFamily: 'Instrument Serif, Georgia, serif',
                    fontWeight: 600,
                    letterSpacing: '-0.015em',
                    color: 'var(--rh-ink, #1d242c)',
                  }}
                >
                  {p.title}
                </h2>
                <p className="text-base leading-relaxed" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
                  {p.description}
                </p>
                <p className="mt-3 text-sm" style={{ color: 'var(--rh-teal-deep, #1e4d5e)', fontWeight: 600 }}>
                  {isThai ? 'อ่านต่อ →' : 'Read post →'}
                </p>
              </a>
            </li>
          ))}
        </ul>

        {/* RSS feed pointer + audit CTA — funnels readers toward the audit funnel */}
        <section className="mt-12 pt-8 text-center" style={{ borderTop: '1px solid var(--rh-rule, #e8e3d6)' }}>
          <p className="text-base mb-4" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
            {isThai
              ? 'อยากดูตัวอย่างการตอบรีวิวสำหรับร้านของคุณ?'
              : 'Want to see what AI replies for your business actually look like?'}
          </p>
          <Link
            to="/audit"
            className="inline-block px-5 py-3 rounded-lg font-semibold text-sm mb-4"
            style={{ background: 'var(--rh-teal, #1e4d5e)', color: '#fff', textDecoration: 'none' }}
          >
            {isThai ? 'ขอ audit ฟรี →' : 'Get a free audit →'}
          </Link>
          <p className="text-xs" style={{ color: 'var(--rh-ink-3, #8b939c)' }}>
            {isThai ? 'ติดตามโพสต์ใหม่ทาง ' : 'Subscribe to new posts via '}
            <a href="/feed.xml" style={{ color: 'var(--rh-teal-deep, #1e4d5e)' }}>RSS</a>
            {' · '}
            <Link to="/" style={{ color: 'var(--rh-ink-3, #8b939c)' }}>← {isThai ? 'หน้าหลัก' : 'Home'}</Link>
          </p>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
