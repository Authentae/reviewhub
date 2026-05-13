import React from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';
import usePageTitle from '../hooks/usePageTitle';
import useSocialMeta from '../hooks/useSocialMeta';
import { useI18n } from '../context/I18nContext';

// /line — LINE-native positioning landing page.
//
// Built 2026-05-09 as part of the LINE-native pivot. Frames the
// product around what foreign competitors (Birdeye / Podium / NiceJob)
// can't do: real-time LINE OA notifications when a Google review
// lands, with the AI-drafted reply ready in the same LINE chat.
//
// Honesty bridge: drafts + audits work today. LINE OA notification
// integration ships June 2026. The page is explicit about that
// timeline — no vapor claims.
//
// Conversion path: same as /audit. CTA links to
// `/audit?from=line` so we can tell apart LINE-positioning visitors
// from the generic audit-landing visitors. The from= param flows
// through to register attribution per the existing audit-flow
// mechanism.

const HOTEL_BG = 'rgba(30, 77, 94, 0.08)';

// Three-step workflow visual. Numbered cards in a horizontal row
// (stacks vertically on mobile via responsive Tailwind classes).
const STEPS = [
  {
    n: '1',
    titleEn: 'New Google review',
    titleTh: 'รีวิวมาที่ Google',
    descEn: 'A guest leaves a review on your Google Business profile.',
    descTh: 'ลูกค้าเขียนรีวิวใน Google ของร้านคุณ',
  },
  {
    n: '2',
    titleEn: 'LINE notification',
    titleTh: 'แจ้งเตือนใน LINE',
    descEn: 'Your LINE OA pings within seconds with the review + an AI-drafted reply in your voice.',
    descTh: 'LINE OA ของร้านแจ้งเตือนทันที พร้อมร่างคำตอบที่ AI เขียนในโทนของร้าน',
  },
  {
    n: '3',
    titleEn: 'Copy the draft, paste in Google',
    titleTh: 'ก็อปคำตอบ แล้ววางใน Google',
    descEn: 'The AI draft arrives as a follow-up text in your LINE chat — long-press to copy, tap Reply on Google, paste. 30 seconds total. (One-tap auto-post launches Q3 2026 when Google approves our API access.)',
    descTh: 'คำตอบ AI มาเป็นข้อความตามมาในแชต LINE — กดค้างเพื่อก็อป แตะ ตอบที่ Google แล้ววาง 30 วินาทีจบ (โพสต์อัตโนมัติแบบคลิกเดียว เปิดตัวไตรมาส 3 ปี 2026 เมื่อ Google อนุมัติ API)',
  },
];

