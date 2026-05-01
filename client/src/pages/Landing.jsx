import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';
import MarketingNav from '../components/MarketingNav';
import Navbar from '../components/Navbar';
import Logo from '../components/Logo';
import { isLoggedIn } from '../lib/auth';

// Editorial-magazine landing page (v2 redesign per Claude Design bundle).
// Uses an inline <style> block because the design relies on OKLCH custom
// properties, custom fonts, and section-specific animations that don't map
// cleanly to Tailwind utilities. Tailwind config remains untouched.

// ── Inline atoms ───────────────────────────────────────────────────────────
function Star({ filled = true, size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.2} aria-hidden="true">
      <path d="M8 1.5l2 4.4 4.8.4-3.7 3.2 1.1 4.7L8 11.8 3.8 14.2l1.1-4.7L1.2 6.3l4.8-.4L8 1.5z" />
    </svg>
  );
}
function Stars({ n = 5 }) {
  return <span className="rh-stars">{Array.from({ length: 5 }).map((_, i) => <Star key={i} filled={i < n} />)}</span>;
}
function Check() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5l3.5 3.5L13 4" /></svg>;
}
function Arrow() {
  return <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" aria-hidden="true"><path d="M3 7h8M8 4l3 3-3 3" /></svg>;
}

// Rolling-digit ticker for the hero "live" counter.
function Ticker({ value }) {
  const digits = String(value).split('');
  return (
    <span className="rh-ticker">
      {digits.map((d, i) => {
        if (!/\d/.test(d)) return <span key={i}>{d}</span>;
        const n = parseInt(d, 10);
        return (
          <span key={i} className="roll">
            <span style={{ transform: `translateY(-${n}em)` }}>
              {'0123456789'.split('').map((x) => <span key={x} style={{ display: 'block' }}>{x}</span>)}
            </span>
          </span>
        );
      })}
    </span>
  );
}

// Spawn N ochre stars from (x,y), flying outward.
function spawnBurst(x, y, count = 8) {
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'rh-burst-star';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
    const dist = 60 + Math.random() * 50;
    el.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    el.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    el.style.setProperty('--rot', Math.floor(Math.random() * 720 - 360) + 'deg');
    el.innerHTML = '<svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.5l2 4.4 4.8.4-3.7 3.2 1.1 4.7L8 11.8 3.8 14.2l1.1-4.7L1.2 6.3l4.8-.4L8 1.5z"/></svg>';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
}

// ── Hero with cursor-trail stars + live ticker + floating cards ───────────
function Hero() {
  const { t } = useI18n();
  const [replyCount, setReplyCount] = useState(2847);
  const lastSpawn = useRef(0);

  useEffect(() => {
    const iv = setInterval(() => {
      setReplyCount((c) => c + 1 + Math.floor(Math.random() * 2));
    }, 2400 + Math.random() * 1600);
    return () => clearInterval(iv);
  }, []);

  const onMove = (e) => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const now = performance.now();
    if (now - lastSpawn.current < 80) return;
    lastSpawn.current = now;
    const el = document.createElement('div');
    el.className = 'rh-trail-star';
    el.style.left = e.clientX + 'px';
    el.style.top = e.clientY + 'px';
    el.style.setProperty('--dx', (Math.random() - 0.5) * 40 + 'px');
    el.style.setProperty('--rot', Math.floor(Math.random() * 360 - 180) + 'deg');
    el.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.5l2 4.4 4.8.4-3.7 3.2 1.1 4.7L8 11.8 3.8 14.2l1.1-4.7L1.2 6.3l4.8-.4L8 1.5z"/></svg>';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  };

  return (
    <section className="rh-hero" onMouseMove={onMove} aria-label="Hero introduction">
      <div className="rh-hero-bg" />
      <div className="rh-hero-grid" />
      <div className="rh-hero-vignette" />
      {/* Editorial flourish — large ★ glyph anchors the hero to the
          star-rating motif used throughout the app. */}
      <div className="rh-hero-amp" aria-hidden="true">★</div>
      <div className="rh-shell rh-hero-inner">
        <div className="rh-hero-meta">
          <div className="rh-eyebrow">
            <span className="dot" />
            <span className="rh-mono">{t('landing.heroBadge')}</span>
          </div>
          <div className="rh-meta-right">
            {/* Removed the fake "MP PS JR +" customer-avatar row. Until we
                have real customers willing to be named, that placeholder
                read as fake-social-proof to several testers. The
                heroMadeBy line below is more honest: a solo founder
                signal, which is itself a trust factor in the SMB
                market we're targeting. */}
            <div className="ct">{t('landing.heroBuiltFor', 'Built for independent shops')}</div>
            <div className="ct rh-mono" style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
              {t('landing.heroMadeBy', 'Made in Bangkok by a solo founder')}
            </div>
          </div>
        </div>
        <h1 className="rh-display">
          {(() => {
            // Restore the orange visual highlight on the time portion (e.g.
            // "10 seconds" / "10 วินาที"). The translated string always
            // contains "10" followed by a time-unit word — split on "10" and
            // wrap the trailing chunk in <span class="time"> so the editorial
            // highlight survives across locales.
            const title = t('landing.heroTitle');
            const idx = title.indexOf('10');
            if (idx === -1) return title;
            const before = title.slice(0, idx);
            const after = title.slice(idx);
            return (<>{before}<span className="time">{after}</span></>);
          })()}
        </h1>
        <div className="rh-hero-bottom">
          <div>
            <p className="rh-lede">
              {t('landing.heroSubtitle')}
            </p>
            <div className="rh-hero-cta">
              <Link to="/register" className="rh-btn rh-btn-amber rh-btn-lg">{t('landing.heroCta')} <Arrow /></Link>
              <a href="#demo" className="rh-btn rh-btn-ghost rh-btn-lg">{t('landing.ctaSecondary', 'See a live draft')}</a>
              <Link to="/tools/review-reply-generator" className="rh-hero-tool-link">
                {t('landing.heroTryFreeTool', 'Or try the free tool first — no signup')} <Arrow />
              </Link>
            </div>
            <div className="rh-hero-proof">
              <div className="metric"><div className="n">10<small> {t('landing.heroMetricLangsUnit', 'langs')}</small></div><div className="l">{t('landing.heroMetricLangs', 'Including Thai natively')}</div></div>
              <div className="metric"><div className="n">60+</div><div className="l">{t('landing.heroMetricPlatform', 'Platforms tracked')}</div></div>
              <div className="metric"><div className="n">10<small>s</small></div><div className="l">{t('landing.heroMetricSpeed', 'From review to drafted reply')}</div></div>
            </div>
          </div>
          <CardStack />
        </div>
      </div>
    </section>
  );
}

