// popup.jsx — ReviewHub Chrome extension popup (interactive)

const PLATFORMS = {
  google:     { name: 'Google',      color: '#4285F4', domain: 'google.com/maps',         bg: '#ffffff' },
  yelp:       { name: 'Yelp',        color: '#D32323', domain: 'yelp.com/biz',            bg: '#ffffff' },
  facebook:   { name: 'Facebook',    color: '#1877F2', domain: 'facebook.com',            bg: '#f0f2f5' },
  tripadvisor:{ name: 'Tripadvisor', color: '#00AF87', domain: 'tripadvisor.com',         bg: '#ffffff' },
  trustpilot: { name: 'Trustpilot',  color: '#00B67A', domain: 'trustpilot.com',          bg: '#ffffff' },
  amazon:     { name: 'Amazon',      color: '#FF9900', domain: 'amazon.com',              bg: '#ffffff' },
  etsy:       { name: 'Etsy',        color: '#F1641E', domain: 'etsy.com',                bg: '#ffffff' },
};

const LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇺🇸' },
  { code: 'th', label: 'ไทย',         flag: '🇹🇭' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪' },
  { code: 'pt', label: 'Português',  flag: '🇵🇹' },
  { code: 'it', label: 'Italiano',   flag: '🇮🇹' },
  { code: 'ja', label: '日本語',       flag: '🇯🇵' },
  { code: 'zh', label: '中文',         flag: '🇨🇳' },
  { code: 'ko', label: '한국어',       flag: '🇰🇷' },
];

const TONES = ['Friendly', 'Professional', 'Apologetic', 'Grateful'];

// Canned review scenarios — one per platform, varied star ratings + content
const REVIEWS = {
  google: {
    author: 'Sarah M.',
    avatar: '#fbbf24',
    stars: 5,
    date: '2 days ago',
    text: "Absolutely loved the oat-milk flat white! The barista remembered my order from last week — the kind of detail that makes a neighborhood café feel like home. Wi-Fi was fast too, got a ton of work done.",
    businessName: "Ember Coffee House",
  },
  yelp: {
    author: 'David K.',
    avatar: '#f87171',
    stars: 2,
    date: '1 week ago',
    text: "Waited 25 minutes for a table even though we had a reservation. Food was okay but by the time it arrived we had to rush to eat. Not the experience I was hoping for on our anniversary.",
    businessName: "Ember Coffee House",
  },
  facebook: {
    author: 'Priya R.',
    avatar: '#a78bfa',
    stars: 5,
    date: '3 days ago',
    text: "Best croissants in the city. Flaky, buttery, and always warm. The new matcha latte is incredible too — please never take it off the menu!",
    businessName: "Ember Coffee House",
  },
  tripadvisor: {
    author: 'James O.',
    avatar: '#60a5fa',
    stars: 4,
    date: '5 days ago',
    text: "Found this spot walking back from the museum and stayed for three hours. Great atmosphere, the staff were welcoming, and the avocado toast hit the spot. Only wish there were more outlets near the window seats.",
    businessName: "Ember Coffee House",
  },
  trustpilot: {
    author: 'Elena F.',
    avatar: '#34d399',
    stars: 5,
    date: 'yesterday',
    text: "Ordered beans online twice now and both shipments arrived within 48 hours. Packaging is beautiful and the Ethiopia single-origin is my new favorite.",
    businessName: "Ember Coffee House",
  },
  amazon: {
    author: 'M. Thompson',
    avatar: '#fb923c',
    stars: 3,
    date: '2 weeks ago',
    text: "Beans taste great but one of the bags in my subscription arrived with a torn seal. Contacted support and haven't heard back after 4 days. Giving 3 stars pending resolution.",
    businessName: "Ember Coffee House",
  },
  etsy: {
    author: 'Maya L.',
    avatar: '#f472b6',
    stars: 5,
    date: '4 days ago',
    text: "The hand-thrown mug arrived perfectly packaged and is even more beautiful in person. You can feel the care that went into it. Thank you!",
    businessName: "Ember Coffee House",
  },
};

