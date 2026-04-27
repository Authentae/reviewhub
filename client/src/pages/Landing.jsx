import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';
import MarketingNav from '../components/MarketingNav';

const LANDING_NAV_SECTIONS = [
  { id: 'how', label: 'How it works' },
  { id: 'demo', label: 'AI drafts' },
  { id: 'features', label: 'Features' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
];

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
      <div className="rh-hero-amp" aria-hidden="true">&amp;</div>
      <div className="rh-hero-coords" aria-hidden="true">
        <span className="cx">N 13°44′</span>
        <span className="cy">E 100°31′</span>
        <span className="cn">SUKHUMVIT · BKK</span>
      </div>
      <div className="rh-shell rh-hero-inner">
        <div className="rh-hero-meta">
          <div className="rh-eyebrow">
            <span className="dot" />
            <span className="rh-mono">In private beta · join the waitlist</span>
          </div>
          <div className="rh-meta-right">
            <div className="avatars"><span>MP</span><span>PS</span><span>JR</span><span>+</span></div>
            <div className="ct">Built for <b>independent shops</b></div>
          </div>
        </div>
        <h1 className="rh-display">
          Every Google review, answered in <span className="time">10 seconds.</span>
        </h1>
        <div className="rh-hero-bottom">
          <div>
            <p className="rh-lede">
              ReviewHub pulls your <b>Google reviews</b> into one dashboard, drafts the reply <mark>in your voice</mark> — in Thai or English — and you tap copy. <b>Yelp, Facebook, TripAdvisor, Trustpilot, and Wongnai are coming soon</b>; today we ship Google.
            </p>
            <div className="rh-hero-cta">
              <Link to="/register" className="rh-btn rh-btn-amber rh-btn-lg">Start free <Arrow /></Link>
              <a href="#demo" className="rh-btn rh-btn-ghost rh-btn-lg">See a live draft</a>
              <Link to="/tools/review-reply-generator" className="rh-hero-tool-link">
                Or try the free tool first — no signup <Arrow />
              </Link>
            </div>
            <div className="rh-hero-proof">
              <div className="metric"><div className="n">10<small> langs</small></div><div className="l">Including Thai natively</div></div>
              <div className="metric"><div className="n">Google<small></small></div><div className="l">Today · others coming soon</div></div>
              <div className="metric"><div className="n">10<small>s</small></div><div className="l">From review to drafted reply</div></div>
            </div>
          </div>
          <CardStack />
        </div>
      </div>
    </section>
  );
}

function CardStack() {
  return (
    <div className="rh-card-stack">
      <div className="rh-float-card a">
        <div className="stamp">★★★★★ · Sent</div>
        <div className="sent">SENT · 8s</div>
        <div className="fc-head">
          <div className="fc-who">
            <div className="fc-avatar" style={{ background: 'var(--rh-rose)' }}>MP</div>
            <div className="fc-name">Marco P.</div>
            <Stars n={5} />
          </div>
          <div className="fc-plat">Google</div>
        </div>
        <div className="fc-body">"Barista remembered my order after one visit. Pour-over was down though."</div>
        <div className="fc-draft">
          <div className="fc-draft-label">AI draft · your voice</div>
          Appreciate you stopping by, Marco — pour-over's back Thursday. See you then.
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
          <div className="fc-plat">Wongnai</div>
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
            <div className="fc-name">Jamie R.</div>
            <Stars n={4} />
          </div>
          <div className="fc-plat">Yelp</div>
        </div>
        <div className="fc-body">"Solid croissants, a bit slow on a Saturday. Would still come back."</div>
        <div className="fc-draft">
          <div className="fc-draft-label">AI draft · warm</div>
          Thanks Jamie — we've added a second oven for weekends. Try us again.
        </div>
      </div>
    </div>
  );
}