function CardStack() {
  const { lang } = useI18n();
  // Card B is always Thai — it demonstrates the AI's Thai-native capability
  // regardless of locale. Cards A and C swap to Thai when lang=th so a Thai
  // visitor sees a coherent Thai-first hero rather than 2 English snippets
  // they have to mentally translate.
  const isThai = lang === 'th';
  const cardA = isThai
    ? { name: 'มาร์โก พี.', body: '"บาริสต้าจำเมนูได้หลังมาแค่ครั้งเดียว แต่วันนี้ pour-over ไม่ได้เปิดให้สั่ง"', draftLabel: 'ร่าง AI · ในสไตล์คุณ', draft: 'ขอบคุณคุณมาร์โกที่แวะมา — pour-over กลับมาวันพฤหัส เจอกันค่ะ' }
    : { name: 'Marco P.', body: '"Barista remembered my order after one visit. Pour-over was down though."', draftLabel: 'AI draft · your voice', draft: "Appreciate you stopping by, Marco — pour-over's back Thursday. See you then." };
  const cardC = isThai
    ? { name: 'เจมี่ อาร์.', body: '"ครัวซองต์อร่อยดี แต่วันเสาร์บริการช้านิดหน่อย ก็ยังจะกลับมาอยู่ดี"', draftLabel: 'ร่าง AI · อบอุ่น', draft: 'ขอบคุณคุณเจมี่ — เพิ่มเตาอบที่ 2 สำหรับวันหยุดแล้ว แวะมาใหม่นะคะ' }
    : { name: 'Jamie R.', body: '"Solid croissants, a bit slow on a Saturday. Would still come back."', draftLabel: 'AI draft · warm', draft: "Thanks Jamie — we've added a second oven for weekends. Try us again." };
  return (
    <div className="rh-card-stack">
      <div className="rh-float-card a">
        <div className="stamp">★★★★★ · Sent</div>
        <div className="sent">SENT · 8s</div>
        <div className="fc-head">
          <div className="fc-who">
            <div className="fc-avatar" style={{ background: 'var(--rh-rose)' }}>MP</div>
            <div className="fc-name">{cardA.name}</div>
            <Stars n={5} />
          </div>
          <div className="fc-plat">Google</div>
        </div>
        <div className="fc-body">{cardA.body}</div>
        <div className="fc-draft">
          <div className="fc-draft-label">{cardA.draftLabel}</div>
          {cardA.draft}
        </div>
      </div>
      <div className="rh-float-card b">
        <div className="stamp">★★★★★ · Replied</div>
        <div className="fc-head">
          <div className="fc-who">
            <div className="fc-avatar" style={{ background: 'var(--rh-sage)' }}>PS</div>
            <div className="fc-name">Ploy S.</div>
            <Stars n={5} />
          </div>
          <div className="fc-plat">Google</div>
        </div>
        <div className="fc-body">"ร้านน่ารักมาก บรรยากาศดี กาแฟอร่อย จะกลับมาอีกแน่นอน"</div>
        <div className="fc-draft">
          <div className="fc-draft-label">AI draft · Thai</div>
          ขอบคุณมากค่ะคุณพลอย รอพบคุณอีกครั้งค่ะ ☕
        </div>
      </div>
      <div className="rh-float-card c">
        <div className="stamp stamp-ochre">★★★★ · Drafted</div>
        <div className="sent draft">DRAFTING</div>
        <div className="fc-head">
          <div className="fc-who">
            <div className="fc-avatar" style={{ background: 'var(--rh-teal-deep)' }}>JR</div>
            <div className="fc-name">{cardC.name}</div>
            <Stars n={4} />
          </div>
          <div className="fc-plat">Google</div>
        </div>
        <div className="fc-body">{cardC.body}</div>
        <div className="fc-draft">
          <div className="fc-draft-label">{cardC.draftLabel}</div>
          {cardC.draft}
        </div>
      </div>
    </div>
  );
}

// ── Marquee — platforms we connect to ──────────────────────────────────────
// Honest framing: Google syncs automatically via OAuth ("Auto-sync"); every
// other platform is tracked via CSV import or manual entry ("Manual / CSV"),
// which is a real, working capability — not a "coming soon" promise. The
// platform registry covers 60+ platforms across 10 locales.
function Marquee() {
  const { t } = useI18n();
  const liveLabel = t('marquee.liveToday', 'Auto-sync');
  const manualLabel = t('marquee.manualImport', 'Manual / CSV');
  const platforms = [
    { name: 'Google',       color: 'oklch(0.72 0.16 240)', live: true },
    { name: 'Yelp',         color: 'oklch(0.65 0.22 25)',  live: false },
    { name: 'Facebook',     color: 'oklch(0.62 0.15 255)', live: false },
    { name: 'TripAdvisor',  color: 'oklch(0.68 0.16 155)', live: false },
    { name: 'Trustpilot',   color: 'oklch(0.68 0.16 155)', live: false },
    { name: 'Wongnai',      color: 'oklch(0.72 0.18 35)',  live: false },
    { name: 'Tabelog',      color: 'oklch(0.65 0.20 30)',  live: false },
    { name: 'Naver Place',  color: 'oklch(0.68 0.18 145)', live: false },
    { name: 'Dianping',     color: 'oklch(0.65 0.22 25)',  live: false },
    { name: 'TheFork',      color: 'oklch(0.65 0.22 25)',  live: false },
    { name: 'HolidayCheck', color: 'oklch(0.72 0.16 240)', live: false },
    { name: 'Reclame Aqui', color: 'oklch(0.65 0.20 30)',  live: false },
  ];
  const Row = () => (
    <span>
      {platforms.map((p, i) => (
        <React.Fragment key={i}>
          <span className="chunk" style={{ '--platcolor': p.color }}>
            <span className="star">{p.live ? '★' : '○'}</span>
            <span className="plat">{p.name}</span>
            <span className="count" style={{ opacity: p.live ? 1 : 0.7 }}>{p.live ? liveLabel : manualLabel}</span>
          </span>
          {i < platforms.length - 1 && <span className="sep">—</span>}
        </React.Fragment>
      ))}
      <span className="sep">—</span>
    </span>
  );
  return (
    <section className="rh-marquee" aria-label="Platforms we connect to">
      <div className="rh-marquee-row"><Row /><Row /><Row /></div>
    </section>
  );
}