// Canned AI replies by platform + tone + language. Demo-only; real product calls Claude.
const REPLY_TEMPLATES = {
  google: {
    Friendly: {
      en: "Sarah, you just made our morning! 🫶 Remembering your order is honestly the fun part of the job — we're so glad the flat white and the Wi-Fi are treating you right. See you next week for the usual?\n\n— Ember Coffee House",
      th: "ซาร่าห์ คุณทำให้เช้านี้ของเราสดใสมากๆ เลยค่ะ! 🫶 การจำออเดอร์ประจำของลูกค้าเป็นส่วนที่สนุกที่สุดของงานเรา ดีใจที่แฟลตไวท์และ Wi-Fi ถูกใจนะคะ เจอกันสัปดาห์หน้าเมนูเดิมไหมคะ?\n\n— Ember Coffee House",
      es: "¡Sarah, nos alegraste la mañana! 🫶 Recordar tu pedido es de lo mejor de este trabajo — nos encanta que el flat white y el Wi-Fi te traten bien. ¿Nos vemos la próxima semana con lo de siempre?\n\n— Ember Coffee House",
    },
    Professional: {
      en: "Thank you, Sarah. We truly appreciate you taking the time to share this, and we're delighted that both the flat white and our workspace met your expectations. We look forward to welcoming you back soon.\n\n— The team at Ember Coffee House",
      th: "ขอบคุณมากค่ะ ซาร่าห์ เราซาบซึ้งที่คุณสละเวลามารีวิวให้ และดีใจอย่างยิ่งที่แฟลตไวท์และพื้นที่นั่งทำงานเป็นที่ประทับใจ หวังว่าจะได้ต้อนรับคุณอีกเร็วๆ นี้ค่ะ\n\n— ทีมงาน Ember Coffee House",
    },
    Grateful: {
      en: "Sarah, reviews like this are what keep small cafés going. Thank you for noticing the little things — they mean the world to the team. Your flat white will be ready whenever you are.\n\n— Ember Coffee House",
    },
  },
  yelp: {
    Apologetic: {
      en: "David, I'm so sorry — a 25-minute wait on your anniversary with a reservation is not okay, and I understand why the meal felt rushed. That's on us. I'd love to make it right; please reach me directly at hello@embercoffee.co and we'll take care of your next visit.\n\n— Maria, owner",
      th: "เดวิดคะ ขอโทษจริงๆ ค่ะ การจองโต๊ะไว้แล้วต้องรอ 25 นาทีในวันครบรอบแต่งงานเป็นสิ่งที่ไม่ควรเกิดขึ้น เข้าใจเลยว่าทำให้ต้องเร่งทาน เป็นความผิดพลาดของเราเอง อยากแก้ไขให้ค่ะ ติดต่อดิฉันโดยตรงที่ hello@embercoffee.co นะคะ\n\n— มาเรีย เจ้าของร้าน",
      es: "David, lo siento muchísimo — 25 minutos de espera en su aniversario con reserva no es aceptable, y entiendo que tuvieran que comer con prisa. Es culpa nuestra. Me encantaría compensarlo; escríbame directamente a hello@embercoffee.co.\n\n— Maria, propietaria",
    },
    Professional: {
      en: "David, thank you for the candid feedback. A 25-minute wait with a reservation, especially on an anniversary, is not the standard we hold ourselves to. I'd appreciate the chance to make this right — please contact me at hello@embercoffee.co.\n\n— Maria, Owner",
    },
  },
  facebook: {
    Friendly: {
      en: "Priya, we'll pass this along to the pastry team — they're going to be thrilled! 🥐 And don't worry, the matcha latte has officially earned permanent-menu status. See you soon!\n\n— Ember Coffee House",
    },
  },
  tripadvisor: {
    Friendly: {
      en: "James, thank you for stopping in — and for the outlet tip! We're actually adding more this month, so your next three-hour session should be fully charged. ⚡ Glad the avocado toast delivered.\n\n— Ember Coffee House",
    },
    Professional: {
      en: "James, thank you for taking the time to share your experience. We're glad our team and menu met the mark, and we appreciate the feedback about outlet availability — we're actively addressing it.\n\n— Ember Coffee House",
    },
  },
  trustpilot: {
    Grateful: {
      en: "Elena, thank you! The Ethiopia is a team favorite too — roasted every Tuesday, so you're always getting it fresh. Enjoy, and happy brewing.\n\n— Ember Coffee House",
    },
  },
  amazon: {
    Apologetic: {
      en: "Hi M. Thompson — that's not the experience we want for any subscriber. I've flagged this with our fulfillment partner and we're sending a replacement bag today at no cost. Support should have responded already; if not, please reply here and I'll personally follow up.\n\n— Ember Coffee House",
    },
  },
  etsy: {
    Grateful: {
      en: "Maya, thank you so much! 🙏 Every mug is thrown and glazed by hand, so reviews like yours make the long studio days worth it. Enjoy that first morning coffee!\n\n— Ember Coffee House",
    },
  },
};

