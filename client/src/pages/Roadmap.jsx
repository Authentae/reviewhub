import React from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';

// /roadmap — what we're considering, what we're building, what we shipped,
// and what we've decided NOT to build. Most SaaS roadmaps lie about
// timing or hide the "rejected" column to look ambitious. This one names
// the rejected items so prospects can self-qualify out without signing
// up first and getting disappointed.
//
// No dates promised. "Working on now" gets a soft commitment; everything
// else is "we hear you, no timeline." Categories rather than columns
// because timeline-columned roadmaps age badly when the dates slip — and
// they always slip.
//
// To suggest something missing: /support → category "feature".
export default function Roadmap() {
  const { t, lang } = useI18n();
  usePageTitle(t('roadmap.title', 'Roadmap · ReviewHub'));
  const isThai = lang === 'th';

  // Each entry is { en, th } — both languages inline so we don't need
  // separate i18n keys for content that updates frequently. Other
  // languages fall back to the English copy via the fallback below.
  const sections = [
    {
      heading: isThai ? '✓ เพิ่งปล่อย' : '✓ Shipped recently',
      blurb: isThai
        ? 'ของล่าสุดที่ลูกค้าจะรู้สึกได้จริง'
        : 'The recent things that paying customers actually notice. See ',
      blurbLinkLabel: isThai ? 'หน้า Changelog' : 'Changelog',
      blurbLinkTo: '/changelog',
      blurbAfter: isThai ? ' สำหรับรายละเอียดเต็ม' : ' for the full list.',
      items: [
        {
          en: 'Outbound audit-share tracking — when a prospect opens the audit URL you DM\'d them, you get an instant email so you can follow up while the lead is warm. Bot/preview crawlers filtered out so you only get notified on real human opens.',
          th: 'Outbound audit ติดตามการเปิดดูแล้ว — เมื่อ prospect เปิดดู audit ที่คุณส่งไป จะมีอีเมลแจ้งเตือนทันที พร้อมกรอง bot/preview crawlers ออกเพื่อให้ได้สัญญาณจริงเท่านั้น',
        },
        {
          en: 'Outbound audit 48h follow-up reminder — if the prospect opened the audit but you haven\'t closed the loop, a templated nudge lands in your inbox so the warm window doesn\'t lapse.',
          th: 'Outbound audit แจ้งเตือนติดตามผล 48 ชม. — ถ้า prospect เปิดดูแล้วยังไม่ได้ปิดดีล จะมีอีเมลพร้อมเทมเพลตติดตามผลให้ก๊อปไปแปะ',
        },
        {
          en: 'AI replies now post back to Google automatically by default — was opt-in before, which silently broke the headline feature for paying customers.',
          th: 'คำตอบจาก AI โพสต์กลับไปที่ Google อัตโนมัติเป็นค่าเริ่มต้นแล้ว (เดิมต้องเปิดเอง ทำให้ฟีเจอร์หลักของคนจ่ายเงินใช้ไม่ได้แบบเงียบๆ)',
        },
        {
          en: 'Per-business AI reply tone preference (casual / warm / formal) — steers every AI draft from a single Settings switch.',
          th: 'ตั้งโทนเสียง AI ต่อร้านได้ (สบายๆ / อบอุ่น / ทางการ) — ปรับครั้งเดียวที่ Settings, มีผลกับทุกรีวิว',
        },
        {
          en: 'Webhook signing-secret rotation (API + UI). For Business plan customers running long-lived integrations.',
          th: 'หมุน secret ของ webhook ได้แล้ว (ทั้ง API และในหน้า Settings)',
        },
        {
          en: 'Onboarding emails localized in 10 languages — was English-everywhere except Thai before this push.',
          th: 'อีเมลแนะนำการใช้งาน 10 ภาษา (จากเดิมที่มีแค่ไทย/อังกฤษ)',
        },
        {
          en: 'CSV import handles embedded newlines + UTF-8 BOM correctly. Excel-on-Windows users with Thai/Japanese/Korean review text now import cleanly.',
          th: 'CSV import รองรับขึ้นบรรทัดในข้อความรีวิว + UTF-8 BOM (Excel บน Windows ใช้ได้)',
        },
        {
          en: 'AI prompt now has 25+ rules covering platform-specific tone, regional language variants (Quebec FR / Mexico ES / BR PT / Traditional ZH / etc.), high-liability accusations, named-staff protection, off-topic / promotional / extortion-style reviews.',
          th: 'AI prompt มีกฎ 25+ ข้อ ครอบคลุมโทนเสียงแต่ละแพลตฟอร์ม, ภาษาถิ่น, ข้อกล่าวหาที่มีความเสี่ยงทางกฎหมาย, การปกป้องพนักงาน',
        },
      ],
    },
    {
      heading: isThai ? '⚙ กำลังทำอยู่' : '⚙ Working on now',
      blurb: isThai
        ? 'มีโค้ดอยู่ใน branch แล้วหรือเริ่มร่างจริง ๆ ไม่ใช่ "วางแผน"'
        : 'Code in a branch or actively being drafted — not "planning to."',
      items: [
        {
          en: 'Public roadmap page (you are reading it).',
          th: 'หน้า Roadmap สาธารณะ (คุณกำลังอ่านอยู่นี่)',
        },
        {
          en: 'Translating remaining UI strings into the 8 non-Thai non-English locales — currently many tooltips and edge-case strings fall back to English even when the rest of the page is German / Japanese / etc.',
          th: 'แปลข้อความที่เหลือใน UI เป็นภาษาอื่นนอกเหนือจาก ไทย/อังกฤษ — ตอนนี้บาง tooltip ยัง fall back เป็นอังกฤษ',
        },
      ],
    },
    {
      heading: isThai ? '🤔 กำลังคิดอยู่' : '🤔 Considering',
      blurb: isThai
        ? 'ของที่ลูกค้าถามมา แต่เรายังไม่ตัดสินใจว่าจะทำเมื่อไหร่ ถ้าคุณเชียร์อันไหนเป็นพิเศษ ส่งข้อความผ่าน '
        : "Things customers asked for. We haven't decided when (or whether). If you'd push one of these to the top, ",
      blurbLinkLabel: isThai ? 'หน้า Support' : '/support → "feature"',
      blurbLinkTo: '/support?type=feature',
      blurbAfter: isThai ? ' เลย' : ' is the path.',
      items: [
        {
          en: 'Magic-link / Google sign-in. Older or less tech-comfortable owners struggle with passwords; passwordless login is the obvious fix.',
          th: 'เข้าระบบด้วย magic link / Google — คนที่ไม่ถนัดเทคโนโลยีจะเข้าง่ายขึ้น',
        },
        {
          en: 'Vacation / closed-period mode. Pause AI suggestions and email alerts for a date range. Asked for by seasonal businesses (ski lodges, beach resorts, summer-only cafes).',
          th: 'โหมดหยุดยาว / ปิดร้านชั่วคราว — หยุด AI suggestion และอีเมลแจ้งเตือนตามช่วงวัน',
        },
        {
          en: 'Saved filter presets in the dashboard ("1-star unanswered last 30 days" → one click).',
          th: 'บันทึก filter preset ในแดชบอร์ด — เช่น "1 ดาว ยังไม่ตอบ 30 วันล่าสุด" ค้นด้วยคลิกเดียว',
        },
        {
          en: 'Scheduled reply send (queue replies for business hours instead of posting at 2am).',
          th: 'ตั้งเวลาส่งคำตอบ (ปล่อยตามเวลาทำการแทนตี 2)',
        },
        {
          en: 'Year-in-review email + dashboard recap (your 2026 in reviews).',
          th: 'อีเมลและหน้าสรุปประจำปี — รีวิวที่คุณตอบในปีนี้, เทรนด์, ดาวเฉลี่ย',
        },
        {
          en: 'Native iOS / Android app. The current PWA installs and works, but it\'s not on the App Store.',
          th: 'แอป iOS / Android แท้ — ตอนนี้ PWA ติดตั้งบนมือถือได้แต่ยังไม่อยู่ใน App Store',
        },
        {
          en: 'Public uptime / status page.',
          th: 'หน้า status / uptime สาธารณะ',
        },
        {
          en: 'Read-only role for accountants / agency staff (share dashboard view without giving full edit access).',
          th: 'สิทธิ์อ่านอย่างเดียว สำหรับนักบัญชี / agency — ดูแดชบอร์ดได้แต่แก้ไม่ได้',
        },
      ],
    },
    {
      heading: isThai ? '✗ ตัดสินใจว่าจะไม่ทำ' : '✗ Decided NOT to build',
      blurb: isThai
        ? 'เราเลือกที่จะไม่ทำสิ่งเหล่านี้ ไม่ใช่ "ยังไม่ทำ" จะได้ไม่ต้องรอเก้อ'
        : 'Things we deliberately won\'t build. Not "not yet" — actually no. So you can plan around it.',
      items: [
        {
          en: 'Auto-reply (post AI drafts directly to platforms without owner review). Too risky — one bad reply on a 1-star is irrecoverable. AI drafts always go through human approval.',
          th: 'ตอบอัตโนมัติ (โพสต์คำตอบ AI ตรงไปยังแพลตฟอร์มโดยไม่ผ่านสายตาเจ้าของ) — เสี่ยงเกินไป คำตอบผิดพลาดบนรีวิว 1 ดาวกู้คืนไม่ได้',
        },
        {
          en: 'Buying / paying for fake reviews to boost your rating. Violates every platform\'s ToS, illegal in many jurisdictions, kills your account if caught. We will refuse this if asked.',
          th: 'ซื้อรีวิวปลอม / จ่ายให้รีวิวดี — ผิดกฎทุกแพลตฟอร์ม + ผิดกฎหมายในหลายประเทศ ถ้าโดนจับบัญชีโดนแบน เราจะปฏิเสธถ้ามีลูกค้าขอ',
        },
        {
          en: 'White-label / agency tier (resell ReviewHub under your own brand). Out of scope — we\'re a tool for owners, not a platform for agencies. If you\'re an agency managing 5 client locations the Business plan covers you; for 50+ clients we\'re not the fit.',
          th: 'White-label / agency tier (เอาไปขายต่อในชื่อตัวเอง) — ไม่อยู่ในขอบเขต ถ้าจัดการ 5 ร้าน Business plan ครอบคลุม ถ้ามากกว่านั้นเราไม่ใช่เครื่องมือที่เหมาะ',
        },
        {
          en: 'Email-tracking pixels in our outbound emails. We respect your inbox. You\'ll never see "we noticed you didn\'t open our last email" from us.',
          th: 'pixel tracking ในอีเมลที่ส่งหา — เราไม่ทำ ไม่ต้องการรู้ว่าคุณเปิดอีเมลกี่ครั้ง',
        },
      ],
    },
  ];

  return (
    <div className="rh-design rh-app min-h-screen" style={{ background: 'var(--rh-paper)' }}>
      <MarketingNav />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--rh-ink)', letterSpacing: '-0.02em' }}>
          {isThai ? 'แผนการพัฒนา' : 'Roadmap'}
        </h1>
        <p className="text-base mb-12 leading-relaxed" style={{ color: 'var(--rh-ink-soft, #4a525a)' }}>
          {isThai
            ? 'อันที่เพิ่งปล่อย, อันที่กำลังทำ, อันที่กำลังพิจารณา, และอันที่ตัดสินใจไม่ทำ ไม่มีคำว่า "Q2 2026" — ทำเสร็จเมื่อทำเสร็จ ลูกค้าที่จ่ายเงินคนแรกที่บอกว่าต้องการอะไรจริง ๆ จะถูกพิจารณาก่อน'
            : 'What\'s shipped, what\'s being built, what we\'re considering, and what we\'re not building. No "Q2 2026" promises — done when it\'s done. Paying customers who tell us they need something move it up the list.'}
        </p>

        {sections.map((section, idx) => (
          <section key={idx} className="mb-14">
            <h2
              className="text-2xl font-bold mb-3"
              style={{ color: 'var(--rh-ink)', letterSpacing: '-0.01em' }}
            >
              {section.heading}
            </h2>
            <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
              {section.blurb}
              {section.blurbLinkTo && (
                <Link
                  to={section.blurbLinkTo}
                  style={{ color: 'var(--rh-teal-deep)', fontWeight: 600 }}
                >
                  {section.blurbLinkLabel}
                </Link>
              )}
              {section.blurbAfter}
            </p>
            <ul className="space-y-3">
              {section.items.map((item, i) => (
                <li
                  key={i}
                  className="text-base leading-relaxed pl-4 border-l-2"
                  style={{ color: 'var(--rh-ink)', borderColor: 'var(--rh-line, #e6dfce)' }}
                >
                  {isThai ? item.th : item.en}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div className="mt-16 pt-8 border-t" style={{ borderColor: 'var(--rh-line, #e6dfce)' }}>
          <p className="text-sm mb-3" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
            {isThai
              ? 'ไม่เห็นสิ่งที่อยากให้มี? '
              : "Don't see what you need? "}
            <Link
              to="/support?type=feature"
              style={{ color: 'var(--rh-teal-deep)', fontWeight: 600 }}
            >
              {isThai ? 'ส่งคำขอผ่าน /support →' : 'Send a request via /support →'}
            </Link>
          </p>
          <p className="text-sm">
            <Link to="/" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
              ← {isThai ? 'กลับหน้าหลัก' : 'Back to home'}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
