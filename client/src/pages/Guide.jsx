import React from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';
import usePageTitle from '../hooks/usePageTitle';
import useSocialMeta from '../hooks/useSocialMeta';
import { useI18n } from '../context/I18nContext';

// /guide — "How ReviewHub works" + getting-started walkthrough.
//
// Why this page exists: the 17 free signups → 1 activated business
// gap (per audit_previews + businesses count in prod 2026-05-10)
// suggests new users sign up, don't know what to do next, leave.
// A central "here's the 4-step path" page closes that loop.
//
// Linked from: footer (Product → How it works), onboarding emails,
// /audit-preview FAQs, and /support sidebar. NOT linked from the
// main nav — that real estate is for prospects (Pricing, /line).
//
// Bilingual EN + TH inline (matches Roadmap.jsx pattern). Other
// locales fall back to English.

export default function Guide() {
  const { t, lang } = useI18n();
  usePageTitle(
    lang === 'th'
      ? 'วิธีใช้ ReviewHub — เริ่มต้นใน 10 นาที'
      : 'How ReviewHub works — get set up in 10 minutes'
  );
  const isThai = lang === 'th';
  useSocialMeta({
    title: isThai
      ? 'วิธีใช้ ReviewHub — เริ่มต้นใน 10 นาที'
      : 'How ReviewHub works — get set up in 10 minutes',
    description: isThai
      ? 'สมัคร → เชื่อม Google → เชื่อม LINE/Telegram → ตอบรีวิวใน 10 วินาทีจากแชท 4 ขั้นตอน 10 นาที'
      : '4-step walkthrough: sign up → connect Google → connect LINE/Telegram/WhatsApp (Q3 2026) → reply to reviews in 10 seconds from your chat.',
  });

  // Central walkthrough — 4 steps from signup to first reply posted.
  // Numbers + screenshots-as-text descriptions because real screenshots
  // age fast (UI changes; this page survives those changes).
  const steps = [
    {
      n: '1',
      titleEn: 'Sign up (free)',
      titleTh: 'สมัครฟรี',
      bodyEn: 'Email + password, one-click with Google, or magic-link sign-in (we email you a one-time login link, no password to remember). No credit card. The Free plan supports 1 business and 3 AI-drafted replies per month — enough to evaluate the product before paying anything.',
      bodyTh: 'ใช้อีเมล+รหัสผ่าน เข้าด้วย Google คลิกเดียว หรือ magic-link (เราส่งลิงก์เข้าอีเมลให้กดเข้าระบบเลย ไม่ต้องจำรหัสผ่าน) ไม่ต้องใช้บัตรเครดิต แพ็กเกจฟรี: 1 ธุรกิจ และคำตอบที่ AI ร่างให้ 3 อันต่อเดือน เพียงพอสำหรับทดลองก่อนจ่ายเงิน',
      ctaEn: 'Sign up →',
      ctaTh: 'สมัคร →',
      ctaTo: '/register',
    },
    {
      n: '2',
      titleEn: 'Connect Google',
      titleTh: 'เชื่อม Google',
      bodyEn: 'In Settings → Connect Google, click "Sign in with Google" and authorise ReviewHub to read your Google Business Profile reviews. One time, secure (OAuth), no password sharing. If your business isn\'t verified on Google yet, you can paste a Place ID instead — Settings has a "Look it up by name" helper.',
      bodyTh: 'ที่ Settings → เชื่อม Google คลิก "Sign in with Google" แล้วอนุญาตให้ ReviewHub อ่านรีวิวของ Google Business Profile (ทำครั้งเดียว ปลอดภัย ไม่ต้องแชร์รหัสผ่าน) ถ้ายังไม่ได้ verify บน Google ใช้วิธีวาง Place ID แทนได้ — มีตัวช่วยค้นหาจากชื่อร้าน',
      ctaEn: 'Open Settings →',
      ctaTh: 'ไปที่ Settings →',
      ctaTo: '/settings',
    },
    {
      n: '3',
      titleEn: 'Pick your notification channel: LINE or Telegram',
      titleTh: 'เลือกช่องทางแจ้งเตือน: LINE หรือ Telegram',
      bodyEn: 'In Settings → Notification channels, connect either LINE (best if LINE is your daily chat app — most Thai users) or Telegram (better for international owners + works on every device). Both flows: generate a one-time link code, send "/link <code>" to the bot, done. From now on every new Google review pings that chat with the AI-drafted reply ready to copy. You can connect both at once — alerts will fire on whichever channels are linked.',
      bodyTh: 'ที่ Settings → ช่องทางการแจ้งเตือน เลือกระหว่าง LINE (เหมาะถ้าคุณใช้ LINE เป็นหลัก) หรือ Telegram (สำหรับเจ้าของระดับสากล ใช้ได้ทุกอุปกรณ์) ทั้งสองช่องทางทำเหมือนกัน: สร้างโค้ดเชื่อม ส่ง "/link <โค้ด>" ให้บอท เสร็จ ตั้งแต่นี้รีวิวใหม่จะแจ้งเข้าช่องทางนั้นพร้อมข้อความตอบกลับที่ AI ร่างไว้แล้ว เชื่อมพร้อมกันทั้งสองช่องทางได้เลย แจ้งเตือนจะส่งไปทุกช่องที่เชื่อมไว้',
      ctaEn: 'Open Settings →',
      ctaTh: 'ไปที่ Settings →',
      ctaTo: '/settings',
    },
    {
      n: '4',
      titleEn: 'Copy from chat → paste in Google',
      titleTh: 'ก็อปจากแชต → วางใน Google',
      bodyEn: 'When a new review pings your LINE or Telegram, you receive the notification card + a follow-up monospace text block with just the AI draft. Long-press (or tap the copy icon on Telegram) → Copy. Tap "Reply on Google" on the card — Google opens directly to your business reviews. Paste the draft, post. 30 seconds instead of 30 minutes. (One-tap auto-post launches Q3 2026 when Google approves our Business Profile API access — case 8-9395000041442 submitted 2026-05-09.)',
      bodyTh: 'เมื่อรีวิวใหม่แจ้งเข้า LINE หรือ Telegram คุณจะได้การ์ดแจ้งเตือนและข้อความบล็อกที่มีแค่คำตอบ AI กดค้าง (หรือกดไอคอนคัดลอกบน Telegram) แล้วแตะ "คัดลอก" แตะปุ่ม "ตอบที่ Google" บนการ์ด — Google จะเปิดหน้ารีวิวธุรกิจคุณ วางคำตอบ แล้วโพสต์ ใช้เวลา 30 วินาทีแทน 30 นาที (ฟีเจอร์โพสต์อัตโนมัติคลิกเดียว เปิดตัวไตรมาส 3 ปี 2026 เมื่อ Google อนุมัติ Business Profile API)',
      ctaEn: null,
      ctaTh: null,
      ctaTo: null,
    },
  ];

  // The flow diagram — what happens when a new review arrives, in
  // ASCII-art-ish text because actual diagrams need a designer or a
  // diagram tool both of which cost time. This text version reads
  // identically on mobile, desktop, screen reader, and prints.
  const flowSteps = [
    {
      en: 'Customer leaves a Google review',
      th: 'ลูกค้าเขียนรีวิวบน Google',
    },
    {
      en: 'ReviewHub spots it (within 30 minutes)',
      th: 'ReviewHub ตรวจพบรีวิวใหม่ (ภายใน 30 นาที)',
    },
    {
      en: 'AI drafts a reply in your voice',
      th: 'AI ร่างคำตอบในโทนของร้าน',
    },
    {
      en: 'LINE or Telegram pings you with the review + draft',
      th: 'LINE หรือ Telegram แจ้งเตือนคุณพร้อมรีวิว + ร่างคำตอบ',
    },
    {
      en: 'You read, edit if needed, tap "Copy reply"',
      th: 'คุณอ่าน ปรับแก้ถ้าต้องการ แตะ "ก็อปคำตอบ"',
    },
    {
      en: 'Paste into Google → reply lives. Takes 30 seconds.',
      th: 'วางลง Google → คำตอบขึ้นทันที ใช้เวลา 30 วินาที',
    },
  ];

  // FAQ — different from landing/audit-preview FAQs. These answer the
  // "I just signed up, what do I do?" questions specifically.
  const faqs = [
    {
      qEn: 'I signed up but don\'t see any reviews — what do I do?',
      qTh: 'สมัครแล้วแต่ไม่เห็นรีวิว ทำไง?',
      aEn: 'You haven\'t connected Google yet. Go to Settings → Connect Google. The Free plan supports 1 connected business; once you connect, ReviewHub pulls your last 50 reviews within 5 minutes.',
      aTh: 'ยังไม่ได้เชื่อม Google ไปที่ Settings → เชื่อม Google แพ็กเกจฟรีรองรับ 1 ธุรกิจ เมื่อเชื่อมแล้ว ReviewHub จะดึงรีวิว 50 อันล่าสุดให้ภายใน 5 นาที',
    },
    {
      qEn: 'Where do I find my Google Place ID?',
      qTh: 'หา Google Place ID ได้จากที่ไหน?',
      aEn: 'You don\'t need to find it manually. In Settings → Connect Google, the manual-paste form has a "Don\'t know your Place ID? Look it up by name" link. Type your business name, pick from up to 3 suggestions, the Place ID auto-fills. Or use the Sign-in-with-Google button which skips Place IDs entirely.',
      aTh: 'ไม่ต้องหาเอง ที่ Settings → เชื่อม Google ในฟอร์มกรอกเอง มีลิงก์ "ไม่รู้ Place ID? ค้นหาจากชื่อร้าน" พิมพ์ชื่อร้าน เลือกจาก 3 ตัวเลือก Place ID จะกรอกอัตโนมัติ หรือใช้ปุ่ม Sign in with Google ก็ได้ ไม่ต้องใช้ Place ID เลย',
    },
    {
      qEn: 'I missed a chat notification — is the review lost?',
      qTh: 'พลาดการแจ้งเตือนในแชต รีวิวหายไหม?',
      aEn: 'No. Every review and its draft also lives on your dashboard at /dashboard. The LINE or Telegram message is the alert; the dashboard is the system of record. Drafts stay there indefinitely until you reply or delete.',
      aTh: 'ไม่หาย รีวิวและร่างคำตอบทุกอันอยู่ที่ dashboard ของคุณที่ /dashboard ด้วย แชตคือการแจ้งเตือน dashboard คือที่บันทึกถาวร ร่างคำตอบจะอยู่ที่นั่นจนกว่าคุณจะตอบหรือลบ',
    },
    {
      qEn: 'Can I edit the AI draft before sending?',
      qTh: 'แก้ไขคำตอบที่ AI ร่างก่อนส่งได้ไหม?',
      aEn: 'Yes — always. On the LINE card, tap "Edit" to open the dashboard view where you can rewrite freely. On the dashboard, just click into the draft text and edit. Nothing posts to Google without your explicit copy + paste (or, in v2, your tap "Approve").',
      aTh: 'ได้ครับ ตลอดเวลา บน LINE card แตะ "Edit" เพื่อเปิดหน้า dashboard ที่แก้ไขได้อิสระ บน dashboard แค่คลิกในข้อความก็แก้ได้ ไม่มีอะไรส่งไป Google โดยที่คุณไม่ได้ก็อปวาง (หรือในเวอร์ชัน v2 ก็แค่แตะ "อนุมัติ")',
    },
    {
      qEn: 'How does ReviewHub know my "voice"?',
      qTh: 'ReviewHub รู้โทนของร้านได้ยังไง?',
      aEn: 'Two inputs: (1) you set a tone preference in Settings — casual, warm, or formal — and every draft uses it; (2) the AI reads your existing replies on Google (if any) and matches the patterns. Week one usually needs editing; by week three, drafts often need only a one-word tweak.',
      aTh: 'สองทาง: (1) ตั้งค่าโทนใน Settings — สบายๆ อบอุ่น หรือทางการ — AI ใช้โทนนี้ตลอด (2) AI อ่านคำตอบที่คุณเคยเขียนบน Google แล้วเลียนแบบ สัปดาห์แรกอาจต้องแก้บ่อย พอถึงสัปดาห์ที่ 3 ส่วนใหญ่แก้แค่คำเดียว',
    },
    {
      qEn: 'What about replies in Japanese, Chinese, Korean reviews?',
      qTh: 'รีวิวภาษาญี่ปุ่น/จีน/เกาหลี ตอบได้ไหม?',
      aEn: 'ReviewHub auto-detects the reviewer\'s language and drafts the reply in the same language. Japanese reviewer gets a Japanese reply, not English. Most competitors only do English.',
      aTh: 'ReviewHub ตรวจภาษาของรีวิวอัตโนมัติ และร่างคำตอบเป็นภาษาเดียวกัน รีวิวญี่ปุ่นได้คำตอบเป็นญี่ปุ่น ไม่ใช่อังกฤษ คู่แข่งส่วนใหญ่ทำได้แค่ภาษาอังกฤษ',
    },
    {
      qEn: 'How do I cancel?',
      qTh: 'ยกเลิกยังไง?',
      aEn: 'Settings → Billing → Cancel. One click, no questions. You keep access through the end of the billing period. Free month: 30-day refund window, no questions asked.',
      aTh: 'Settings → Billing → ยกเลิก คลิกเดียว ไม่ถามอะไร คุณยังใช้ได้จนถึงสิ้นรอบบิลปัจจุบัน เดือนแรก: คืนเงินเต็มภายใน 30 วัน ไม่ถามเหตุผล',
    },
  ];

  return (
    <div className="rh-design rh-app min-h-screen" style={{ background: 'var(--rh-paper)', color: 'var(--rh-ink)' }}>
      <MarketingNav />

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-5 pt-16 pb-12 md:pt-24 md:pb-16">
        <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--rh-ochre)' }}>
          {isThai ? 'วิธีใช้งาน' : 'How it works'}
        </p>
        <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4" style={{ letterSpacing: '-0.02em' }}>
          {isThai ? 'เริ่มใช้ ReviewHub ใน 10 นาที' : 'Get set up in 10 minutes'}
        </h1>
        <p className="text-lg md:text-xl leading-relaxed" style={{ color: 'var(--rh-ink-soft)' }}>
          {isThai
            ? 'สี่ขั้นตอน เชื่อม Google, เชื่อม LINE, รีวิวใหม่เด้งเข้าทุกครั้ง พร้อมคำตอบที่ AI ร่างให้ ใช้เวลาตั้งค่าครั้งเดียว ใช้ฟรีตลอดถ้ารีวิวไม่เกิน 3 อันต่อเดือน'
            : 'Four steps: connect Google, connect LINE, every new review pings you with an AI-drafted reply ready to send. Set up once. Free forever if you stay under 3 reviews/month.'}
        </p>
      </section>

      {/* The 4 steps */}
      <section className="max-w-3xl mx-auto px-5 pb-16">
        <div className="space-y-6">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className="rounded-2xl p-6 md:p-8"
              style={{
                background: 'var(--rh-card-bg, #ffffff)',
                border: '1px solid var(--rh-line)',
                boxShadow: '0 1px 3px rgba(29,36,44,0.05), 0 1px 2px rgba(29,36,44,0.03)',
              }}
            >
              <div className="flex items-start gap-4 md:gap-6">
                <div
                  className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-xl font-bold"
                  style={{ background: 'var(--rh-teal-deep)', color: '#fff' }}
                  aria-hidden="true"
                >
                  {s.n}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl md:text-2xl font-bold mb-2" style={{ letterSpacing: '-0.01em' }}>
                    {isThai ? s.titleTh : s.titleEn}
                  </h2>
                  <p className="leading-relaxed mb-4" style={{ color: 'var(--rh-ink-soft)', fontSize: '15px' }}>
                    {isThai ? s.bodyTh : s.bodyEn}
                  </p>
                  {s.ctaTo && (
                    <Link
                      to={s.ctaTo}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg"
                      style={{ background: 'var(--rh-teal-deep)', color: '#fff' }}
                    >
                      {isThai ? s.ctaTh : s.ctaEn}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Flow diagram */}
      <section className="max-w-3xl mx-auto px-5 pb-16">
        <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--rh-ink-dim)' }}>
          {isThai ? 'รีวิวใหม่เข้ามา ระบบทำอะไรบ้าง' : 'When a new review arrives'}
        </p>
        <h2 className="text-2xl md:text-3xl font-bold mb-8" style={{ letterSpacing: '-0.02em' }}>
          {isThai ? 'จากลูกค้ากดส่ง ถึงคุณตอบเสร็จ — 30 วินาที' : 'From customer-sent to your-replied: 30 seconds'}
        </h2>
        <ol className="space-y-4">
          {flowSteps.map((step, i) => (
            <li key={i} className="flex items-start gap-4">
              <div
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  background: i === flowSteps.length - 1 ? 'var(--rh-sage)' : 'var(--rh-paper)',
                  color: i === flowSteps.length - 1 ? '#fff' : 'var(--rh-ink)',
                  border: '1px solid var(--rh-line)',
                }}
                aria-hidden="true"
              >
                {i + 1}
              </div>
              <p className="flex-1 leading-relaxed pt-0.5" style={{ fontSize: '15px' }}>
                {isThai ? step.th : step.en}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-5 pb-16">
        <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--rh-ink-dim)' }}>
          {isThai ? 'คำถามที่พบบ่อย' : 'Common questions'}
        </p>
        <h2 className="text-2xl md:text-3xl font-bold mb-8" style={{ letterSpacing: '-0.02em' }}>
          {isThai ? 'หลังสมัครแล้ว มักจะติดตรงไหน' : 'The questions new signups actually ask'}
        </h2>
        <div className="space-y-2">
          {faqs.map((f, i) => (
            <details
              key={i}
              className="rounded-xl"
              style={{
                background: 'var(--rh-card-bg, #ffffff)',
                border: '1px solid var(--rh-line)',
              }}
            >
              <summary
                className="px-5 py-4 cursor-pointer text-base font-semibold list-none flex justify-between items-center gap-3"
                style={{ color: 'var(--rh-ink)' }}
              >
                <span>{isThai ? f.qTh : f.qEn}</span>
                <span aria-hidden="true" style={{ color: 'var(--rh-ink-dim)' }}>+</span>
              </summary>
              <p className="px-5 pb-5 pt-1 leading-relaxed" style={{ color: 'var(--rh-ink-soft)', fontSize: '15px' }}>
                {isThai ? f.aTh : f.aEn}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Still stuck → support */}
      <section className="max-w-3xl mx-auto px-5 pb-16 md:pb-24">
        <div
          className="rounded-2xl p-8 md:p-10 text-center"
          style={{ background: 'var(--rh-teal-deep)', color: '#fff' }}
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ letterSpacing: '-0.01em' }}>
            {isThai ? 'ยังติดอยู่?' : 'Still stuck?'}
          </h2>
          <p className="text-sm md:text-base mb-6 max-w-md mx-auto leading-relaxed" style={{ color: '#fdf2dc' }}>
            {isThai
              ? 'ติดต่อมาที่ /support ได้เลย ส่วนใหญ่ตอบภายใน 24 ชม. — Earth ผู้ก่อตั้งตอบเอง'
              : 'Email /support and the founder (Earth) replies personally — usually within 24 hours.'}
          </p>
          <Link
            to="/support"
            className="inline-block px-6 py-3 rounded-lg text-sm font-semibold"
            style={{ background: '#fff', color: 'var(--rh-teal-deep)' }}
          >
            {isThai ? 'ไปที่ Support →' : 'Go to Support →'}
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