// ── How it works — 3 big bordered rows with serif Roman numerals ──────────
function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    { n: 'I', cat: t('landing.step1Cat', 'Connect'), h: t('landing.step1H', 'Paste a link, we pull the reviews.'),
      p: t('landing.step1P', "Google OAuth takes 20 seconds. Other platforms accept a public URL or a CSV while their APIs warm up. You're online inside a minute."),
      illo: (
        <div style={{ width: '100%', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, padding: '10px 12px', background: 'var(--rh-paper)', border: '1px solid var(--rh-rule)', borderRadius: 8, fontFamily: 'var(--rh-mono)', fontSize: 11, color: 'var(--rh-ink-3)' }}>https://g.page/cafe-morning</div>
          <div style={{ padding: '10px 14px', background: 'var(--rh-teal)', color: 'var(--rh-paper)', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>Connect</div>
        </div>
      ),
    },
    { n: 'II', cat: t('landing.step2Cat', 'Draft'), h: t('landing.step2H', 'AI writes in your voice — not "delight."'),
      p: t('landing.step2P', 'Trained on your last 20 replies. Drafts sound like you, in any of 10 languages — Thai, Japanese, and Korean done natively, not via translate.'),
      illo: (
        <div style={{ width: '100%', fontFamily: 'var(--rh-sans)', fontSize: 15, color: 'var(--rh-ink)', lineHeight: 1.5, fontWeight: 500 }}>
          <div style={{ fontFamily: 'var(--rh-mono)', fontSize: 10, color: 'var(--rh-ochre-deep)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontWeight: 600 }}>✦ Draft</div>
          "Appreciate you stopping by, Marco — pour-over's back Thursday."
        </div>
      ),
    },
    { n: 'III', cat: t('landing.step3Cat', 'Post'), h: t('landing.step3H', "One tap. It's published."),
      p: t('landing.step3P', "The extension posts on whatever platform page you're on — no copy-paste, no tab juggling, no logins to remember. Median reply time: 12 seconds."),
      illo: (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--rh-mono)', fontSize: 10, color: 'var(--rh-ink-3)', letterSpacing: '0.08em', marginBottom: 8 }}>MEDIAN</div>
          <div style={{ fontFamily: 'var(--rh-serif)', fontSize: 68, lineHeight: 1, color: 'var(--rh-sage)', fontStyle: 'italic', letterSpacing: '-0.03em' }}>12<span style={{ fontSize: 24, color: 'var(--rh-ink-3)', fontStyle: 'normal' }}>s</span></div>
          <div style={{ fontFamily: 'var(--rh-mono)', fontSize: 10, color: 'var(--rh-sage)', letterSpacing: '0.08em', marginTop: 6 }}>↓ 94% FASTER</div>
        </div>
      ),
    },
  ];
  return (
    <section className="rh-section rh-how" id="how" aria-label="How it works">
      <div className="rh-shell">
        <div className="rh-section-head">
          <div className="kicker"><div className="num">01</div><div className="cat">§ {t('landing.howEyebrow')}</div></div>
          <h2 className="rh-reveal">{t('landing.howTitle')}</h2>
        </div>
        <div className="rh-bigsteps">
          {steps.map((s, i) => (
            <div className="rh-bigstep rh-reveal" key={i}>
              <div className="bs-num">{s.n}</div>
              <div>
                <div className="rh-mono" style={{ marginBottom: 12 }}>{s.cat}</div>
                <h3>{s.h}</h3>
                <p>{s.p}</p>
              </div>
              <div className="illo">{s.illo}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── AI Demo — wired to the public reply-generator endpoint ────────────────
// All three sample reviews labeled Google — that's the only platform we
// actually pull from at launch. The free generator under
// /tools/review-reply-generator does work for any platform's review
// text (it just rewords whatever you paste), but the Landing demo
// shouldn't imply current Yelp/TripAdvisor pull-in support.
const SAMPLE_REVIEWS_EN = {
  glowing: { name: 'Priya M.', plat: 'google', platLabel: 'Google', stars: 5, body: 'Came here on my anniversary. Staff noticed, brought out a little candle on the tiramisu. Small thing — made the night. Thank you.' },
  mixed:   { name: 'Dan T.',   plat: 'google', platLabel: 'Google', stars: 3, body: 'Pasta was excellent. Service took forever though — 40 minutes for the mains on a Tuesday. Wanted to love it more than I did.' },
  harsh:   { name: 'Anon.',    plat: 'google', platLabel: 'Google', stars: 1, body: 'Rude manager. Overpriced. Never coming back. Zero stars if I could.' },
};
const SAMPLE_REVIEWS_TH = {
  glowing: { name: 'พลอย ส.', plat: 'google', platLabel: 'Google', stars: 5, body: 'มาฉลองครบรอบแต่งงานที่นี่ค่ะ พนักงานสังเกตเห็นแล้วยกทีรามิสุพร้อมเทียนเล็กๆ มาเซอร์ไพรส์ให้ ดูเป็นเรื่องเล็กแต่ทำให้คืนนั้นพิเศษมาก ขอบคุณนะคะ' },
  mixed:   { name: 'สมชาย ก.', plat: 'google', platLabel: 'Google', stars: 3, body: 'พาสต้าอร่อยมากครับ แต่บริการช้าไปหน่อย รออาหารหลัก 40 นาทีตอนเที่ยงวันอังคาร ถ้าเร็วกว่านี้คงให้ 5 ดาวเลย' },
  harsh:   { name: 'ลูกค้า', plat: 'google', platLabel: 'Google', stars: 1, body: 'ผู้จัดการพูดจาไม่ดี ราคาแพงเกินคุณภาพ ไม่กลับมาอีกแน่นอน ให้ 0 ดาวได้ก็จะให้' },
};
const TONE_PRESETS = [
  { id: 'warm', label: 'Warm' },
  { id: 'brisk', label: 'Brisk' },
  { id: 'formal', label: 'Formal' },
];

// Curated fallback drafts — used if the public endpoint is unreachable in dev,
// rate-limited, or otherwise erroring. Keyed by review × tone so the demo
// always shows something on-message instead of a generic error string.
// Thai versions match the Thai sample reviews above.
const DEMO_FALLBACKS_EN = {
  glowing: {
    warm:   "Priya — that candle was the team's idea, and they were rooting for you both. Thanks for celebrating with us. Come back for the second anniversary, candle's on the house.",
    brisk:  "Priya — glad the team caught it. Thanks for the kind words. See you again soon.",
    formal: "Thank you, Priya. We're delighted the staff could mark the occasion. We look forward to welcoming you back.",
  },
  mixed: {
    warm:   "Dan — you're right, 40 minutes on a Tuesday isn't us. We're already adjusting the line for that shift. Loved that the pasta landed; come back soon and the timing should match it.",
    brisk:  "Dan — fair point on the wait. We've reworked the Tuesday line. Come back; the pasta will arrive faster.",
    formal: "Thank you, Dan. The wait time you describe is below our standard, and we are addressing it. We hope the pasta tempts you back.",
  },
  harsh: {
    warm:   "We're sorry — that's not the experience we want anyone leaving with. I'd like to understand what happened directly. Could you email me at owner@cornerbistro.example? — The owner.",
    brisk:  "That's not how we operate. Email owner@cornerbistro.example so we can make it right. — The owner.",
    formal: "We sincerely apologize for the experience you describe. We would like to address this personally — please contact owner@cornerbistro.example at your convenience.",
  },
};
const DEMO_FALLBACKS_TH = {
  glowing: {
    warm:   "ขอบคุณคุณพลอยมากนะคะ ทีมเราดีใจที่ได้เป็นส่วนหนึ่งของวันสำคัญ เทียนเป็นไอเดียของน้องในร้านเอง ครบรอบปีหน้ามาฉลองอีกได้นะคะ ครั้งหน้าทีรามิสุพิเศษเลี้ยงเองค่ะ",
    brisk:  "ขอบคุณคุณพลอยค่ะ ดีใจที่ทีมสังเกตเห็น แล้วเจอกันใหม่นะคะ",
    formal: "ขอบคุณคุณพลอยที่เลือกฉลองโอกาสสำคัญที่ร้านของเรา ทางร้านยินดีอย่างยิ่งที่ทีมงานได้ร่วมเป็นส่วนหนึ่งของค่ำคืนนั้น และหวังว่าจะได้ต้อนรับคุณอีกครั้งในเร็วๆ นี้",
  },
  mixed: {
    warm:   "ขอบคุณคุณสมชายที่บอกตรงๆ นะคะ 40 นาทีไม่ใช่มาตรฐานของเรา ตอนนี้กำลังปรับวิธีจัดคิวครัวช่วงเที่ยงวันอังคารใหม่ ดีใจที่พาสต้ายังถูกใจ ถ้าแวะมาใหม่ครั้งนี้รับรองว่าออกเร็วขึ้นแน่นอนค่ะ",
    brisk:  "ขอบคุณคุณสมชายค่ะ เรื่องเวลารอเรารับมาแก้ไขแล้ว ครั้งหน้าแวะมาใหม่ พาสต้าจะออกเร็วกว่าเดิมแน่นอน",
    formal: "ขอบคุณคุณสมชายสำหรับความเห็นที่เป็นประโยชน์ เวลารอ 40 นาทีไม่ใช่มาตรฐานของทางร้าน เรากำลังดำเนินการปรับปรุงระบบครัวในช่วงเวลาดังกล่าว และหวังว่าจะได้ต้อนรับคุณอีกครั้ง",
  },
  harsh: {
    warm:   "ขออภัยจริงๆ นะคะ ไม่ใช่ประสบการณ์ที่เราอยากให้ลูกค้าได้รับ อยากฟังเรื่องที่เกิดขึ้นจากปากคุณโดยตรง รบกวนอีเมลถึง owner@cornerbistro.example หน่อยได้ไหมคะ จะแก้ไขให้ดีที่สุด — เจ้าของร้าน",
    brisk:  "ขออภัยค่ะ ไม่ใช่มาตรฐานของเรา รบกวนอีเมลที่ owner@cornerbistro.example เราจะรีบจัดการให้ — เจ้าของร้าน",
    formal: "ทางร้านขออภัยอย่างจริงใจสำหรับประสบการณ์ที่คุณได้รับ เราอยากแก้ไขเรื่องนี้เป็นการส่วนตัว รบกวนติดต่อ owner@cornerbistro.example ตามสะดวกของท่าน",
  },
};

function AiDemo() {
  const { t, lang } = useI18n();
  const SAMPLE_REVIEWS = lang === 'th' ? SAMPLE_REVIEWS_TH : SAMPLE_REVIEWS_EN;
  const DEMO_FALLBACKS = lang === 'th' ? DEMO_FALLBACKS_TH : DEMO_FALLBACKS_EN;
  const [which, setWhich] = useState('mixed');
  const [tone, setTone] = useState('warm');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const review = SAMPLE_REVIEWS[which];

  function typeOut(text) {
    let i = 0;
    const iv = setInterval(() => {
      i += 2;
      setOutput(text.slice(0, i));
      if (i >= text.length) { clearInterval(iv); setLoading(false); }
    }, 16);
  }

  async function generate() {
    setLoading(true);
    setOutput('');
    try {
      const { data } = await api.post('/public/review-reply-generator', {
        reviewer_name: review.name,
        rating: review.stars,
        platform: review.plat,
        business_name: lang === 'th' ? 'ร้านกาแฟริมทาง' : 'Corner Bistro',
        review_text: review.body,
        tone,
        // Send the UI language so the AI replies in Thai when the user is
        // browsing the Thai landing page, even if the demo's English sample
        // review would otherwise win the auto-detect.
        lang,
      });
      const text = (data && data.draft) || DEMO_FALLBACKS[which]?.[tone] || '';
      typeOut(text);
    } catch (err) {
      // Backend unreachable / rate-limited / erroring — fall back to a curated
      // sample so visitors never hit a dead end. Production with the API key
      // configured will use the real /draft endpoint.
      const fallback = DEMO_FALLBACKS[which]?.[tone] || "Thanks for the feedback — we appreciate it.";
      typeOut(fallback);
    }
  }

  return (
    <section className="rh-section rh-demo-section" id="demo" aria-label="AI drafts demo">
      <div className="rh-shell">
        <div className="rh-section-head">
          <div className="kicker"><div className="num">02</div><div className="cat">§ {t('landing.demoEyebrow', 'Live demo')}</div></div>
          <h2 className="rh-reveal">{t('landing.demoTitle', "Draft one right now. It's really running.")}</h2>
        </div>
        <div className="rh-demo rh-reveal">
          <div className="demo-side">
            <div className="demo-head">
              <div className="ttl"><span className="dot"></span>{t('landing.demoReviewLabel', 'The review')}</div>
              <div className="chips">
                {Object.entries(SAMPLE_REVIEWS).map(([k, v]) => (
                  <button key={k} className={'chip' + (which === k ? ' active' : '')} onClick={() => { setWhich(k); setOutput(''); }}>{v.stars}★ {t(`landing.demoChip.${k}`, k)}</button>
                ))}
              </div>
            </div>
            <div className="demo-review-head">
              <div style={{ fontWeight: 600, fontSize: 14 }}>{review.name}</div>
              <Stars n={review.stars} />
              <div className="rh-mono" style={{ fontSize: 10 }}>{review.platLabel}</div>
            </div>
            <div className="body">"{review.body}"</div>
            <div className="demo-foot">
              <div className="chips">
                <span className="rh-mono" style={{ color: 'color-mix(in oklab, var(--rh-paper) 55%, transparent)', padding: '4px 0' }}>{t('landing.demoTone', 'Tone')}</span>
                {TONE_PRESETS.map((p) => (
                  <button key={p.id} className={'chip' + (tone === p.id ? ' active' : '')} onClick={() => setTone(p.id)}>{t(`landing.tone${p.label}`, p.label)}</button>
                ))}
              </div>
              <button className="rh-btn rh-btn-primary" onClick={generate} disabled={loading}>{loading ? t('landing.demoDrafting', 'Drafting…') : t('landing.demoDraftReply', 'Draft reply')} <Arrow /></button>
            </div>
          </div>
          <div className="demo-side out">
            <div className="demo-head">
              <div className="ttl"><span className="dot on"></span>{t('landing.demoAiDraftLabel', 'AI draft · in your voice')}</div>
              <div className="rh-mono" style={{ color: 'var(--rh-ochre)' }}>✦ Claude Haiku</div>
            </div>
            <div className={'out-text body' + (loading ? ' typing' : '')}>
              {output || <span style={{ color: 'color-mix(in oklab, var(--rh-paper) 78%, transparent)' }}>{t('landing.demoEmptyHint', 'Hit Draft reply to see a real response from our drafting model. Change the tone or pick a different review — each run is live.')}</span>}
            </div>
            <div className="demo-foot">
              <div className="rh-mono" style={{ color: 'color-mix(in oklab, var(--rh-paper) 55%, transparent)' }}>
                {output ? `${output.split(/\s+/).filter(Boolean).length} ${t('landing.demoWordsLabel', 'words')} · ${Math.ceil(output.length / 5)} ${t('landing.demoTokensLabel', 'tokens')}` : '—'}
              </div>
              <Link to="/register" className="rh-btn rh-btn-ghost">{t('landing.demoUnlimited', 'Get unlimited drafts')} →</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Pull quote — warm rose+amber gradient panel ───────────────────────────
function PullQuote() {
  const { t } = useI18n();
  return (
    <section className="rh-pullquote" aria-label="Customer testimonial">
      <div className="rh-shell">
        <div className="q rh-reveal">
          {t('landing.pullQuote', "Every review, drafted in your voice — before the coffee cools.")}
        </div>
        <div className="attrib rh-reveal">
          {/* Portrait glyph swapped from ¶ (paragraph mark — confusing
              decoration) to ★ (the same star used in star ratings, in
              the redesigned hero, and in the in-app rating UI) so the
              attribution chip ties back to the product visually. */}
          <div className="portrait" aria-hidden="true">★</div>
          <div className="who">
            <b>{t('landing.pullQuoteAttribTitle', 'The ReviewHub promise.')}</b>
            <span>{t('landing.pullQuoteAttribDesc', 'Every review platform you live on, drafted in the voice your customers already know — ready to send in seconds.')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Bento feature grid ────────────────────────────────────────────────────
function FeatureGrid() {
  const { t, lang } = useI18n();
  const isThai = lang === 'th';
  const dashNames = isThai
    ? ['มาร์โก พี. · Google', 'พลอย ส. · Google', 'เจมี่ อาร์. · Google']
    : ['Marco P. · Google', 'Ploy S. · Google', 'Jamie R. · Google'];
  const days = [38, 42, 55, 49, 61, 58, 72, 65, 78, 82, 79, 91];
  return (
    <section className="rh-section rh-features" id="features" aria-label="Product features">
      <div className="rh-shell">
        <div className="rh-section-head">
          <div className="kicker"><div className="num">03</div><div className="cat">§ {t('landing.featuresEyebrow')}</div></div>
          <h2 className="rh-reveal">{t('landing.featuresTitle')}</h2>
        </div>
        <div className="rh-bento">
          <div className="cell a rh-reveal">
            <div className="tag">{t('landing.bento.trendsTag', 'Trends')}</div>
            <h3>{t('landing.bento.trendsTitle', 'Ratings that move, over time.')}</h3>
            <p>{t('landing.bento.trendsDesc', "Sparklines per platform, weekly digest in your inbox, alerts when sentiment drops two notches in a week — so you're addressing a dip, not discovering it.")}</p>
            <div className="viz">
              <div className="spark">
                {days.map((d, i) => <span key={i} className={i > 8 ? 'hi' : ''} style={{ height: `${d}%` }} />)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontFamily: 'var(--rh-mono)', fontSize: 10, color: 'var(--rh-ink-3)', letterSpacing: '0.06em' }}>
                <span>JAN</span><span>APR</span><span>JUL</span><span>OCT</span><span>DEC</span>
              </div>
            </div>
          </div>
          <div className="cell b rh-reveal">
            <div className="tag">{t('landing.bento.sentimentTag', 'Sentiment')}</div>
            <h3>{t('landing.bento.sentimentTitle', "Know what's actually said.")}</h3>
            <div className="viz senti">
              <div className="senti-row"><span className="lbl">Positive</span><div className="bar pos"><span /></div><span className="pct">72%</span></div>
              <div className="senti-row"><span className="lbl">Neutral</span><div className="bar neu"><span /></div><span className="pct">19%</span></div>
              <div className="senti-row"><span className="lbl">Negative</span><div className="bar neg"><span /></div><span className="pct">9%</span></div>
            </div>
          </div>
          <div className="cell c rh-reveal">
            <div className="tag">{t('landing.bento.i18nTag', 'i18n · 10 langs')}</div>
            <h3>{t('landing.bento.i18nTitle', 'Thai, Japanese, native.')}</h3>
            <div className="viz langs">
              {['EN', 'ES', 'FR', 'DE', 'PT', 'IT', 'TH', 'JA', 'ZH', 'KO'].map((l) => (
                <span key={l} className={'lang' + (['TH', 'JA', 'KO'].includes(l) ? ' on' : '')}>{l}</span>
              ))}
            </div>
          </div>
          <div className="cell d rh-reveal">
            <div className="tag">{t('landing.bento.inboxTag', 'Inbox')}</div>
            <h3>{t('landing.bento.inboxTitle', 'One feed. Every Google review.')}</h3>
            <div className="viz mini-dash">
              <div className="mdh"><span>{t('landing.bento.todayLabel', 'TODAY')}</span><span>14 {t('landing.bento.newLabel', 'NEW')}</span></div>
              <div className="mdrow"><span className="dot g" /><span className="name">{dashNames[0]}</span><span className="st">★★★★★</span></div>
              <div className="mdrow"><span className="dot g" /><span className="name">{dashNames[1]}</span><span className="st">★★★★★</span></div>
              <div className="mdrow"><span className="dot g" /><span className="name">{dashNames[2]}</span><span className="st">★★★★</span></div>
            </div>
          </div>
          <div className="cell e rh-reveal">
            <div className="tag">{t('landing.bento.rolesTag', 'Roles · Audit')}</div>
            <h3>{t('landing.bento.rolesTitle', 'Team-safe by default.')}</h3>
            <p>{t('landing.bento.rolesDesc', 'Owner, manager, responder. Every reply attributable, every change logged.')}</p>
          </div>
          <div className="cell f rh-reveal">
            <div className="tag">{t('landing.bento.requestsTag', 'Review requests')}</div>
            <h3>{t('landing.bento.requestsTitle', 'Ask at the right moment.')}</h3>
            <p>{t('landing.bento.requestsDesc', 'QR at the table, SMS after pickup, follow-up at day four. Measured per channel.')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Pricing — cream panel, dark featured plan ─────────────────────────────
//
// Source of truth for prices + features lives in
// server/src/lib/billing/plans.js. The landing surface intentionally collapses
// the 4-tier catalogue down to 3 cards (Free / Pro popular / Business) so the
// editorial 3-column grid stays balanced. The Starter tier ($14) is surfaced
// as a one-liner callout beneath the grid + linked through to /pricing where
// all four are shown side-by-side. Keeping prices and feature deltas in sync
// with plans.js manually is fragile — when these diverge again, prefer to
// import the plan data and render from it instead of hard-coding here.
function Pricing() {
  const { t } = useI18n();
  return (
    <section className="rh-section rh-pricing" id="pricing" aria-label="Pricing plans">
      <div className="rh-shell">
        <div className="rh-section-head">
          <div className="kicker"><div className="num">04</div><div className="cat">§ {t('landing.pricingEyebrow', 'Pricing')}</div></div>
          <h2 className="rh-reveal">{t('landing.pricingTitle', 'Clear pricing. No surprises.')}</h2>
        </div>
        <div className="rh-price-grid rh-reveal">
          <div className="plan">
            <div className="plan-name">Free</div>
            <h3>{t('landing.plan.freeHeadline', 'Try it out.')}</h3>
            <div className="plan-price">$0<small>{t('landing.plan.foreverSuffix', '/mo · free forever')}</small></div>
            <div className="plan-sub">{t('landing.plan.freeSub', 'Test drive, not daily use. 3 drafts to see if it fits.')}</div>
            <ul>
              <li><Check />{t('landing.plan.free1', '3 AI drafts / month')}</li>
              <li><Check />{t('landing.plan.free2', '1 review platform')}</li>
              <li><Check />{t('landing.plan.free3', '1 business')}</li>
              <li><Check />{t('landing.plan.free4', 'CSV import')}</li>
            </ul>
            <Link to="/register" className="rh-btn rh-btn-ghost">{t('nav.startFree', 'Start free')}</Link>
          </div>
          <div className="plan featured">
            <div className="badge">{t('landing.plan.popular', 'Most popular')}</div>
            <div className="plan-name">Pro</div>
            <h3>{t('landing.plan.proHeadline', 'For shops with real review volume.')}</h3>
            <div className="plan-price">$29<small>/mo</small></div>
            <div className="plan-sub">{t('landing.plan.proSub', 'Unlimited AI drafts and the analytics that actually matter.')}</div>
            <ul>
              <li><Check />{t('landing.plan.pro1', 'Unlimited AI drafts')}</li>
              <li><Check />{t('landing.plan.pro2', '6 platforms (Google, Wongnai, Yelp…)')}</li>
              <li><Check />{t('landing.plan.pro3', 'AI drafts in 10 languages')}</li>
              <li><Check />{t('landing.plan.pro4', 'Sentiment + trends + weekly digest')}</li>
              <li><Check />{t('landing.plan.pro5', 'Templates + CSV export')}</li>
              <li><Check />{t('landing.plan.pro6', 'Email alerts on new + negative reviews')}</li>
            </ul>
            <Link to="/register" className="rh-btn rh-btn-amber">{t('landing.plan.choosePro', 'Choose Pro · $29/mo')}</Link>
          </div>
          <div className="plan">
            <div className="plan-name">Business</div>
            <h3>{t('landing.plan.businessHeadline', 'Multi-location.')}</h3>
            <div className="plan-price">$59<small>/mo</small></div>
            <div className="plan-sub">{t('landing.plan.businessSub', 'For chains, agencies, and hotels with multiple properties.')}</div>
            <ul>
              <li><Check />{t('landing.plan.business1', 'Everything in Pro')}</li>
              <li><Check />{t('landing.plan.business2', 'Up to 5 businesses')}</li>
              <li><Check />{t('landing.plan.business3', 'API + webhooks (Zapier / Slack / n8n)')}</li>
              <li><Check />{t('landing.plan.business4', 'Priority support')}</li>
            </ul>
            <Link to="/register" className="rh-btn rh-btn-ghost">{t('landing.plan.chooseBusiness', 'Choose Business · $59/mo')}</Link>
          </div>
        </div>
        {/* Starter callout — the missing $14 tier. Surfaced as a thin row so
            the 3-card grid stays clean while the price catalog stays honest. */}
        <p className="rh-pricing-callout rh-reveal" style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--rh-ink-3)' }}>
          {t('landing.plan.starterCallout', 'Just need the basics with email alerts? ')}
          <Link to="/pricing" style={{ fontWeight: 600, color: 'var(--rh-ink)' }}>
            {t('landing.plan.starterCalloutLink', 'Starter is $14/mo — see all plans →')}
          </Link>
        </p>
      </div>
    </section>
  );
}

// ── FAQ — preserves existing i18n keys + accessible button semantics ──────
function Faq({ t }) {
  const items = [
    { q: t('landing.faq1Q'), a: t('landing.faq1A') },
    { q: t('landing.faq2Q'), a: t('landing.faq2A') },
    { q: t('landing.faq3Q'), a: t('landing.faq3A') },
    { q: t('landing.faq4Q'), a: t('landing.faq4A') },
    { q: t('landing.faq5Q'), a: t('landing.faq5A') },
    { q: t('landing.faq6Q'), a: t('landing.faq6A') },
  ];
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <section className="rh-section rh-faq-section" id="faq" aria-label="Frequently asked questions">
      <div className="rh-shell">
        <div className="rh-section-head">
          <div className="kicker"><div className="num">05</div><div className="cat">§ {t('landing.faqEyebrow')}</div></div>
          <h2 className="rh-reveal">{t('landing.faqTitle')}</h2>
        </div>
        <div className="rh-faq">
          {items.map((item, i) => {
            const isOpen = openIdx === i;
            return (
              <div className={'faq-item' + (isOpen ? ' open' : '')} key={i}>
                <button
                  type="button"
                  className="faq-summary"
                  onClick={() => setOpenIdx(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                >
                  <span>{item.q}</span>
                  <span className="ico">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M7 2v10M2 7h10" /></svg>
                  </span>
                </button>
                {isOpen && (
                  <div id={`faq-panel-${i}`} role="region" className="faq-panel">{item.a}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Big CTA + Footer ───────────────────────────────────────────────────────
function BigCta() {
  const { t } = useI18n();
  return (
    <section className="rh-big-cta" id="cta" aria-label="Sign up call to action">
      <div className="rh-shell">
        <div className="rh-mono" style={{ color: 'color-mix(in oklab, var(--rh-paper) 55%, transparent)', marginBottom: 20 }}>— {t('landing.ctaEyebrow', 'Ready when you are')} —</div>
        <h2>{t('landing.ctaTitle')}</h2>
        <p>{t('landing.ctaSubtitle')}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" className="rh-btn rh-btn-primary rh-btn-lg">{t('landing.ctaButton')} <Arrow /></Link>
          <a href="#demo" className="rh-btn rh-btn-ghost rh-btn-lg">{t('landing.ctaSecondary', 'See a live draft')}</a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="rh-footer">
      <div className="rh-shell">
        <div className="foot-top">
          <div>
            <Link to="/" className="rh-brand">
              <Logo size={30} />
              <div className="wm">Review<em>Hub</em></div>
            </Link>
            <div className="tagline">{t('landing.footerTagline')}</div>
          </div>
          <div className="cols">
            <div>
              <h4>{t('landing.footerProduct', 'Product')}</h4>
              <ul>
                <li><Link to="/tools/review-reply-generator">{t('landing.footerFreeTool', 'Free tool')}</Link></li>
                <li><Link to="/login">{t('landing.footerDashboard', 'Dashboard')}</Link></li>
                <li><Link to="/pricing">{t('landing.footerPricing', 'Pricing')}</Link></li>
                <li><a href="#demo">{t('landing.footerAiDrafts', 'AI drafts')}</a></li>
                <li><a href="#features">{t('landing.footerFeatures', 'Features')}</a></li>
              </ul>
            </div>
            <div>
              <h4>{t('landing.footerLegal', 'Legal')}</h4>
              <ul>
                <li><Link to="/privacy">{t('landing.footerPrivacy', 'Privacy')}</Link></li>
                <li><Link to="/terms">{t('landing.footerTerms', 'Terms')}</Link></li>
                <li><Link to="/acceptable-use">{t('landing.footerAcceptable', 'Acceptable use')}</Link></li>
                <li><Link to="/refund-policy">{t('landing.footerRefunds', 'Refunds')}</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="copy">
          <div>© 2026 ReviewHub · <span style={{ opacity: 0.75 }}>🇹🇭 {t('landing.footerOriginBadge', 'Made in Thailand · Used everywhere')}</span></div>
          <div className="status rh-mono">{t('landing.footerStatus', 'all systems nominal')}</div>
        </div>
      </div>
    </footer>
  );
}

// ── Gimmick layer: R-key spawns a drafting toast; CTA clicks burst stars ──
// All samples shown as Google reviews — that's the only platform the
// product ships with at launch. Don't reintroduce Yelp/Wongnai/TripAdvisor
// labels here without restoring real provider integrations first.
const DRAFT_SAMPLES_EN = [
  { name: 'Alex K.', plat: 'google', platLabel: 'Google', stars: 5, body: 'Best flat white on the block. Staff remembered my name by visit two.' },
  { name: 'Nina D.', plat: 'google', platLabel: 'Google', stars: 4, body: 'Loved the food, patio was freezing though. Heaters would help.' },
  { name: 'Rai T.',  plat: 'google', platLabel: 'Google', stars: 5, body: 'ขนมปังอร่อยมาก กาแฟเข้มกำลังดี' },
  { name: 'Sam O.',  plat: 'google', platLabel: 'Google', stars: 5, body: 'Best brunch we had all trip. Saved a window table without asking.' },
  { name: 'Mia L.',  plat: 'google', platLabel: 'Google', stars: 3, body: 'Food was good but the wait for a table was 35 minutes on a Wednesday.' },
];
const DRAFT_SAMPLES_TH = [
  { name: 'อเล็กซ์ ก.', plat: 'google', platLabel: 'Google', stars: 5, body: 'แฟลตไวท์อร่อยที่สุดในย่านนี้ พนักงานจำชื่อได้ตั้งแต่มาครั้งที่สอง' },
  { name: 'นีน่า ด.',  plat: 'google', platLabel: 'Google', stars: 4, body: 'อาหารอร่อยแต่ลานข้างนอกหนาวมาก น่าจะมีฮีตเตอร์' },
  { name: 'ราย ท.',   plat: 'google', platLabel: 'Google', stars: 5, body: 'ขนมปังอร่อยมาก กาแฟเข้มกำลังดี' },
  { name: 'แซม โอ.',   plat: 'google', platLabel: 'Google', stars: 5, body: 'บรันช์ที่ดีที่สุดของทริป จองโต๊ะริมหน้าต่างให้โดยไม่ต้องร้องขอ' },
  { name: 'มีอา ล.',   plat: 'google', platLabel: 'Google', stars: 3, body: 'อาหารดีแต่รอโต๊ะ 35 นาทีในวันพุธ' },
];

function GimmickLayer() {
  const { t, lang } = useI18n();
  const DRAFT_SAMPLES = lang === 'th' ? DRAFT_SAMPLES_TH : DRAFT_SAMPLES_EN;
  const [toasts, setToasts] = useState([]);
  const [hintShown, setHintShown] = useState(true);
  const nextId = useRef(1);

  const spawnToast = useCallback(async () => {
    const id = nextId.current++;
    const pick = DRAFT_SAMPLES[Math.floor(Math.random() * DRAFT_SAMPLES.length)];
    setToasts((ts) => [...ts, { id, review: pick, draft: '', typing: true }]);
    let text = '';
    try {
      const { data } = await api.post('/public/review-reply-generator', {
        reviewer_name: pick.name,
        rating: pick.stars,
        platform: pick.plat,
        business_name: lang === 'th' ? 'ร้านกาแฟริมทาง' : 'Corner Bistro',
        review_text: pick.body,
        tone: 'warm',
        lang,
      });
      text = (data && data.draft) || '';
    } catch (err) {
      text = 'Appreciate you stopping by — see you next time.';
    }
    let i = 0;
    const iv = setInterval(() => {
      i += 2;
      setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, draft: text.slice(0, i) } : t)));
      if (i >= text.length) {
        clearInterval(iv);
        setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, typing: false } : t)));
        setTimeout(() => {
          setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, out: true } : t)));
          setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 400);
        }, 5000);
      }
    }, 18);
  }, []);

  const dismissHint = () => setHintShown(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches && e.target.matches('input, textarea, [contenteditable]')) return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        dismissHint();
        spawnToast();
      }
    };
    const onClick = (e) => {
      const btn = e.target.closest && e.target.closest('.rh-btn-amber, .rh-btn-primary');
      if (!btn) return;
      if (btn.closest('#demo')) return;
      const r = btn.getBoundingClientRect();
      spawnBurst(r.left + r.width / 2, r.top + r.height / 2, 8);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [spawnToast]);

  const closeToast = (id) => {
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, out: true } : t)));
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 400);
  };

  return (
    <>
      <div className="rh-toast-dock" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={'rh-draft-toast' + (toast.out ? ' out' : '')}>
            <div className="dt-accent" />
            <div className="dt-head">
              <div className="ttl">✦ {t('landing.toastDrafting', 'Drafting')} · {toast.review.platLabel}</div>
              <button className="close" onClick={() => closeToast(toast.id)} aria-label={t('common.close', 'Close')}>×</button>
            </div>
            <div className="dt-body">
              <div className="review"><b>{toast.review.name}</b> · {'★'.repeat(toast.review.stars)}<br />"{toast.review.body}"</div>
              <div className="dt-label">{t('landing.toastAiDraft', 'AI draft')}</div>
              <div className={'draft' + (toast.typing ? ' typing' : '')}>{toast.draft}</div>
            </div>
          </div>
        ))}
      </div>
      {hintShown && (
        <button className="rh-kbd-hint" onClick={() => { dismissHint(); spawnToast(); }} aria-label={t('landing.hintAria', 'Try drafting a review')}>
          {t('landing.hintPressLabel', 'Press')} <kbd>R</kbd> {t('landing.hintToDraft', 'to draft a reply')}
        </button>
      )}
    </>
  );
}

