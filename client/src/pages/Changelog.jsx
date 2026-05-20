import React from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';
import usePageTitle from '../hooks/usePageTitle';
import useSocialMeta from '../hooks/useSocialMeta';
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
  const isThai = lang === 'th';
  // Browser tab title — matches page heading, not English fallback. This is
  // the only string here that went through t() before; switched to inline
  // bilingual to match the rest of this page's pattern (8 other isThai
  // checks render content directly, no key indirection).
  usePageTitle(isThai ? 'มีอะไรใหม่ · ReviewHub' : 'Changelog · ReviewHub');
  useSocialMeta({
    title: isThai ? 'มีอะไรใหม่ · ReviewHub' : 'Changelog · ReviewHub',
    description: isThai
      ? 'ฟีเจอร์และการแก้ไขที่เพิ่งเปิดตัวบน ReviewHub ปรับปรุงอย่างต่อเนื่อง — โปร่งใสในระดับ commit'
      : 'Recently-shipped features and fixes on ReviewHub. Honest, commit-level transparency for developers + buyers evaluating tools.',
  });

  const REPO = 'https://github.com/Authentae/reviewhub/commits/main';

  // Curated highlights — each entry is what a customer would care about,
  // not raw commit titles. Update this list when shipping anything that
  // a paying user would notice.
  const highlights = [
    {
      date: '2026-05-19',
      en: 'Tone switcher on the audit preview — every reply draft now ships as three tone variants you can flip between with one tap (warm / concise / formal). Direct response to the "will the AI sound like a robot?" objection that surfaced in customer-dev. Pre-generated server-side at audit creation, so the toggle is instant.',
      th: 'ปุ่มสลับโทนบน audit preview — ทุกร่างคำตอบมาเป็นสามโทน (อบอุ่น / กระชับ / ทางการ) สลับด้วยแตะเดียว ตอบโจทย์ "AI จะตอบเหมือนหุ่นไหม" สร้างไว้ล่วงหน้าฝั่งเซิร์ฟเวอร์ตอน audit สร้าง — สลับได้ทันที',
    },
    {
      date: '2026-05-19',
      en: 'Pro & Business waitlist on /pricing — replaced the dead "Coming soon" buttons with email-capture. Email + plan tagged with source. Founder gets an alert on every signup with the running count. Lets us measure real demand for the gated tiers before building features speculatively.',
      th: 'รายชื่อรอ Pro และ Business บน /pricing — เปลี่ยนปุ่ม "Coming soon" ที่กดไม่ได้เป็นช่องเก็บอีเมล Founder ได้แจ้งทุกการสมัครพร้อมยอดรวม วัด demand จริงก่อนสร้างฟีเจอร์',
    },
    {
      date: '2026-05-19',
      en: 'Public demo audit at /audit-demo — pricing-page visitors who arrive without an outreach link can now see a sample audit (Common Grounds café, 5★/3★/1★ reviews + warm/concise/formal tone variants) without a signup.',
      th: '/audit-demo เปิดให้ดูตัวอย่าง audit แบบสาธารณะ — คนเข้า /pricing โดยไม่มีลิงก์เชิญดู audit ตัวอย่างได้ (ร้านคาเฟ่ Common Grounds พร้อมรีวิว 5★/3★/1★ และตัวเลือกโทนทั้งสาม) ไม่ต้องสมัคร',
    },
    {
      date: '2026-05-19',
      en: 'New blog posts: "ChatGPT for Google review replies — what works, what breaks" and "How fast should you reply to Google reviews?" (both EN + TH). Plus an editorial 404 page, a "NEW" badge on the /blog index for posts <7 days old, and refreshed social-share image to match the current landing hero.',
      th: 'บล็อกใหม่: "ใช้ ChatGPT ตอบรีวิว Google" และ "ตอบรีวิวเร็วแค่ไหนถึงจะดี?" (ทั้ง EN + TH) เพิ่ม 404 ใหม่ตามสไตล์แบรนด์ ป้าย "ใหม่" บน /blog สำหรับโพสต์อายุน้อยกว่า 7 วัน และอัพเดตภาพ social-share ให้ตรงกับ landing ปัจจุบัน',
    },
    {
      date: '2026-05-19',
      en: 'Onboarding checklist on Settings — first-time customers now see a 2-step "Connect Google" / "Connect LINE or Telegram" checklist at the top of Settings until both are done. Polls every 8 seconds for state changes so a customer who finishes a connect in another tab sees the checkmark within a few seconds.',
      th: 'Checklist แนะนำเริ่มต้นบน Settings — ลูกค้าใหม่จะเห็น checklist 2 ขั้นตอน (เชื่อม Google / เชื่อม LINE หรือ Telegram) ที่ด้านบนของ Settings จนกว่าจะครบ ระบบเช็คทุก 8 วินาทีเพื่อให้ checkmark ขึ้นทันทีเมื่อเชื่อมเสร็จในอีกแท็บ',
    },
    {
      date: '2026-05-10',
      en: 'Settings → Connect LINE OA section shipped. The LINE-pivot headline feature was half-built — webhook + push existed but no UI for users to actually link their LINE account. Now there is: generate a one-time link code in Settings, send "/link <code>" to the ReviewHub LINE OA bot, the section flips to "Connected" within ~10s. After that, every new Google review pings your LINE chat with the AI-drafted reply. Privacy policy updated to disclose LINE Corp as a sub-processor.',
      th: 'เพิ่มส่วน "เชื่อม LINE OA" ที่ Settings — ฟีเจอร์หัวเรือของ LINE pivot ที่เคยทำได้ครึ่งหนึ่ง (มี webhook + push แต่ไม่มี UI ให้ผู้ใช้เชื่อม) ตอนนี้สร้างโค้ดเชื่อมที่ Settings ส่ง "/link <โค้ด>" ให้ LINE OA ของ ReviewHub แล้วเชื่อมเสร็จใน ~10 วินาที จากนั้นรีวิว Google ใหม่ทุกอันจะเด้งเข้า LINE คุณพร้อมร่างคำตอบ AI / อัปเดต privacy เพิ่ม LINE Corp เป็น sub-processor แล้ว',
    },
    {
      date: '2026-05-10',
      en: 'New /guide page — central "How ReviewHub works" walkthrough. Four numbered steps (sign up → connect Google → connect LINE → tap-to-copy) with the LINE notification flow diagram and 7 FAQs targeting the actual signup-to-activation friction. Linked from the footer Product menu.',
      th: 'เพิ่มหน้า /guide — สาธิตการใช้งาน 4 ขั้นตอน (สมัคร → เชื่อม Google → เชื่อม LINE → แตะก็อป) พร้อมแผนภาพการแจ้งเตือนผ่าน LINE และ FAQ 7 ข้อสำหรับคำถามที่ลูกค้าใหม่ติดบ่อย ลิงก์จาก footer',
    },
    {
      date: '2026-05-10',
      en: 'AuditPreview page polish — bigger Copy button (44×44 tap target with "Copied ✓" feedback state), paper-lift card shadow, sticky bottom CTA bar, Plausible funnel events on Copy clicks + scroll depth (25/50/75/100%) so we can measure prospect engagement on Wave 4 sends.',
      th: 'ปรับปรุงหน้า audit-preview — ปุ่ม Copy ใหญ่ขึ้น (44×44 พร้อมแสดงสถานะ "Copied ✓"), เพิ่มเงาการ์ด, แถบ CTA ติดด้านล่าง, ติด Plausible event บนปุ่ม Copy และวัดการเลื่อนหน้า เพื่อติดตามผลของลูกค้า Wave 4',
    },
    {
      date: '2026-05-10',
      en: 'Pricing + Landing + /line + AuditPreview copy aligned with LINE-pivot reality — every "we post to Google for you" claim updated to "tap to copy from LINE → paste in Google" with the honest Q3 2026 auto-post roadmap (waiting on Google Business Profile API approval, case 8-9395000041442 submitted 2026-05-09).',
      th: 'ปรับ copy ทุกหน้า (Pricing, Landing, /line, audit-preview) ให้ตรงกับ LINE pivot — เปลี่ยนจาก "เราโพสต์ให้อัตโนมัติ" เป็น "แตะก็อปจาก LINE → วางใน Google" พร้อมระบุไตรมาส 3 ปี 2026 สำหรับฟีเจอร์โพสต์อัตโนมัติ (รอ Google อนุมัติ Business Profile API)',
    },
    {
      date: '2026-05-10',
      en: 'Dashboard rating-distribution bug fix — the 4★ and 2★ bars were rendering with a 12% paper-mix opacity instead of their saturated Tailwind colours, making them nearly invisible against the warm cream background. Brand-token CSS override was bundling solid data-viz classes (`bg-lime-400`, `bg-orange-400`) with soft-tint classes (`bg-xxx-50/100/200`); split them.',
      th: 'แก้บั๊ก: แถบ 4 ดาวและ 2 ดาวบนแดชบอร์ดมองไม่เห็น สี Tailwind ถูก override จากระบบ brand token เลยกลายเป็นสีจางมาก แยก class สีหลักออกจาก class สีอ่อนแล้ว',
    },
    {
      date: '2026-05-09',
      en: 'LINE Official Account integration shipped — webhook handler with HMAC-SHA256 signature verification, /link <code> chat command for owner-account binding, push-notification helper, Flex card template for review notifications. Once you connect LINE in Settings, every new Google review pings your LINE chat with the AI-drafted reply ready to copy.',
      th: 'เชื่อม LINE Official Account แล้ว — มี webhook พร้อมตรวจลายเซ็น HMAC-SHA256, คำสั่ง /link <โค้ด> ในแชทเพื่อเชื่อมบัญชี, ระบบส่งแจ้งเตือนแบบ push, การ์ด Flex สำหรับการแจ้งเตือนรีวิว เชื่อม LINE ที่ Settings แล้ว รีวิว Google ใหม่จะแจ้งเตือนเข้า LINE พร้อมร่างคำตอบให้ก็อปได้เลย',
    },
    {
      date: '2026-05-09',
      en: 'Places API (NEW) v1 read-only adapter — `googlePlaces.js` provider + 30-min cron poller + Settings UI Place ID lookup-by-name + 27 unit/integration tests. Lets v1 launch without waiting on Google Business Profile API approval. Activates when GOOGLE_MAPS_API_KEY env var is set.',
      th: 'อะแดปเตอร์ Places API (NEW) แบบอ่านอย่างเดียว — `googlePlaces.js` + cron poll ทุก 30 นาที + UI ค้นหา Place ID จากชื่อ + tests 27 ตัว เปิดให้ใช้ v1 ได้โดยไม่ต้องรอ Google อนุมัติ Business Profile API จะเริ่มทำงานเมื่อ set ตัวแปร GOOGLE_MAPS_API_KEY',
    },
    {
      date: '2026-05-08',
      en: 'New blog post — "Wongnai vs Google reviews — which one should Bangkok restaurants prioritize?" (6 min read, EN + TH). Honest breakdown by customer mix: tourist-heavy → 100% Google, local-heavy → 70/30 Wongnai. Plus the audience and search-visibility tables.',
      th: 'บทความใหม่ — "Wongnai vs รีวิว Google สำหรับร้านอาหารในกรุงเทพฯ" (อ่าน 6 นาที, EN + TH) ตัดสินใจตามลูกค้าที่มาร้าน: ต่างชาติ → 100% Google, คนไทย → 70/30 Wongnai พร้อมตารางเปรียบเทียบ',
    },
    {
      date: '2026-05-08',
      en: 'Blog index now has language filter pills (All / EN / TH) with localStorage persistence — visitors land on posts in their UI language by default but can flip to "All" to see both versions side-by-side.',
      th: 'หน้าบล็อกตอนนี้มีปุ่มกรองภาษา (ทั้งหมด / EN / TH) จำตัวเลือกไว้ใน localStorage — เห็นโพสต์ภาษา UI โดย default แต่กด "ทั้งหมด" เพื่อดูทั้งสองภาษาเทียบกันได้',
    },
    {
      date: '2026-05-08',
      en: 'New EN blog post — "5 Google review mistakes Bangkok hospitality owners keep making" (7 min read). Patterns from real Bangkok properties, what 200+ review properties do differently, and the 48-hour reply window that lifts star-rating updates 4×.',
      th: 'บทความใหม่ภาษาอังกฤษ — "5 Google review mistakes Bangkok hospitality owners keep making" (อ่าน 7 นาที) Pattern จากโรงแรม/ร้านอาหารในกรุงเทพฯ จริง ว่าทำไมร้านที่มี 200+ รีวิวต่างจากร้านอื่น และ 48 ชั่วโมงทำไมสำคัญ',
    },
    {
      date: '2026-05-08',
      en: 'Thai-English blog parity reached 7/7 — translated all remaining EN posts (transfer-ownership, how-to-ask, how-to-remove, fake-extortion, why-respond) into Thai for Bangkok hospitality owners. Each post is its own page with native Thai script, Schema.org markup, and bilingual breadcrumbs.',
      th: 'บทความครบทั้ง EN/TH 7 ต่อ 7 — แปลบทความที่เหลือทั้งหมด (โอนเจ้าของ, ขอรีวิว, ลบรีวิว, รีวิวปลอม/แบล็กเมล, ทำไมต้องตอบ) เป็นภาษาไทย แต่ละบทความเป็นหน้าของตัวเอง พร้อม Schema.org และ breadcrumb สองภาษา',
    },
    {
      date: '2026-05-08',
      en: 'Internal-linking pass — every blog post now ships with a "Related posts" section linking to its 2 most-related siblings. Lifts session length and SEO internal-link signal.',
      th: 'ทำ internal linking — ทุกบทความตอนนี้มีส่วน "บทความที่เกี่ยวข้อง" ลิงก์ไปบทความใกล้เคียง 2 อัน เพิ่มเวลาที่อ่านและสัญญาณ SEO',
    },
    {
      date: '2026-05-07',
      en: 'New Thai blog post — "Replying to English Google reviews professionally" (8 min read). For Bangkok hotel and café owners whose tourists leave reviews in English. Six principles + five copy-pasteable scenarios.',
      th: 'บทความใหม่ภาษาไทย — "ตอบรีวิว Google ภาษาอังกฤษให้ดูเป็นมืออาชีพ" (อ่าน 8 นาที) สำหรับเจ้าของโรงแรมและคาเฟ่ในกรุงเทพฯ ที่นักท่องเที่ยวเขียนรีวิวเป็นภาษาอังกฤษ มีหลักการ 6 ข้อ + 5 สถานการณ์จริงพร้อมเทมเพลต',
    },
    {
      date: '2026-05-07',
      en: 'Cleaner link previews — every blog post and the audit-preview page now ship with PNG og:image + Twitter Card meta + breadcrumb structured data. When you paste a ReviewHub link into iMessage, LINE, Slack, or Discord, the preview card now renders properly instead of a generic placeholder.',
      th: 'ลิงก์พรีวิวสะอาดขึ้น — บทความทุกตอน + หน้า /audit-preview แสดงรูปการ์ด og:image แบบ PNG พร้อม Twitter Card meta + breadcrumb structured data วาง URL ของ ReviewHub ใน iMessage / LINE / Slack / Discord ตอนนี้ขึ้นการ์ดพรีวิวสวยแล้ว ไม่ใช่ placeholder',
    },
    {
      date: '2026-05-07',
      en: 'Onboarding emails (Day 0 / 1 / 7 / 14) rewritten in founder voice — single CTA, real expectations, signed off by Earth instead of by "the ReviewHub team". Available in EN / TH / ES / JA.',
      th: 'อีเมลต้อนรับ (วันที่ 0 / 1 / 7 / 14) เขียนใหม่ในเสียงของเจ้าของจริง — call-to-action เดียว คาดหวังตามความเป็นจริง เซ็นชื่อโดย Earth แทนที่จะเป็น "ทีม ReviewHub" มีให้เลือก EN / TH / ES / JA',
    },
    {
      date: '2026-05-07',
      en: 'New blog post — "How to remove a Google review (the honest playbook)" (9 min read). What Google actually removes vs. what they won\'t, the flag-and-wait process, and the escalation path most owners don\'t know exists.',
      th: 'บทความใหม่ — "How to remove a Google review (the honest playbook)" (อ่าน 9 นาที) Google ลบรีวิวอะไรได้บ้าง อะไรลบไม่ได้ flag แล้วต้องรอนานแค่ไหน และเส้นทาง escalation ที่เจ้าของส่วนใหญ่ไม่รู้ว่ามี',
    },
    {
      date: '2026-05-06',
      en: 'New blog post — "How to ask customers for Google reviews without being pushy" (7 min read). Five natural ask-windows, why discount-for-review violates Google policy, the QR-code mistake, and the 1-star prevention move.',
      th: 'บทความใหม่ — วิธีขอรีวิว Google จากลูกค้าโดยไม่ดูยัดเยียด (อ่าน 7 นาที) มี 5 จังหวะที่เป็นธรรมชาติในการขอ ทำไมแลกส่วนลดกับรีวิวผิดนโยบาย Google ความผิดพลาดเรื่อง QR code และเทคนิคป้องกันรีวิว 1 ดาว',
    },
    {
      date: '2026-05-06',
      en: 'New blog post — "How to transfer Google Business Profile ownership" (8 min read). Adding a manager vs transferring primary ownership, the 7-day waiting period, and the shortcut nobody mentions.',
      th: 'บทความใหม่ — วิธีโอนเจ้าของ Google Business Profile (อ่าน 8 นาที) เพิ่ม manager กับโอนเจ้าของจริงต่างกันยังไง รอ 7 วันคืออะไร และทางลัดที่ไม่ค่อยมีใครพูดถึง',
    },
    {
      date: '2026-05-06',
      en: 'Audit-preview page polish — CTA trust line ("No credit card to start · 14-day refund window · cancel anytime"), inline FAQ with the 5 questions SMB owners actually ask, dark-mode background bug fixed, and a sharper time-saved claim ("Replies that took 30 minutes each take 30 seconds").',
      th: 'ปรับหน้า /audit-preview — เพิ่มข้อความ trust ใต้ CTA ("ไม่ต้องใส่บัตรเครดิต · คืนเงินภายใน 14 วัน · ยกเลิกได้ตลอด") เพิ่ม FAQ ตอบ 5 คำถามที่เจ้าของร้านถามจริง แก้ bug background dark mode และปรับข้อความใหม่ให้คมขึ้น',
    },
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
            ? 'สิ่งที่เปลี่ยนแปลงล่าสุด เลือกเฉพาะที่คุณจะได้รู้สึก ไม่ใช่ทุก commit ดู log เต็มๆ ที่ '
            : 'What changed recently. Highlights — not every commit. Full log on '}
          <a href={REPO} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--rh-teal-deep)', fontWeight: 600 }}>GitHub →</a>
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
      <MarketingFooter />
    </div>
  );
}
