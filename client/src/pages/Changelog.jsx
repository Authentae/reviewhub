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
      date: '2026-05-05',
      en: 'Sign in with Google — one-click OAuth sign-in alongside email/password. New "Sign in with Google" button on /login. Existing accounts auto-link by email; new accounts auto-create with email already verified. No password to remember.',
      th: 'เข้าสู่ระบบด้วย Google — คลิกเดียวด้วย OAuth เพิ่มเติมจากอีเมล/รหัสผ่าน มีปุ่ม "Sign in with Google" บนหน้า /login บัญชีเดิมเชื่อมอัตโนมัติด้วยอีเมล บัญชีใหม่สร้างพร้อมยืนยันอีเมลแล้ว',
    },
    {
      date: '2026-05-05',
      en: 'Magic-link sign-in — request a one-time link to your inbox, click it, you\'re in. No password needed. Useful for the "forgot my password again" path or shared-device login. Links are single-use, expire in 15 minutes, and respect MFA if enabled.',
      th: 'เข้าสู่ระบบด้วย magic link — ขอ link ส่งเข้าอีเมล คลิกแล้วเข้าระบบเลย ไม่ต้องกรอกรหัสผ่าน เหมาะสำหรับเวลาลืมรหัสผ่าน หรือล็อกอินจากเครื่องที่ใช้ร่วมกัน link ใช้ได้ครั้งเดียว หมดอายุใน 15 นาที',
    },
    {
      date: '2026-05-05',
      en: 'Read-only dashboard share links — mint a link from Settings → "Read-only share links" and send it to your accountant or agency. They open /shared/<token> and see a stripped-down read-only view of your reviews. No login required for them. Revoke any link instantly.',
      th: 'ลิงก์แชร์แดชบอร์ดแบบอ่านอย่างเดียว — สร้างลิงก์จาก Settings → "Read-only share links" ส่งให้นักบัญชีหรือเอเจนซี่ เขาเปิดแล้วเห็นแดชบอร์ดในโหมดอ่านอย่างเดียว ไม่ต้องล็อกอิน ยกเลิกลิงก์ได้ทันที',
    },
    {
      date: '2026-05-04',
      en: 'Scheduled reply send — draft a reply at 2am, schedule it to post during business hours. New ⏰ Schedule button next to Save in the reply editor. Cron picks up due replies every 5 minutes and posts them via the platform API. Up to 90 days out.',
      th: 'ตั้งเวลาส่งคำตอบ — ร่างตอน 2 ทุ่ม ตั้งให้โพสต์ตอนเช้า มีปุ่ม ⏰ Schedule ข้างปุ่ม Save ครับ',
    },
    {
      date: '2026-05-04',
      en: 'Vacation / closed-period mode — pause new-review email and LINE notifications until a future date. Reviews still ingest in the background so nothing is lost. Settings → Vacation.',
      th: 'โหมดหยุดยาว / ปิดร้านชั่วคราว — หยุดการแจ้งเตือนอีเมลและ LINE ถึงวันที่กำหนด รีวิวยังเก็บอยู่เบื้องหลัง ตั้งค่าได้ที่ Settings → Vacation',
    },
    {
      date: '2026-05-04',
      en: 'Saved filter presets — save the filter combination you check every morning ("1-star unanswered last 30 days") and recall with one click. Stored per-business, per-device. Visible in the dashboard filter bar as a ★ Presets dropdown.',
      th: 'บันทึก filter preset ในแดชบอร์ด — บันทึกชุด filter ที่ใช้ประจำ ("1 ดาว ยังไม่ตอบ 30 วันล่าสุด") เรียกใช้ด้วยคลิกเดียว',
    },
    {
      date: '2026-05-04',
      en: 'Public /status page — live snapshot of platform health (DB, SMTP, AI, billing, …) auto-refreshing every 30 seconds. Prospects checking "is this thing actually working?" get a green/red answer in 1 second.',
      th: 'หน้า /status สาธารณะ ดูสุขภาพระบบสด (DB, SMTP, AI, ระบบเก็บเงิน ฯลฯ) refresh ทุก 30 วินาที',
    },
    {
      date: '2026-05-04',
      en: 'Persistent "Posted to Google ✓" badge on each replied review. The success toast vanished after a few seconds; this badge stays so you can tell at a glance which replies actually went live on Google vs. saved locally.',
      th: 'แบดจ์ "โพสต์ไปที่ Google แล้ว ✓" ติดถาวรกับรีวิวที่ตอบแล้ว — ดูได้ทันทีว่าคำตอบไหนขึ้น Google จริง',
    },
    {
      date: '2026-05-04',
      en: 'AI replies now post back to Google automatically by default (was opt-in before, which silently broke the headline feature for paying customers). Boot-time logs print the resolved status so misconfigured deploys are loud, not silent.',
      th: 'คำตอบจาก AI โพสต์กลับไปที่ Google อัตโนมัติเป็นค่าเริ่มต้นแล้ว (เดิมต้องเปิดเอง) มี log ตอนบูตแสดงสถานะ',
    },
    {
      date: '2026-05-04',
      en: 'Outbound audit-share open-tracking + 48h follow-up reminder — when a prospect opens an audit URL you DM\'d, you get an instant email so you can follow up while the lead is warm. If they opened but you haven\'t closed the loop, a 48h reminder with a copy-paste follow-up template lands in your inbox.',
      th: 'Outbound audit ติดตามการเปิดดู + แจ้งเตือนติดตามผล 48 ชม. — เมื่อ prospect เปิดดู audit จะมีอีเมลแจ้งเตือนทันที ถ้ายังไม่ได้ปิดดีล จะมีอีเมลพร้อมเทมเพลตติดตามผล',
    },
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