// ── Page wrapper: scroll-reveal + style block ─────────────────────────────
export default function Landing() {
  const { t } = useI18n();
  usePageTitle(t('page.landing', 'AI review replies in 10 languages'));

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const els = document.querySelectorAll('.rh-reveal');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1, rootMargin: '-50px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="rh-design">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-[color:var(--rh-paper)] focus:text-[color:var(--rh-teal)] focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold focus:shadow-lg focus:outline-none"
      >
        {t('a11y.skipToMain', 'Skip to main content')}
      </a>
      {/* Logged-in users who land on `/` (clicked the logo from the dashboard,
          or just typed the bare domain) shouldn't see "Sign in / Start free"
          CTAs as if they were strangers — show their account chrome instead.
          The marketing nav stays for the truly-new visitor. */}
      {isLoggedIn() ? <Navbar /> : (
        <MarketingNav sections={[
          { id: 'how', label: t('nav.howItWorks', 'How it works') },
          { id: 'demo', label: t('nav.aiDrafts', 'AI drafts') },
          { id: 'features', label: t('nav.features', 'Features') },
          { id: 'pricing', label: t('nav.pricing', 'Pricing') },
          { id: 'faq', label: t('nav.faq', 'FAQ') },
        ]} />
      )}
      <main id="main-content">
        <Hero />
        <Marquee />
        <HowItWorks />
        <AiDemo />
        <PullQuote />
        <FeatureGrid />
        <Pricing />
        <Faq t={t} />
        <BigCta />
      </main>
      <Footer />
      <GimmickLayer />
    </div>
  );
}