function getReply(platform, tone, lang) {
  const p = REPLY_TEMPLATES[platform] || {};
  const t = p[tone] || Object.values(p)[0] || {};
  return t[lang] || t.en || "Thank you so much for taking the time to share your feedback. We really appreciate it and hope to see you again soon.\n\n— Ember Coffee House";
}

// ─── Logo ──────────────────────────────────────────────────────────────────
function ReviewHubLogo({ size = 20, showText = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: size + 8, height: size + 8, borderRadius: 8,
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(99,102,241,.35)',
      }}>
        <svg width={size - 2} height={size - 2} viewBox="0 0 20 20" fill="none">
          <path d="M10 2.5l1.8 4.5 4.7.4-3.6 3 1.1 4.6L10 12.6 5.9 15l1.1-4.6-3.6-3 4.7-.4L10 2.5z"
                fill="#fff" />
          <circle cx="15" cy="5" r="1.3" fill="#fff" opacity="0.9" />
        </svg>
      </div>
      {showText && (
        <span style={{
          fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
          color: '#0f172a',
        }}>ReviewHub</span>
      )}
    </div>
  );
}

// ─── Star rating ───────────────────────────────────────────────────────────
function Stars({ count = 5, size = 14 }) {
  return (
    <div style={{ display: 'flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 16 16"
             fill={i <= count ? '#f59e0b' : '#e5e7eb'}>
          <path d="M8 1.5l1.9 4.2 4.6.4-3.5 3 1.1 4.5L8 11.2 3.9 13.6 5 9.1 1.5 6.1l4.6-.4L8 1.5z" />
        </svg>
      ))}
    </div>
  );
}

// ─── Platform pill icon ────────────────────────────────────────────────────
function PlatformIcon({ id, size = 14 }) {
  const p = PLATFORMS[id];
  const letter = id === 'tripadvisor' ? 'T' : p.name[0];
  return (
    <div style={{
      width: size + 4, height: size + 4, borderRadius: '50%',
      background: p.color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size - 4, fontWeight: 700, flexShrink: 0,
    }}>{letter}</div>
  );
}

