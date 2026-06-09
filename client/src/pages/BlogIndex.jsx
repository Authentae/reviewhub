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

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';
import NewsletterSignup from '../components/NewsletterSignup';
import usePageTitle from '../hooks/usePageTitle';
import useSocialMeta from '../hooks/useSocialMeta';
import { useI18n } from '../context/I18nContext';

// Hand-curated post list. Order = newest first. Add an entry here when
// publishing a new post in /public/blog/.
const POSTS = [
  {
    slug: 'how-many-google-reviews-do-you-need',
    title: 'How many Google reviews do you need? (an honest answer)',
    description: 'There is no magic number. The honest answer is relative — enough to be credible, more than your nearest competitor, and recent enough to look alive — plus a simple target to aim for and why the first reviews matter most.',
    date: '2026-06-08',
    readingMins: 5,
    lang: 'en',
  },
  {
    slug: 'best-time-to-ask-for-a-google-review',
    title: 'The best time to ask for a Google review (by business type)',
    description: 'Timing beats wording. The honest answer on when to ask for a Google review — same-day, within two hours — and the exact best moment for clinics, salons, restaurants, home services, and retail.',
    date: '2026-06-08',
    readingMins: 5,
    lang: 'en',
  },
  {
    slug: 'google-review-request-templates',
    title: 'Google review request templates that actually work (SMS + email, by business type)',
    description: 'Copy-paste Google review request templates for SMS and email by business type — clinics, salons, restaurants, home services, retail — plus the timing and the one rule that keeps them compliant.',
    date: '2026-06-08',
    readingMins: 7,
    lang: 'en',
  },
  {
    slug: 'how-to-make-a-google-review-qr-code',
    title: 'How to make a Google review QR code (free) and where to put it',
    description: 'Step by step: get your Google review link, turn it into a free QR code, place it where it gets scanned, lift the scan rate, and cover the one thing a QR code can\'t reach.',
    date: '2026-06-08',
    readingMins: 6,
    lang: 'en',
  },
  {
    slug: 'how-to-get-more-google-reviews',
    title: 'How to get more Google reviews (without buying, begging, or breaking the rules)',
    description: "Why happy customers don't leave reviews, exactly how and when to ask, the one-tap link that lifts response rates, what violates Google's policy, and how to make the whole thing automatic.",
    date: '2026-06-08',
    readingMins: 7,
    lang: 'en',
  },
  {
    slug: 'ai-google-review-replies',
    title: "AI Google review reply tools in 2026: what works, what doesn't, and how to pick",
    description: 'An honest, vendor-agnostic guide to AI tools that draft Google review replies. What they do well, where they fail, the 5 names worth knowing, and the decision framework for picking one (or skipping the category entirely).',
    date: '2026-05-20',
    readingMins: 12,
    lang: 'en',
  },
  {
    slug: 'how-fast-should-you-reply-to-google-reviews',
    title: 'How fast should you reply to Google reviews? (and what slow replies signal)',
    description: 'The honest answer on response speed for Google reviews — what fast looks like, why same-day matters more for 1-stars than 5-stars, and how to stop using slow as a default.',
    date: '2026-05-19',
    readingMins: 4,
    lang: 'en',
  },
  {
    slug: 'how-fast-should-you-reply-to-google-reviews-th',
    title: 'ตอบรีวิว Google เร็วแค่ไหนถึงจะดี? (และคำตอบช้าบอกอะไรลูกค้า)',
    description: 'คำตอบตรง ๆ เรื่องความเร็วในการตอบรีวิว Google — เร็วแค่ไหนถึงเรียกว่าเร็ว ทำไมรีวิว 1 ดาวต่างจาก 5 ดาว และวิธีไม่ทำให้ช้าเป็นเรื่องปกติ',
    date: '2026-05-19',
    readingMins: 4,
    lang: 'th',
  },
  {
    slug: 'chatgpt-for-google-review-replies',
    title: 'ChatGPT for Google review replies — what works, what breaks',
    description: 'An honest look at using ChatGPT to draft Google review replies. Where it works fine, where it falls apart, and what to do when you have more than a handful of reviews to reply to each week.',
    date: '2026-05-19',
    readingMins: 5,
    lang: 'en',
  },
  {
    slug: 'chatgpt-for-google-review-replies-th',
    title: 'ใช้ ChatGPT ตอบรีวิว Google — ใช้ได้แค่ไหน เริ่มพังตรงไหน',
    description: 'มองตรง ๆ ว่าใช้ ChatGPT ร่างคำตอบรีวิว Google ทำงานได้แค่ไหน ตรงไหนยังโอเค ตรงไหนเริ่มพัง และจะทำยังไงเมื่อมีรีวิวมากกว่าสองสามอันต่อสัปดาห์',
    date: '2026-05-19',
    readingMins: 5,
    lang: 'th',
  },
  {
    slug: 'words-to-avoid-in-review-replies',
    title: '5 words to never use in a Google review reply (and what to say instead)',
    description: 'Common words that make your reply sound defensive, dismissive, or insincere — even when you mean well — and the alternatives that read as a real person responding.',
    date: '2026-05-08',
    readingMins: 4,
    lang: 'en',
  },
  {
    slug: 'when-not-to-reply-to-a-google-review-th',
    title: 'เมื่อไหร่ที่ไม่ควรตอบรีวิว Google (5 กรณีที่เงียบเป็นคำตอบที่ถูก)',
    description: 'คำแนะนำส่วนใหญ่บอก "ตอบทุกอัน" — แต่มี 5 กรณีเฉพาะที่ความเงียบดีกว่าการตอบ การตอบในกรณีเหล่านี้ทำให้ profile ของคุณแย่ลง',
    date: '2026-05-08',
    readingMins: 5,
    lang: 'th',
  },
  {
    slug: 'when-not-to-reply-to-a-google-review',
    title: 'When NOT to reply to a Google review (5 cases where silence is the right answer)',
    description: 'Most owners reply to everything. Five specific cases where silence beats engagement: extortion, serial-account flooding, exposed PII, hot-emotional reviews, and active legal-action territory.',
    date: '2026-05-08',
    readingMins: 5,
    lang: 'en',
  },
  {
    slug: 'words-to-avoid-in-review-replies-th',
    title: '5 คำที่ห้ามใช้ในคำตอบรีวิว Google (และคำที่ใช้แทน)',
    description: 'คำธรรมดาที่ทำให้คำตอบของคุณดูแก้ตัว ปัด หรือไม่จริงใจ — และคำที่ใช้แทนเพื่อให้ดูเหมือนคนคุยกัน',
    date: '2026-05-08',
    readingMins: 4,
    lang: 'th',
  },
  {
    slug: 'track-google-review-reply-rate-th',
    title: 'วิธี track อัตราการตอบรีวิว Google (เมตริกที่สำคัญที่สุด)',
    description: 'ทำไม reply rate สำคัญกว่าจำนวนคำตอบ วิธีวัดโดยไม่ต้องใช้เครื่องมือ เป้าหมาย 80% และอัตราของคุณตอนนี้กำลังบอกอะไรเกี่ยวกับการดำเนินงาน',
    date: '2026-05-08',
    readingMins: 5,
    lang: 'th',
  },
  {
    slug: 'track-google-review-reply-rate',
    title: 'How to track your Google review reply rate (the one metric that actually matters)',
    description: 'Why reply rate beats reply quantity, how to measure it without a tool, the 80% target, and what your current rate is telling you about your operations.',
    date: '2026-05-08',
    readingMins: 5,
    lang: 'en',
  },
  {
    slug: 'reply-to-old-google-reviews-th',
    title: 'ควรตอบรีวิว Google เก่าๆ ไหม? (ย้อนหลังได้แค่ไหน)',
    description: 'คำตอบซื่อๆ ว่าควรตอบรีวิวอายุ 6 เดือน 1 ปี หรือ 3 ปีไหม กฎ 30 วันที่ดีกว่า "ตอบทุกอัน" และข้อยกเว้นเดียวที่ควรรู้',
    date: '2026-05-08',
    readingMins: 5,
    lang: 'th',
  },
  {
    slug: 'reply-to-old-google-reviews',
    title: 'Should you reply to old Google reviews? (and how far back to go)',
    description: 'The honest answer on whether to reply to Google reviews from 6 months, 1 year, or 3 years ago. Why the 30-day rule beats "reply to everything", with the one exception worth knowing.',
    date: '2026-05-08',
    readingMins: 5,
    lang: 'en',
  },
  {
    slug: 'what-one-star-reviews-tell-you-th',
    title: 'รีวิว 1 ดาวบน Google บอกอะไรคุณจริงๆ (3 pattern ที่เจ้าของส่วนใหญ่มองข้าม)',
    description: 'รีวิว 1 ดาวไม่ใช่แค่คำตำหนิ — เป็น operations audit ฟรีที่ลูกค้าจ่ายเงินให้คุณอ่าน 3 pattern ในรีวิว 1 ดาว 20 อันล่าสุดของคุณ พร้อมปัญหาทางการดำเนินงานที่แต่ละ pattern เผยออกมา',
    date: '2026-05-08',
    readingMins: 6,
    lang: 'th',
  },
  {
    slug: 'what-one-star-reviews-tell-you',
    title: 'What your 1-star Google reviews are actually telling you (3 patterns most owners miss)',
    description: '1-star reviews aren\'t just complaints — they\'re a free operations audit. Three specific patterns to watch for in your last 20 negative reviews, with the operational problem each one reveals.',
    date: '2026-05-08',
    readingMins: 6,
    lang: 'en',
  },
  {
    slug: 'wongnai-vs-google-reviews-bangkok-th',
    title: 'Wongnai vs รีวิว Google — ร้านอาหารในกรุงเทพฯ ควรโฟกัสที่ไหนก่อน?',
    description: 'คู่มือซื่อๆ สำหรับร้านอาหารในกรุงเทพฯ — เลือกใช้เวลา 30 นาทีต่อสัปดาห์กับรีวิว Wongnai หรือ Google ขึ้นกับว่าลูกค้าคุณคือใคร พร้อมตารางเปรียบเทียบและสูตรตัดสินใจ',
    date: '2026-05-08',
    readingMins: 6,
    lang: 'th',
  },
  {
    slug: 'wongnai-vs-google-reviews-bangkok',
    title: 'Wongnai vs Google reviews — which one should Bangkok restaurants prioritize?',
    description: 'Honest breakdown of where to spend your review-management time as a Bangkok restaurant: Wongnai vs Google. Audience differences, search visibility, owner-reply mechanics, and what a 100-cover restaurant should actually do.',
    date: '2026-05-08',
    readingMins: 6,
    lang: 'en',
  },
  {
    slug: 'google-review-reply-length-th',
    title: 'คำตอบรีวิว Google ควรยาวแค่ไหน? (ข้อมูลและสูตรง่ายๆ)',
    description: 'ความยาวที่เหมาะสมของคำตอบรีวิว Google แยกตามประเภทรีวิว ทำไมเจ้าของส่วนใหญ่เขียนยาวเกินสำหรับ 5 ดาว และสั้นเกินสำหรับ 1 ดาว พร้อมเทมเพลตแบ่งตามความยาว',
    date: '2026-05-08',
    readingMins: 5,
    lang: 'th',
  },
  {
    slug: 'google-review-reply-length',
    title: 'How long should a Google review reply be? (the data and the rule of thumb)',
    description: 'The optimal length for Google review replies, broken down by review type. Why most owners write too much for 5-stars and too little for 1-stars, with copy-paste templates by length.',
    date: '2026-05-08',
    readingMins: 5,
    lang: 'en',
  },
  {
    slug: 'bangkok-hospitality-review-mistakes-th',
    title: '5 ข้อผิดพลาดในการตอบรีวิว Google ที่เจ้าของโรงแรมและร้านอาหารในกรุงเทพฯ ทำซ้ำๆ',
    description: 'Pattern จากโรงแรม คาเฟ่ และร้านอาหารในกรุงเทพฯ จริง — เทมเพลตซ้ำซาก ตอบช้าให้ลูกค้าต่างชาติ ปัญหาภาษาไม่ตรง และร้านที่มี 200+ รีวิวต่างจากร้านอื่นยังไง',
    date: '2026-05-08',
    readingMins: 7,
    lang: 'th',
  },
  {
    slug: 'bangkok-hospitality-review-mistakes',
    title: '5 Google review mistakes Bangkok hospitality owners keep making',
    description: 'Patterns from real Bangkok hotels and restaurants — copy-paste replies, late responses to international guests, the language-mismatch trap, and what 200+ review properties do differently.',
    date: '2026-05-08',
    readingMins: 7,
    lang: 'en',
  },
  {
    slug: 'transfer-google-business-profile-ownership-th',
    title: 'วิธีโอนเจ้าของ Google Business Profile (ขั้นตอนจริง)',
    description: 'คู่มือเจ้าของร้าน: เพิ่ม manager ต่างกับโอนเจ้าของจริงยังไง รอ 7 วันคืออะไร และทางลัดที่ไม่ค่อยมีใครพูดถึง',
    date: '2026-05-07',
    readingMins: 8,
    lang: 'th',
  },
  {
    slug: 'how-to-ask-for-google-reviews-th',
    title: 'วิธีขอรีวิว Google จากลูกค้าโดยไม่ดูยัดเยียด (และไม่ใช้ส่วนลด)',
    description: 'คู่มือเจ้าของร้าน: 5 จังหวะธรรมชาติในการขอรีวิว ทำไมแลกส่วนลดกับรีวิวผิดนโยบาย Google ความผิดพลาดเรื่อง QR code และเทคนิคป้องกันรีวิว 1 ดาว',
    date: '2026-05-07',
    readingMins: 7,
    lang: 'th',
  },
  {
    slug: 'how-to-remove-google-review-th',
    title: 'วิธีลบรีวิว Google (และอะไรที่ Google ลบจริงๆ ได้บ้าง)',
    description: 'คู่มือซื่อๆ: Google ลบรีวิวอะไรได้ ลบไม่ได้ กระบวนการ flag กี่วัน เส้นทาง escalation ที่เจ้าของส่วนใหญ่ไม่รู้ว่ามี และต้องทำอะไรเมื่อรีวิวยังคงอยู่',
    date: '2026-05-07',
    readingMins: 9,
    lang: 'th',
  },
  {
    slug: 'fake-extortion-google-reviews-th',
    title: 'วิธีรับมือกับรีวิวปลอม / รีวิวแบล็กเมล / รีวิวจากคู่แข่งบน Google',
    description: 'คู่มือเจ้าของร้าน: รับมือกับรีวิว 1 ดาวที่เป็นเก๊ ที่เป็นการแบล็กเมล ("จ่ายไม่งั้นจะคงไว้") และรีวิวจากคู่แข่งบน Google ตอบยังไง flag เมื่อไร และไม่ควรทำอะไร',
    date: '2026-05-07',
    readingMins: 8,
    lang: 'th',
  },
  {
    slug: 'why-respond-to-google-reviews-th',
    title: 'ทำไมร้านของคุณถึงต้องตอบรีวิว Google (พร้อมเทมเพลตตอบรีวิว 1 ดาว)',
    description: 'ทำไมการตอบรีวิวจากเจ้าของร้านมีผลต่อยอดขายมากกว่ารีวิวเอง พร้อมเทมเพลตที่คัดลอกใช้ได้สำหรับรีวิว 1 ดาว 5 ดาว และ 3 ดาวที่อยู่ตรงกลาง',
    date: '2026-05-07',
    readingMins: 6,
    lang: 'th',
  },
  {
    slug: 'reply-english-reviews-thai-owners',
    title: 'Replying to English Google reviews professionally — a guide for Thai hotel and café owners',
    description: 'A guide for Thai owners on replying to tourist reviews in English without sounding stiff or machine-translated. Six principles + five copy-pasteable scenarios.',
    date: '2026-05-08',
    readingMins: 8,
    lang: 'en',
  },
  {
    slug: 'reply-english-reviews-thai-owners-th',
    title: 'ตอบรีวิว Google ภาษาอังกฤษให้ดูเป็นมืออาชีพ — คู่มือสำหรับเจ้าของโรงแรมและคาเฟ่ไทย',
    description: 'คู่มือเจ้าของร้านไทย: ตอบรีวิวภาษาอังกฤษจากนักท่องเที่ยวต่างชาติให้ดูเป็นมืออาชีพ ไม่แข็ง ไม่เหมือนแปลจากเครื่อง พร้อมเทมเพลต 5 สถานการณ์จริง',
    date: '2026-05-07',
    readingMins: 8,
    lang: 'th',
  },
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

  // Filter pill: 'all' | 'en' | 'th'. Default to user's UI language so a
  // Thai-mode visitor lands on Thai posts; an English-mode visitor on EN.
  // Persists the choice in localStorage so a visitor who explicitly
  // toggled to "all" gets "all" on their next visit, not the inferred
  // default.
  const [filter, setFilter] = useState(() => {
    try {
      const saved = localStorage.getItem('rh_blog_lang_filter');
      if (saved && ['all', 'en', 'th'].includes(saved)) return saved;
    } catch { /* SSR or storage blocked */ }
    return isThai ? 'th' : 'en';
  });
  const setFilterPersist = (next) => {
    setFilter(next);
    try { localStorage.setItem('rh_blog_lang_filter', next); } catch { /* ignore */ }
  };
  const visiblePosts = filter === 'all' ? POSTS : POSTS.filter((p) => p.lang === filter);

  // "NEW" badge on posts published in the last 7 days. Draws the eye
  // to fresh content (Reader sees what changed since their last visit
  // without parsing dates). Auto-expires — no manual badge maintenance.
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const isFresh = (dateStr) => {
    const t = Date.parse(dateStr);
    if (Number.isNaN(t)) return false;
    return (Date.now() - t) < SEVEN_DAYS_MS;
  };

  usePageTitle(isThai ? 'บล็อก — เคล็ดลับการตอบรีวิว Google' : 'Blog — Google review-reply playbooks & templates');
  useSocialMeta({
    title: isThai ? 'บล็อก ReviewHub' : 'ReviewHub Blog',
    description: 'Practical writing for small business owners on managing Google reviews, replying to feedback, and handling fake or extortion reviews.',
  });

  const pillLabel = (k) => {
    if (k === 'all') return isThai ? 'ทั้งหมด' : 'All';
    if (k === 'en') return 'English';
    return 'ภาษาไทย';
  };
  const pillCount = (k) => {
    if (k === 'all') return POSTS.length;
    return POSTS.filter((p) => p.lang === k).length;
  };

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
          <p className="text-sm mt-2" style={{ color: 'var(--rh-ink-3, #8b939c)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
            {POSTS.length} {isThai ? 'บทความ · ภาษาไทย' : 'posts · English'} {POSTS.filter(p => p.lang === 'en').length} · {isThai ? 'อังกฤษ' : 'Thai'} {POSTS.filter(p => p.lang === 'th').length}
          </p>
        </div>

        {/* Language filter pills — useful now that we have 14+ posts split EN/TH */}
        <div className="flex gap-2 mb-8" role="tablist" aria-label={isThai ? 'กรองตามภาษา' : 'Filter by language'}>
          {['all', 'en', 'th'].map((k) => {
            const active = filter === k;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilterPersist(k)}
                className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{
                  background: active ? '#1e4d5e' : 'transparent',
                  color: active ? '#fff' : 'var(--rh-ink-2, #4a525a)',
                  border: active ? '1px solid #1e4d5e' : '1px solid var(--rh-rule, #e8e3d6)',
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                  fontSize: '12px',
                  letterSpacing: '0.04em',
                }}
              >
                {pillLabel(k)} <span style={{ opacity: 0.85 }}>· {pillCount(k)}</span>
              </button>
            );
          })}
        </div>

        <ul className="space-y-8">
          {visiblePosts.map((p) => (
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
                  {isFresh(p.date) && (
                    <span
                      aria-label={isThai ? 'โพสต์ใหม่' : 'New post'}
                      style={{
                        display: 'inline-block',
                        verticalAlign: 'middle',
                        background: 'var(--rh-ochre-deep, #a07d20)',
                        color: '#fff',
                        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                        fontSize: '10px',
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        padding: '2px 7px',
                        borderRadius: '3px',
                        marginRight: '10px',
                        position: 'relative',
                        top: '-3px',
                      }}
                    >
                      {isThai ? 'ใหม่' : 'NEW'}
                    </span>
                  )}
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
            style={{ background: '#1e4d5e', color: '#fff', textDecoration: 'none' }}
          >
            {isThai ? 'ขอ audit ฟรี →' : 'Get a free audit →'}
          </Link>
          <p className="text-xs" style={{ color: 'var(--rh-ink-3, #8b939c)' }}>
            {isThai ? 'ติดตามโพสต์ใหม่ทาง ' : 'Subscribe to new posts via '}
            <a href="/feed.xml" style={{ color: 'var(--rh-teal-deep, #1e4d5e)', textDecoration: 'underline' }}>RSS</a>
            {' · '}
            <Link to="/" style={{ color: 'var(--rh-ink-3, #8b939c)' }}>← {isThai ? 'หน้าหลัก' : 'Home'}</Link>
          </p>
        </section>

        {/* Newsletter signup — built 2026-05-20 per overnight queue 8.
            Blog visitors are higher-intent than Landing visitors but were
            leaving without a subscription path. Inline variant slots
            cleanly above the footer. */}
        <section style={{ marginTop: 32, marginBottom: 8 }}>
          <NewsletterSignup source="blog-index" variant="inline" />
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