export default function LinePivot() {
  const { lang } = useI18n();
  const isThai = lang === 'th';

  usePageTitle(
    isThai
      ? 'ReviewHub × LINE — แจ้งเตือนรีวิว Google ผ่าน LINE'
      : 'ReviewHub × LINE — Google review notifications via LINE OA'
  );

  useSocialMeta({
    title: isThai
      ? 'แจ้งเตือนรีวิว Google ผ่าน LINE — ตอบกลับใน 30 วินาที'
      : 'Google review notifications via LINE — reply in 30 seconds',
    description: isThai
      ? 'รีวิวใหม่บน Google → LINE แจ้งทันทีพร้อมร่างคำตอบ AI → ก็อปแล้ววางใน Google ทำในกรุงเทพสำหรับเจ้าของโรงแรม ร้านอาหาร คลินิก'
      : 'New Google review → LINE notification with AI-drafted reply → copy & paste in Google. Built in Bangkok for hospitality, restaurants, clinics, salons.',
  });

  return (
    <div className="min-h-screen bg-[var(--rh-paper)] text-[var(--rh-ink)]">
      <MarketingNav />

      {/* Hero */}
      <section className="rh-shell pt-12 md:pt-20 pb-12 md:pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <p
            className="text-xs md:text-sm font-mono uppercase tracking-widest mb-4"
            style={{ color: 'var(--rh-teal)', opacity: 0.85 }}
          >
            {isThai
              ? 'ทำในกรุงเทพ · LINE OA เปิดให้ใช้แล้ว'
              : 'Built in Bangkok · LINE OA live now'}
          </p>

          <h1
            className="text-3xl md:text-5xl font-bold mb-5"
            style={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}
          >
            {isThai
              ? 'รีวิวมาเมื่อไหร่ ได้รับแจ้งใน LINE ทันที'
              : 'Get a LINE notification when a Google review lands.'}
          </h1>

          <p
            className="text-base md:text-lg mb-8 max-w-2xl mx-auto leading-relaxed"
            style={{ color: 'var(--rh-ink-soft)' }}
          >
            {isThai
              ? 'รีวิวใหม่เด้งเข้า LINE ของคุณภายในไม่กี่นาที พร้อมร่างคำตอบที่ AI เขียนไว้ ก็อปแล้ววางใน Google เครื่องมือต่างประเทศใช้ Slack/อีเมล ซึ่งเจ้าของร้านในกรุงเทพไม่ได้เปิดบ่อย ReviewHub สร้างมาเฉพาะสำหรับวิธีทำงานของคุณ'
              : "New reviews ping your LINE Official Account within minutes, with an AI-drafted reply ready. Copy from LINE, paste in Google. Foreign tools (Birdeye, Podium) notify via Slack and email — channels Bangkok owners don't actually check. ReviewHub fits how you actually work."}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link
              to="/audit?from=line"
              className="inline-block px-6 py-3 rounded-lg text-sm md:text-base font-semibold"
              style={{
                background: 'var(--rh-teal)',
                color: 'var(--rh-paper)',
              }}
            >
              {isThai
                ? 'รับ audit ฟรี + ลงทะเบียนใช้ก่อน'
                : 'Claim a free audit + early LINE access'}
            </Link>
            <Link
              to="/pricing"
              className="text-sm md:text-base font-medium underline"
              style={{ color: 'var(--rh-teal)' }}
            >
              {isThai ? 'ดูราคา' : 'See pricing'}
            </Link>
          </div>

          <p className="text-xs mt-4" style={{ color: 'var(--rh-ink-soft)', opacity: 0.7 }}>
            {isThai
              ? 'ฟรี 3 ร่าง/เดือน · ไม่ต้องใส่บัตรเครดิต · เริ่มต้น ฿499/เดือน'
              : '3 free drafts/month · No credit card · From ฿499 / $14 a month'}
          </p>
        </div>
      </section>

      {/* Three-step workflow */}
      <section
        className="py-12 md:py-16"
        style={{ background: HOTEL_BG }}
      >
        <div className="rh-shell">
          <h2
            className="text-2xl md:text-3xl font-bold mb-10 text-center"
            style={{ letterSpacing: '-0.01em' }}
          >
            {isThai ? 'ทำงานยังไง' : 'How it works'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl p-6 md:p-7"
                style={{ background: 'var(--rh-paper)', border: '1px solid rgba(30, 77, 94, 0.15)' }}
              >
                <div
                  className="text-3xl font-bold mb-3 font-mono"
                  style={{ color: 'var(--rh-teal)' }}
                >
                  {s.n}
                </div>
                <h3 className="text-lg font-bold mb-2">{isThai ? s.titleTh : s.titleEn}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--rh-ink-soft)' }}>
                  {isThai ? s.descTh : s.descEn}
                </p>
              </div>
            ))}
          </div>

          <p
            className="text-xs md:text-sm text-center mt-10 max-w-2xl mx-auto"
            style={{ color: 'var(--rh-ink-soft)', opacity: 0.85 }}
          >
            {isThai
              ? 'รีวิวต่อไปจาก Wongnai, Facebook, TripAdvisor และ 60+ แพลตฟอร์มอื่นนำเข้าผ่าน CSV ได้ครับ — แจ้งเตือน LINE สำหรับ Google ก่อน แพลตฟอร์มอื่นมาตามมา'
              : 'Next: Wongnai, Facebook, TripAdvisor, and 60+ other platforms via CSV import. LINE notifications for Google first; the rest follow.'}
          </p>
        </div>
      </section>

      {/* Why us, not Birdeye / Podium */}
      <section className="rh-shell py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <h2
            className="text-2xl md:text-3xl font-bold mb-6"
            style={{ letterSpacing: '-0.01em' }}
          >
            {isThai ? 'ทำไมไม่ใช้ Birdeye / Podium' : 'Why not Birdeye / Podium'}
          </h2>

          <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--rh-ink-soft)' }}>
            {isThai
              ? 'เครื่องมือต่างประเทศพวกนี้ดีในตลาดของเขา แต่สร้างมาสำหรับเจ้าของร้านในอเมริกาที่อยู่ใน Slack ทั้งวัน เริ่มต้นที่ $299 (~฿10,000)/เดือน และส่งแจ้งเตือนผ่าน Slack/อีเมล/SMS — ไม่มีใครส่งผ่าน LINE OA เลย'
              : "These tools are good in their home market — but they're built for US owners who live in Slack. Starting price $299/mo (~฿10,000). Notifications via Slack, email, or SMS — none of them do LINE OA."}
          </p>

          <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--rh-ink-soft)' }}>
            {isThai
              ? 'เจ้าของร้านในกรุงเทพอยู่ใน LINE ไม่ใช่ Slack 80% ของคนไทยใช้ LINE 92% ใช้ทุกอาทิตย์ การส่งแจ้งเตือนที่ไม่ตรงช่องทางที่คุณใช้ เท่ากับเสียโอกาสตอบรีวิวเร็ว'
              : "Bangkok owners live in LINE, not Slack. 80% of Thailand uses LINE; 92% use it weekly. A notification on a channel you don't actually check = a missed reply window."}
          </p>

          <p className="text-base leading-relaxed" style={{ color: 'var(--rh-ink-soft)' }}>
            {isThai
              ? 'ReviewHub ทำในกรุงเทพ โดย founder คนเดียวที่อยู่ในกรุงเทพ ใช้ LINE ทุกวันเหมือนคุณ ราคาเป็นบาทเป็นหลัก ไม่ใช่ดอลลาร์'
              : "ReviewHub is built in Bangkok, by a solo founder who lives in Bangkok and uses LINE daily — same as you. Pricing in baht first, not dollars."}
          </p>
        </div>
      </section>

      {/* Roadmap honesty */}
      <section
        className="py-12 md:py-16"
        style={{ background: HOTEL_BG }}
      >
        <div className="rh-shell max-w-3xl mx-auto">
          <h2
            className="text-2xl md:text-3xl font-bold mb-6 text-center"
            style={{ letterSpacing: '-0.01em' }}
          >
            {isThai ? 'สถานะปัจจุบัน' : 'Where we are right now'}
          </h2>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span
                className="inline-block px-2 py-0.5 rounded text-xs font-mono font-bold flex-shrink-0 mt-0.5"
                style={{
                  background: 'var(--rh-sage)',
                  color: 'var(--rh-paper)',
                }}
              >
                {isThai ? 'พร้อม' : 'LIVE'}
              </span>
              <p className="text-sm md:text-base" style={{ color: 'var(--rh-ink-soft)' }}>
                {isThai
                  ? 'AI ร่างคำตอบรีวิว Google ใน 10 ภาษา · audit-preview ฟรีให้ลูกค้าใหม่ดู · LINE OA แจ้งเตือนรีวิวใหม่พร้อมร่างคำตอบ'
                  : 'AI-drafted Google review replies in 10 languages · free audit-preview links for prospects · LINE OA notifications with drafted reply for every new review'}
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span
                className="inline-block px-2 py-0.5 rounded text-xs font-mono font-bold flex-shrink-0 mt-0.5"
                style={{
                  background: 'var(--rh-amber, #d4a857)',
                  color: 'var(--rh-ink)',
                }}
              >
                {isThai ? 'ไตรมาส 3 2026' : 'Q3 2026'}
              </span>
              <p className="text-sm md:text-base" style={{ color: 'var(--rh-ink-soft)' }}>
                {isThai
                  ? 'อนุมัติคำตอบจาก LINE คลิกเดียว แล้วระบบโพสต์ลง Google ให้อัตโนมัติ (รอ Google อนุมัติ Business Profile API — case 8-9395000041442)'
                  : 'One-tap approve from LINE → auto-post to Google (waiting for Google Business Profile API approval — case 8-9395000041442)'}
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span
                className="inline-block px-2 py-0.5 rounded text-xs font-mono font-bold flex-shrink-0 mt-0.5"
                style={{
                  background: 'rgba(30, 77, 94, 0.15)',
                  color: 'var(--rh-teal)',
                }}
              >
                {isThai ? 'ตามมา' : 'NEXT'}
              </span>
              <p className="text-sm md:text-base" style={{ color: 'var(--rh-ink-soft)' }}>
                {isThai
                  ? 'Wongnai, TripAdvisor, Facebook auto-import + LINE noti สำหรับ platform เหล่านี้ด้วย'
                  : 'Wongnai, TripAdvisor, Facebook auto-import + LINE notifications for those platforms too'}
              </p>
            </div>
          </div>

          <div className="text-center mt-10">
            <Link
              to="/audit?from=line"
              className="inline-block px-6 py-3 rounded-lg text-sm md:text-base font-semibold"
              style={{
                background: 'var(--rh-teal)',
                color: 'var(--rh-paper)',
              }}
            >
              {isThai
                ? 'รับ audit ฟรี + ลงทะเบียนใช้ก่อน'
                : 'Claim a free audit + early LINE access'}
            </Link>
            <p className="text-xs mt-3" style={{ color: 'var(--rh-ink-soft)', opacity: 0.7 }}>
              {isThai
                ? 'LINE OA เปิดให้ใช้แล้ววันนี้ — ลงทะเบียนเชื่อมบัญชีได้ที่ Settings'
                : 'LINE OA notifications are live today — connect your account in Settings after signup.'}
            </p>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
