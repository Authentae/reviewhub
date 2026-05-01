import React from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';

// /changelog — what shipped recently. Tech-savvy buyers (the developer
// who runs a cafe on the side, the ex-PM evaluating tools, the indie
// hacker) all asked "where's the changelog" in persona testing. They
// don't want a marketing recap; they want commit-level honesty.
//
// We don't auto-generate this page from git (would need a server
// endpoint + caching) — instead it's a manually curated highlight reel
// updated when meaningful releases happen, plus a deep-link to the full
// public commit log on GitHub for anyone who wants the firehose.
export default function Changelog() {
  const { t, lang } = useI18n();
  usePageTitle(t('changelog.title', 'Changelog · ReviewHub'));
  const isThai = lang === 'th';

  const REPO = 'https://github.com/Authentae/reviewhub/commits/main';

  // Curated highlights — each entry is what a customer would care about,
  // not raw commit titles. Update this list when shipping anything that
  // a paying user would notice.
  const highlights = [
    {
      date: '2026-05-02',
      en: 'AI drafts now reply in 10 languages natively (Thai, Japanese, Korean, Chinese, Spanish, French, German, Italian, Portuguese, English) — with per-language anti-corporate-speak rules. Drafts read like a real owner, not a customer-service bot.',
      th: 'AI ตอบรีวิวเป็นภาษาแม่ของลูกค้าได้แล้ว 10 ภาษา (ไทย ญี่ปุ่น เกาหลี จีน สเปน ฝรั่งเศส เยอรมัน อิตาลี โปรตุเกส อังกฤษ) พร้อมกฎแก้คำตอบให้ฟังเหมือนคนจริง ไม่เหมือนบอท',
    },
    {
      date: '2026-05-02',
      en: 'Onboarding emails (day 0 / 1 / 3 / 7 / 14) localized in EN / TH / ES / JA. Other languages still get English until we have customers in them.',
      th: 'อีเมลแนะนำการใช้งาน (วันที่ 0 / 1 / 3 / 7 / 14) แปลเป็นภาษาไทย, อังกฤษ, สเปน, ญี่ปุ่น',
    },
    {
      date: '2026-05-02',
      en: 'Real bug fix: when you change UI language in the dashboard, your stored preferred_lang now persists to the server — so transactional + lifecycle emails arrive in the language you actually use the app in. Before, it was locked to whatever browser-default you had at signup.',
      th: 'แก้บั๊ก: ตอนเปลี่ยนภาษา UI ในแดชบอร์ด ตอนนี้บันทึกที่เซิร์ฟเวอร์แล้ว — อีเมลจะส่งในภาษาที่คุณใช้แอพจริงๆ',
    },
    {
      date: '2026-05-02',
      en: '/audit page — submit your Google Business URL, get a free 10-reply audit hand-crafted by the founder within 24h. No signup, no upsell.',
      th: 'หน้า /audit — ส่ง URL ร้านบน Google มา รับคำตอบรีวิว 10 อันฟรี เขียนเฉพาะร้านคุณ ภายใน 24 ชม.',
    },
    {
      date: '2026-04',
      en: 'Pricing simplified to four honest tiers: Free / Starter $14 / Pro $29 / Business $59. Killed the 14-day trial because it was a trick we never delivered on.',
      th: 'ราคาเหลือ 4 แพ็กเกจ: Free / Starter $14 / Pro $29 / Business $59. ยกเลิกการทดลอง 14 วันเพราะมันเป็นกลลวง',
    },
    {
      date: '2026-04',
      en: 'Sentry forwarder + admin endpoint + daily backups + real Google OAuth — production hardening so we can take real customers.',
      th: 'Sentry, admin endpoint, backup รายวัน, Google OAuth จริง — เตรียมพร้อมรับลูกค้าจริง',
    },
    {
      date: '2026-04',
      en: 'GDPR data export bumped to v4 — includes the lifecycle email send-log + your stored language preference, in addition to the v3 set (reviews, templates, businesses, audit log, etc.).',
      th: 'GDPR data export อัปเป็น v4 — รวมประวัติอีเมลแนะนำการใช้งาน + ภาษาที่บันทึกไว้',
    },
  ];

  return (
    <div className="rh-design rh-app min-h-screen" style={{ background: 'var(--rh-paper)' }}>
      <MarketingNav />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--rh-ink)', letterSpacing: '-0.02em' }}>
          {isThai ? 'มีอะไรใหม่' : 'Changelog'}
        </h1>
        <p className="text-base mb-10" style={{ color: 'var(--rh-ink-soft, #4a525a)' }}>
          {isThai
            ? 'สิ่งที่เปลี่ยนแปลงล่าสุด เลือกเฉพาะที่คุณจะได้รู้สึก ไม่ใช่ทุก commit'
            : 'What changed recently. Highlights — not every commit. Full log on '}
          {!isThai && <a href={REPO} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--rh-teal-deep)', fontWeight: 600 }}>GitHub →</a>}
        </p>

        <ul className="space-y-6">
          {highlights.map((entry, i) => (
            <li key={i}>
              <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--rh-ochre, #c48a2c)' }}>
                {entry.date}
              </div>
              <p className="text-base leading-relaxed" style={{ color: 'var(--rh-ink)' }}>
                {isThai ? entry.th : entry.en}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-16 pt-8 border-t" style={{ borderColor: 'var(--rh-line, #e6dfce)' }}>
          <p className="text-sm" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
            {isThai ? 'ดู commit ทั้งหมดบน ' : 'Want the full firehose? '}
            <a href={REPO} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--rh-teal-deep)', fontWeight: 600 }}>
              {isThai ? 'GitHub →' : 'See every commit on GitHub →'}
            </a>
          </p>
          <p className="mt-4 text-sm">
            <Link to="/" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>← {isThai ? 'กลับหน้าหลัก' : 'Back to home'}</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