// ─── The Popup itself (the product) ────────────────────────────────────────
function ExtensionPopup({ platform, setPlatform, accent, onReplyCopied }) {
  const [tone, setTone] = React.useState('Friendly');
  const [lang, setLang] = React.useState('en');
  const [langOpen, setLangOpen] = React.useState(false);
  const [platformOpen, setPlatformOpen] = React.useState(false);
  const [phase, setPhase] = React.useState('idle');   // idle | generating | ready
  const [reply, setReply] = React.useState('');
  const [typed, setTyped] = React.useState('');
  const [elapsed, setElapsed] = React.useState(0);
  const [copied, setCopied] = React.useState(false);

  const review = REVIEWS[platform];
  const pMeta = PLATFORMS[platform];

  // default tone per review sentiment
  React.useEffect(() => {
    if (review.stars <= 2) setTone('Apologetic');
    else if (review.stars === 3) setTone('Professional');
    else setTone('Friendly');
  }, [platform]);

  const generate = () => {
    setPhase('generating');
    setReply('');
    setTyped('');
    setElapsed(0);
    const target = getReply(platform, tone, lang);
    // elapsed counter
    const startedAt = Date.now();
    const tick = setInterval(() => {
      const e = (Date.now() - startedAt) / 1000;
      setElapsed(Math.min(9.9, e));
    }, 80);
    // simulate 1.5s thinking then stream
    setTimeout(() => {
      clearInterval(tick);
      setElapsed(0);
      setReply(target);
      setPhase('ready');
      // typewriter
      let i = 0;
      const id = setInterval(() => {
        i += Math.max(1, Math.round(target.length / 90));
        if (i >= target.length) {
          setTyped(target);
          clearInterval(id);
        } else {
          setTyped(target.slice(0, i));
        }
      }, 22);
    }, 1400);
  };

  const regenerate = () => generate();

  const copy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(reply).catch(() => {});
    setCopied(true);
    onReplyCopied && onReplyCopied();
    setTimeout(() => setCopied(false), 1600);
  };

  // When platform or tone or language changes after a reply is out, mark stale
  React.useEffect(() => {
    if (phase === 'ready') {
      setPhase('idle');
      setReply('');
      setTyped('');
    }
  }, [platform, tone, lang]);

  const currentLang = LANGUAGES.find(l => l.code === lang);

  return (
    <div style={{
      width: 380,
      background: '#fff',
      borderRadius: 14,
      boxShadow: '0 20px 48px rgba(15,23,42,.22), 0 2px 0 rgba(255,255,255,.9) inset, 0 0 0 1px rgba(15,23,42,.08)',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#0f172a',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px 10px',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <ReviewHubLogo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 8px', borderRadius: 999,
            background: '#f0fdf4', color: '#15803d',
            fontSize: 10.5, fontWeight: 600,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />
            Connected
          </div>
          <button style={iconBtn} aria-label="Settings">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#64748b" strokeWidth="1.6">
              <circle cx="8" cy="8" r="2" />
              <path d="M8 1v2M8 13v2M15 8h-2M3 8H1M12.95 3.05l-1.4 1.4M4.45 11.55l-1.4 1.4M12.95 12.95l-1.4-1.4M4.45 4.45l-1.4-1.4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Detected review banner */}
      <div style={{
        padding: '10px 14px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
          <span>Reviewing on</span>
          <button
            onClick={() => setPlatformOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '2px 8px 2px 5px', borderRadius: 999,
              background: '#f8fafc', border: '1px solid #e2e8f0',
              fontSize: 11, fontWeight: 600, color: '#0f172a',
              cursor: 'pointer',
            }}>
            <PlatformIcon id={platform} size={12} />
            {pMeta.name}
            <svg width="9" height="9" viewBox="0 0 10 6" fill="#64748b"><path d="M0 0h10L5 6z" /></svg>
          </button>
        </div>
        <div style={{ fontSize: 10.5, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
          {review.date}
        </div>
      </div>

      {/* Platform dropdown */}
      {platformOpen && (
        <div style={{
          margin: '6px 14px 0',
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(15,23,42,.08)',
          padding: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2,
        }}>
          {Object.entries(PLATFORMS).map(([id, p]) => (
            <button key={id}
              onClick={() => { setPlatform(id); setPlatformOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 8px', borderRadius: 7,
                background: id === platform ? '#f1f5f9' : 'transparent',
                border: 0, cursor: 'pointer', textAlign: 'left',
                fontSize: 12, fontWeight: 500, color: '#0f172a',
              }}>
              <PlatformIcon id={id} size={12} />
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Review card */}
      <div style={{
        margin: '10px 14px 0',
        padding: 12,
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: review.avatar, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 600, flexShrink: 0,
          }}>{review.author.split(' ').map(s => s[0]).join('')}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>
              {review.author}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Stars count={review.stars} size={11} />
              <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 500 }}>
                {review.stars}.0
              </span>
            </div>
          </div>
        </div>
        <p style={{
          margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.5,
          color: '#334155', textWrap: 'pretty',
        }}>{review.text}</p>
      </div>

      {/* Controls — tone + language */}
      <div style={{
        padding: '12px 14px 0',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Tone
          </span>
          <button
            onClick={() => setLangOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 8px 3px 6px', borderRadius: 999,
              background: '#f8fafc', border: '1px solid #e2e8f0',
              fontSize: 11, fontWeight: 600, color: '#0f172a',
              cursor: 'pointer',
            }}>
            <span style={{ fontSize: 12 }}>{currentLang.flag}</span>
            {currentLang.label}
            <svg width="9" height="9" viewBox="0 0 10 6" fill="#64748b"><path d="M0 0h10L5 6z" /></svg>
          </button>
        </div>

        {/* Language dropdown */}
        {langOpen && (
          <div style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(15,23,42,.08)',
            padding: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2,
            maxHeight: 200, overflow: 'auto',
          }}>
            {LANGUAGES.map(l => (
              <button key={l.code}
                onClick={() => { setLang(l.code); setLangOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 8px', borderRadius: 7,
                  background: l.code === lang ? '#f1f5f9' : 'transparent',
                  border: 0, cursor: 'pointer', textAlign: 'left',
                  fontSize: 12, fontWeight: 500, color: '#0f172a',
                }}>
                <span style={{ fontSize: 14 }}>{l.flag}</span>
                {l.label}
              </button>
            ))}
          </div>
        )}

        {/* Tone segmented */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4,
          padding: 3, background: '#f1f5f9', borderRadius: 9,
        }}>
          {TONES.map(t => (
            <button key={t}
              onClick={() => setTone(t)}
              style={{
                padding: '6px 0', borderRadius: 6, border: 0,
                background: tone === t ? '#fff' : 'transparent',
                color: tone === t ? '#0f172a' : '#64748b',
                fontSize: 11, fontWeight: 600,
                boxShadow: tone === t ? '0 1px 2px rgba(15,23,42,.1)' : 'none',
                cursor: 'pointer',
              }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Generate button OR reply */}
      <div style={{ padding: '12px 14px 14px' }}>
        {phase === 'idle' && (
          <button
            onClick={generate}
            style={{
              width: '100%', height: 42, border: 0, borderRadius: 10,
              background: `linear-gradient(135deg, ${accent.from} 0%, ${accent.to} 100%)`,
              color: '#fff', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              cursor: 'pointer',
              boxShadow: `0 4px 14px ${accent.to}55, 0 0 0 1px rgba(255,255,255,.1) inset`,
              letterSpacing: '-0.005em',
            }}>
            <span style={{ fontSize: 15 }}>✨</span>
            Draft reply with AI
            <span style={{
              marginLeft: 4, padding: '2px 6px', borderRadius: 999,
              background: 'rgba(255,255,255,.22)',
              fontSize: 10, fontWeight: 600, letterSpacing: '0.02em',
            }}>10s</span>
          </button>
        )}

        {phase === 'generating' && (
          <div style={{
            padding: 14, borderRadius: 10,
            background: `linear-gradient(135deg, ${accent.from}12 0%, ${accent.to}18 100%)`,
            border: `1px solid ${accent.to}33`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ position: 'relative', width: 28, height: 28 }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: `2.5px solid ${accent.to}33`,
                borderTopColor: accent.to,
                animation: 'rh-spin 0.7s linear infinite',
              }} />
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 12,
              }}>✨</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>
                Claude is drafting…
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                {tone.toLowerCase()} · {currentLang.label} · reading the review
              </div>
            </div>
            <div style={{
              fontSize: 15, fontWeight: 700, color: accent.to,
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
            }}>{elapsed.toFixed(1)}s</div>
          </div>
        )}

        {phase === 'ready' && (
          <div>
            {/* Reply box */}
            <div style={{
              padding: 12, borderRadius: 10,
              background: `linear-gradient(180deg, ${accent.from}08 0%, #ffffff 40%)`,
              border: `1px solid ${accent.to}33`,
              position: 'relative',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 8,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 10.5, fontWeight: 600, color: accent.to,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  <span style={{ fontSize: 11 }}>✨</span>
                  AI draft
                </div>
                <div style={{ fontSize: 10.5, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                  {reply.length} chars
                </div>
              </div>
              <div style={{
                fontSize: 12.5, lineHeight: 1.55, color: '#0f172a',
                whiteSpace: 'pre-wrap', minHeight: 60, textWrap: 'pretty',
              }}>{typed}{typed.length < reply.length && (
                <span style={{
                  display: 'inline-block', width: 6, height: 13,
                  background: accent.to, verticalAlign: 'text-bottom',
                  marginLeft: 1, animation: 'rh-blink 1s steps(2) infinite',
                }} />
              )}</div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button
                onClick={copy}
                style={{
                  flex: 1, height: 36, border: 0, borderRadius: 8,
                  background: copied ? '#22c55e' : '#2563eb',
                  color: '#fff', fontSize: 12.5, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  cursor: 'pointer', transition: 'background .2s',
                }}>
                {copied ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="2.4">
                      <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Copied — paste into {pMeta.name}
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.7">
                      <rect x="4" y="4" width="9" height="10" rx="1.5" />
                      <path d="M3 11V3a1 1 0 011-1h7" />
                    </svg>
                    Copy reply
                  </>
                )}
              </button>
              <button
                onClick={regenerate}
                title="Regenerate"
                style={{
                  width: 36, height: 36, border: '1px solid #e2e8f0', borderRadius: 8,
                  background: '#fff', color: '#475569', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M13.5 4.5A6 6 0 102 8" strokeLinecap="round" />
                  <path d="M13.5 2v3h-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                title="Edit"
                style={{
                  width: 36, height: 36, border: '1px solid #e2e8f0', borderRadius: 8,
                  background: '#fff', color: '#475569', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 14px', borderTop: '1px solid #f1f5f9',
        background: '#fafbfc',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 10.5, color: '#64748b',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontWeight: 600, color: '#0f172a' }}>2</span>
          <span>of 3 free drafts today</span>
        </div>
        <button style={{
          background: 'transparent', border: 0, padding: 0,
          color: '#2563eb', fontSize: 10.5, fontWeight: 600, cursor: 'pointer',
        }}>Upgrade to Solo · $14/mo →</button>
      </div>
    </div>
  );
}

const iconBtn = {
  width: 26, height: 26, border: 0, background: 'transparent',
  borderRadius: 6, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

Object.assign(window, { ExtensionPopup, PLATFORMS, LANGUAGES, ReviewHubLogo, PlatformIcon, Stars, REVIEWS });