// ── Marquee — pause on hover, brand-tinted stars + counts ─────────────────
function Marquee() {
  const platforms = [
    { name: 'Google',      color: 'oklch(0.72 0.16 240)', rating: '4.9', reviews: '1.2M' },
    { name: 'Yelp',        color: 'oklch(0.65 0.22 25)',  rating: '4.8', reviews: '340K' },
    { name: 'Facebook',    color: 'oklch(0.62 0.15 255)', rating: '4.7', reviews: '890K' },
    { name: 'TripAdvisor', color: 'oklch(0.68 0.16 155)', rating: '4.9', reviews: '210K' },
    { name: 'Trustpilot',  color: 'oklch(0.68 0.16 155)', rating: '4.8', reviews: '450K' },
    { name: 'Wongnai',     color: 'oklch(0.72 0.18 35)',  rating: '4.9', reviews: '180K' },
  ];
  const Row = () => (
    <span>
      {platforms.map((p, i) => (
        <React.Fragment key={i}>
          <span className="chunk" style={{ '--platcolor': p.color }}>
            <span className="star">★</span>
            <span className="plat">{p.name}</span>
            <span className="count">{p.rating}<span style={{ opacity: 0.5, margin: '0 6px' }}>·</span><b>{p.reviews}</b></span>
          </span>
          {i < platforms.length - 1 && <span className="sep">—</span>}
        </React.Fragment>
      ))}
      <span className="sep">—</span>
    </span>
  );
  return (
    <section className="rh-marquee" aria-label="Platform ratings showcase">
      <div className="rh-marquee-row"><Row /><Row /><Row /></div>
    </section>
  );
}

// ── How it works — 3 big bordered rows with serif Roman numerals ──────────
function HowItWorks() {
  const steps = [
    { n: 'I', cat: 'Connect', h: <>Paste a link,<br />we pull the <em>reviews.</em></>,
      p: 'Google OAuth takes 20 seconds. Other platforms accept a public URL or a CSV while their APIs warm up. You\'re online inside a minute.',
      illo: (
        <div style={{ width: '100%', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, padding: '10px 12px', background: 'var(--rh-paper)', border: '1px solid var(--rh-rule)', borderRadius: 8, fontFamily: 'var(--rh-mono)', fontSize: 11, color: 'var(--rh-ink-3)' }}>https://g.page/cafe-morning</div>
          <div style={{ padding: '10px 14px', background: 'var(--rh-teal)', color: 'var(--rh-paper)', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>Connect</div>
        </div>
      ),
    },
    { n: 'II', cat: 'Draft', h: <>AI writes in <em>your voice —</em> not "delight."</>,
      p: 'Trained on your last 20 replies. Drafts sound like you, in any of 10 languages — Thai, Japanese, and Korean done natively, not via translate.',
      illo: (
        <div style={{ width: '100%', fontFamily: 'var(--rh-sans)', fontSize: 15, color: 'var(--rh-ink)', lineHeight: 1.5, fontWeight: 500 }}>
          <div style={{ fontFamily: 'var(--rh-mono)', fontSize: 10, color: 'var(--rh-ochre-deep)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontWeight: 600 }}>✦ Draft</div>
          "Appreciate you stopping by, Marco — pour-over's back Thursday."
        </div>
      ),
    },
    { n: 'III', cat: 'Post', h: <>One tap. It's <em>published.</em></>,
      p: 'The extension posts on whatever platform page you\'re on — no copy-paste, no tab juggling, no logins to remember. Median reply time: 12 seconds.',
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
          <div className="kicker"><div className="num">01</div><div className="cat">§ Workflow</div></div>
          <h2 className="rh-reveal">Three steps to an <em>empty</em> review queue.</h2>
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
const SAMPLE_REVIEWS = {
  glowing: { name: 'Priya M.', plat: 'google', platLabel: 'Google',     stars: 5, body: 'Came here on my anniversary. Staff noticed, brought out a little candle on the tiramisu. Small thing — made the night. Thank you.' },
  mixed:   { name: 'Dan T.',   plat: 'yelp',   platLabel: 'Yelp',       stars: 3, body: 'Pasta was excellent. Service took forever though — 40 minutes for the mains on a Tuesday. Wanted to love it more than I did.' },
  harsh:   { name: 'Anon.',    plat: 'tripadvisor', platLabel: 'TripAdvisor', stars: 1, body: 'Rude manager. Overpriced. Never coming back. Zero stars if I could.' },
};
const TONE_PRESETS = [
  { id: 'warm', label: 'Warm' },
  { id: 'brisk', label: 'Brisk' },
  { id: 'formal', label: 'Formal' },
];

// Curated fallback drafts — used if the public endpoint is unreachable in dev,
// rate-limited, or otherwise erroring. Keyed by review × tone so the demo
// always shows something on-message instead of a generic error string.
const DEMO_FALLBACKS = {
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

function AiDemo() {
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
        business_name: 'Corner Bistro',
        review_text: review.body,
        tone,
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
          <div className="kicker"><div className="num">02</div><div className="cat">§ Live demo</div></div>
          <h2 className="rh-reveal">Draft one right now. <em>It's really running.</em></h2>
        </div>
        <div className="rh-demo rh-reveal">
          <div className="demo-side">
            <div className="demo-head">
              <div className="ttl"><span className="dot"></span>The review</div>
              <div className="chips">
                {Object.entries(SAMPLE_REVIEWS).map(([k, v]) => (
                  <button key={k} className={'chip' + (which === k ? ' active' : '')} onClick={() => { setWhich(k); setOutput(''); }}>{v.stars}★ {k}</button>
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
                <span className="rh-mono" style={{ color: 'color-mix(in oklab, var(--rh-paper) 55%, transparent)', padding: '4px 0' }}>Tone</span>
                {TONE_PRESETS.map((p) => (
                  <button key={p.id} className={'chip' + (tone === p.id ? ' active' : '')} onClick={() => setTone(p.id)}>{p.label}</button>
                ))}
              </div>
              <button className="rh-btn rh-btn-primary" onClick={generate} disabled={loading}>{loading ? 'Drafting…' : 'Draft reply'} <Arrow /></button>
            </div>
          </div>
          <div className="demo-side out">
            <div className="demo-head">
              <div className="ttl"><span className="dot on"></span>AI draft · in your voice</div>
              <div className="rh-mono" style={{ color: 'var(--rh-ochre)' }}>✦ Claude Haiku</div>
            </div>
            <div className={'out-text body' + (loading ? ' typing' : '')}>
              {output || <span style={{ color: 'color-mix(in oklab, var(--rh-paper) 55%, transparent)' }}>Hit <b style={{ color: 'var(--rh-paper)' }}>Draft reply</b> to see a real response from our drafting model. Change the tone or pick a different review — each run is live.</span>}
            </div>
            <div className="demo-foot">
              <div className="rh-mono" style={{ color: 'color-mix(in oklab, var(--rh-paper) 55%, transparent)' }}>
                {output ? `${output.split(/\s+/).filter(Boolean).length} words · ${Math.ceil(output.length / 5)} tokens` : '—'}
              </div>
              <Link to="/register" className="rh-btn rh-btn-ghost">Get unlimited drafts →</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Pull quote — warm rose+amber gradient panel ───────────────────────────
function PullQuote() {
  return (
    <section className="rh-pullquote" aria-label="Customer testimonial">
      <div className="rh-shell">
        <div className="q rh-reveal">
          Imagine going from <em>dreading</em> Monday morning to clearing <mark>the whole week's reviews</mark> with coffee still hot.
        </div>
        <div className="attrib rh-reveal">
          <div className="portrait" aria-hidden="true">¶</div>
          <div className="who">
            <b>What we're building toward.</b>
            <span>Real beta-customer testimonials will land here once the first cohort goes live.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Bento feature grid ────────────────────────────────────────────────────
function FeatureGrid() {
  const days = [38, 42, 55, 49, 61, 58, 72, 65, 78, 82, 79, 91];
  return (
    <section className="rh-section rh-features" id="features" aria-label="Product features">
      <div className="rh-shell">
        <div className="rh-section-head">
          <div className="kicker"><div className="num">03</div><div className="cat">§ The system</div></div>
          <h2 className="rh-reveal">Built for <em>operators</em>, not managers.</h2>
        </div>
        <div className="rh-bento">
          <div className="cell a rh-reveal">
            <div className="tag">Trends</div>
            <h3>Ratings that <em>move</em>, over time.</h3>
            <p>Sparklines per platform, weekly digest in your inbox, alerts when sentiment drops two notches in a week — so you're addressing a dip, not discovering it.</p>
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
            <div className="tag">Sentiment</div>
            <h3>Know what's <em>actually</em> said.</h3>
            <div className="viz senti">
              <div className="senti-row"><span className="lbl">Positive</span><div className="bar pos"><span /></div><span className="pct">72%</span></div>
              <div className="senti-row"><span className="lbl">Neutral</span><div className="bar neu"><span /></div><span className="pct">19%</span></div>
              <div className="senti-row"><span className="lbl">Negative</span><div className="bar neg"><span /></div><span className="pct">9%</span></div>
            </div>
          </div>
          <div className="cell c rh-reveal">
            <div className="tag">i18n · 10 langs</div>
            <h3>Thai, Japanese,<br /><em>native.</em></h3>
            <div className="viz langs">
              {['EN', 'ES', 'FR', 'DE', 'PT', 'IT', 'TH', 'JA', 'ZH', 'KO'].map((l) => (
                <span key={l} className={'lang' + (['TH', 'JA', 'KO'].includes(l) ? ' on' : '')}>{l}</span>
              ))}
            </div>
          </div>
          <div className="cell d rh-reveal">
            <div className="tag">Inbox</div>
            <h3>One feed.<br /><em>Six sources.</em></h3>
            <div className="viz mini-dash">
              <div className="mdh"><span>TODAY</span><span>14 NEW</span></div>
              <div className="mdrow"><span className="dot g" /><span className="name">Marco P. · Google</span><span className="st">★★★★★</span></div>
              <div className="mdrow"><span className="dot g" /><span className="name">Ploy S. · Wongnai</span><span className="st">★★★★★</span></div>
              <div className="mdrow"><span className="dot y" /><span className="name">Jamie R. · Yelp</span><span className="st">★★★★</span></div>
            </div>
          </div>
          <div className="cell e rh-reveal">
            <div className="tag">Roles · Audit</div>
            <h3>Team-safe by <em>default.</em></h3>
            <p>Owner, manager, responder. Every reply attributable, every change logged.</p>
          </div>
          <div className="cell f rh-reveal">
            <div className="tag">Review requests</div>
            <h3>Ask at the <em>right moment.</em></h3>
            <p>QR at the table, SMS after pickup, follow-up at day four. Measured per channel.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Pricing — cream panel, dark featured plan ─────────────────────────────
function Pricing() {
  return (
    <section className="rh-section rh-pricing" id="pricing" aria-label="Pricing plans">
      <div className="rh-shell">
        <div className="rh-section-head">
          <div className="kicker"><div className="num">04</div><div className="cat">§ Pricing</div></div>
          <h2 className="rh-reveal">Priced like we're <em>building it ourselves.</em></h2>
        </div>
        <div className="rh-price-grid rh-reveal">
          <div className="plan">
            <div className="plan-name">Solo</div>
            <h3>The first shop.</h3>
            <div className="plan-price">$0<small>/mo, forever</small></div>
            <div className="plan-sub">One location, two platforms, all the basics.</div>
            <ul>
              <li><Check />Up to 50 reviews / month</li>
              <li><Check />2 platforms of your choice</li>
              <li><Check />AI drafts (template fallback)</li>
              <li><Check />Chrome extension</li>
            </ul>
            <Link to="/register" className="rh-btn rh-btn-ghost">Start free</Link>
          </div>
          <div className="plan featured">
            <div className="badge">Most popular</div>
            <div className="plan-name">Shop</div>
            <h3>A real front door.</h3>
            <div className="plan-price">$29<small>/mo</small></div>
            <div className="plan-sub">For the place you actually show up to every morning.</div>
            <ul>
              <li><Check />Unlimited reviews</li>
              <li><Check />Five platforms live, Wongnai in beta</li>
              <li><Check />Claude-powered drafts, 10 languages</li>
              <li><Check />Sentiment, trends, weekly digest</li>
              <li><Check />3 teammates</li>
            </ul>
            <Link to="/register" className="rh-btn rh-btn-amber">Choose Shop · $29/mo</Link>
          </div>
          <div className="plan">
            <div className="plan-name">Chain</div>
            <h3>More than one.</h3>
            <div className="plan-price">$59<small>/mo</small></div>
            <div className="plan-sub">For multi-location operators juggling dashboards.</div>
            <ul>
              <li><Check />Everything in Shop</li>
              <li><Check />Up to 10 locations</li>
              <li><Check />Unlimited teammates + audit log</li>
              <li><Check />API + webhooks</li>
              <li><Check />Priority support</li>
            </ul>
            <Link to="/register" className="rh-btn rh-btn-ghost">Choose Chain · $59/mo</Link>
          </div>
        </div>
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
          <div className="kicker"><div className="num">05</div><div className="cat">§ Common questions</div></div>
          <h2 className="rh-reveal">Everything <em>else.</em></h2>
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
  return (
    <section className="rh-big-cta" id="cta" aria-label="Sign up call to action">
      <div className="rh-shell">
        <div className="rh-mono" style={{ color: 'color-mix(in oklab, var(--rh-paper) 55%, transparent)', marginBottom: 20 }}>— Ready when you are —</div>
        <h2>Clear the queue by <em>lunch.</em></h2>
        <p>Install the extension, paste one Google link, post your first AI-drafted reply inside two minutes. No card, no meeting, no onboarding webinar.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" className="rh-btn rh-btn-primary rh-btn-lg">Add to Chrome — free <Arrow /></Link>
          <a href="#demo" className="rh-btn rh-btn-ghost rh-btn-lg">Watch the 60-second tour</a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="rh-footer">
      <div className="rh-shell">
        <div className="foot-top">
          <div>
            <Link to="/" className="rh-brand">
              <div className="mark">r</div>
              <div className="wm">Review<em>Hub</em></div>
            </Link>
            <div className="tagline">The reply layer for <em>local business.</em></div>
          </div>
          <div className="cols">
            <div>
              <h4>Product</h4>
              <ul>
                <li><Link to="/register">Chrome extension</Link></li>
                <li><Link to="/login">Dashboard</Link></li>
                <li><a href="#demo">AI drafts</a></li>
                <li><a href="#features">Review requests</a></li>
                <li><a href="#features">Analytics</a></li>
              </ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul>
                <li><Link to="/about">About</Link></li>
                <li><Link to="/changelog">Changelog</Link></li>
                <li><Link to="/status">Status</Link></li>
                <li><Link to="/contact">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4>Legal</h4>
              <ul>
                <li><Link to="/privacy">Privacy</Link></li>
                <li><Link to="/terms">Terms</Link></li>
                <li><Link to="/acceptable-use">Acceptable use</Link></li>
                <li><Link to="/refunds">Refunds</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="copy">
          <div>© 2026 ReviewHub · Made solo in Chiang Mai</div>
          <div className="status rh-mono">all systems nominal</div>
        </div>
      </div>
    </footer>
  );
}

// ── Gimmick layer: R-key spawns a drafting toast; CTA clicks burst stars ──
const DRAFT_SAMPLES = [
  { name: 'Alex K.', plat: 'google',  platLabel: 'Google',  stars: 5, body: 'Best flat white on the block. Staff remembered my name by visit two.' },
  { name: 'Nina D.', plat: 'yelp',    platLabel: 'Yelp',    stars: 4, body: 'Loved the food, patio was freezing though. Heaters would help.' },
  { name: 'Rai T.',  plat: 'wongnai', platLabel: 'Wongnai', stars: 5, body: 'ขนมปังอร่อยมาก กาแฟเข้มกำลังดี' },
  { name: 'Sam O.',  plat: 'tripadvisor', platLabel: 'TripAdvisor', stars: 5, body: 'Best brunch we had all trip. Saved a window table without asking.' },
  { name: 'Mia L.',  plat: 'facebook', platLabel: 'Facebook', stars: 3, body: 'Food was good but the wait for a table was 35 minutes on a Wednesday.' },
];

function GimmickLayer() {
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
        business_name: 'Corner Bistro',
        review_text: pick.body,
        tone: 'warm',
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
        {toasts.map((t) => (
          <div key={t.id} className={'rh-draft-toast' + (t.out ? ' out' : '')}>
            <div className="dt-accent" />
            <div className="dt-head">
              <div className="ttl">✦ Drafting · {t.review.platLabel}</div>
              <button className="close" onClick={() => closeToast(t.id)} aria-label="Close">×</button>
            </div>
            <div className="dt-body">
              <div className="review"><b>{t.review.name}</b> · {'★'.repeat(t.review.stars)}<br />"{t.review.body}"</div>
              <div className="dt-label">AI draft</div>
              <div className={'draft' + (t.typing ? ' typing' : '')}>{t.draft}</div>
            </div>
          </div>
        ))}
      </div>
      {hintShown && (
        <button className="rh-kbd-hint" onClick={() => { dismissHint(); spawnToast(); }} aria-label="Try drafting a review">
          Press <kbd>R</kbd> to draft a reply
        </button>
      )}
    </>
  );
}

// ── Page wrapper: scroll-reveal + style block ─────────────────────────────
export default function Landing() {
  const { t } = useI18n();
  usePageTitle('ReviewHub — The reply layer for local business');

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
        Skip to main content
      </a>
      <MarketingNav sections={LANDING_NAV_SECTIONS} />
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

