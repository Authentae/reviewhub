// Interactive LINE OA notification mockup for the audit-preview + /line pages.
//
// Generated 2026-05-11 via Claude Design, then ported to a proper React
// component so it ships through Vite (no CDN React+Babel cost at runtime).
// See docs/wave-postmortems/audit-preview-page-friction-teardown.md
// intervention #5 — "show, don't tell, the LINE flow."

import { useEffect, useState } from 'react';

const C = {
  paper: '#fbf8f1', ink: '#1d242c',
  teal: '#1e4d5e', tealDeep: '#163d4a',
  ochre: '#8a5e14', sage: '#6b8e7a',
  lineGreen: '#06C755', chatBg: '#F1F2F6',
  draft: '#fdf8ec',
};
const monoFont = "'JetBrains Mono', ui-monospace, monospace";
const thaiFont = "'Noto Sans Thai', system-ui, -apple-system, sans-serif";
const thaiReply = 'ขอบคุณ Olga ที่แบ่งปันค่ะ ดีใจที่ทำเลถูกใจ — เราจะติดล็อคที่ luggage hallway ในเดือนนี้ และจะดู keycard system ใหม่ค่ะ หวังว่าจะได้ต้อนรับอีกครั้ง';

const btnReset = {
  background: 'transparent', border: 0, padding: 6, margin: 0,
  cursor: 'pointer', display: 'grid', placeItems: 'center',
  color: 'inherit',
};
const flexBtn = {
  height: 34, borderRadius: 8,
  fontFamily: 'Inter', fontSize: 12.5, fontWeight: 600,
  letterSpacing: 0.1,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 4,
  padding: '0 6px',
  WebkitTapHighlightColor: 'transparent',
};

function StatusBar() {
  return (
    <div style={{
      height: 44, padding: '0 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: '#fff', color: '#9aa0a6',
      fontFamily: '-apple-system, "SF Pro Text", system-ui',
      fontSize: 15, fontWeight: 600, letterSpacing: -0.2,
      position: 'relative', zIndex: 4,
    }}>
      <span style={{ paddingTop: 2 }}>9:41</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 2 }}>
        <svg width="17" height="11" viewBox="0 0 17 11" aria-hidden="true">
          <rect x="0" y="7" width="3" height="4" rx="0.5" fill="#9aa0a6" />
          <rect x="4.5" y="5" width="3" height="6" rx="0.5" fill="#9aa0a6" />
          <rect x="9" y="2.5" width="3" height="8.5" rx="0.5" fill="#9aa0a6" />
          <rect x="13.5" y="0" width="3" height="11" rx="0.5" fill="#9aa0a6" />
        </svg>
        <svg width="16" height="11" viewBox="0 0 16 11" aria-hidden="true">
          <path d="M8 3C10.2 3 12.2 3.9 13.6 5.3L14.7 4.2C13 2.5 10.6 1.4 8 1.4C5.4 1.4 3 2.5 1.3 4.2L2.4 5.3C3.8 3.9 5.8 3 8 3Z" fill="#9aa0a6" />
          <path d="M8 6.4C9.3 6.4 10.5 6.9 11.3 7.7L12.4 6.6C11.2 5.5 9.7 4.8 8 4.8C6.3 4.8 4.8 5.5 3.6 6.6L4.7 7.7C5.5 6.9 6.7 6.4 8 6.4Z" fill="#9aa0a6" />
          <circle cx="8" cy="9.8" r="1.4" fill="#9aa0a6" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="#9aa0a6" strokeOpacity="0.5" fill="none" />
          <rect x="2" y="2" width="19" height="8" rx="1.5" fill="#9aa0a6" />
          <path d="M24 4.2V7.8C24.7 7.5 25.2 6.9 25.2 6C25.2 5.1 24.7 4.5 24 4.2Z" fill="#9aa0a6" fillOpacity="0.5" />
        </svg>
      </div>
    </div>
  );
}

function LineTitleBar({ animate }) {
  return (
    <div style={{
      background: C.lineGreen, color: '#fff',
      padding: '0 12px', height: 56,
      display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
      transform: animate ? 'translateY(0)' : 'translateY(-100%)',
      opacity: animate ? 1 : 0,
      transition: 'transform .55s cubic-bezier(.2,.7,.2,1) .15s, opacity .35s ease .15s',
      position: 'relative', zIndex: 3,
    }}>
      <button style={btnReset} aria-label="back" type="button">
        <svg width="11" height="20" viewBox="0 0 11 20" fill="none" aria-hidden="true">
          <path d="M9.5 1.5L2 10l7.5 8.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: '#fff', marginLeft: 4,
        display: 'grid', placeItems: 'center',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)',
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: C.teal, color: '#fff',
          display: 'grid', placeItems: 'center',
          fontFamily: 'Inter', fontWeight: 700, fontSize: 12,
          letterSpacing: 0.2,
        }}>R</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, marginLeft: 4 }}>
        <span style={{
          fontFamily: 'Inter', fontWeight: 600, fontSize: 16.5,
          letterSpacing: -0.1,
        }}>ReviewHub</span>
        <svg width="15" height="15" viewBox="0 0 15 15" style={{ marginTop: 1 }} aria-label="Verified Official Account">
          <path d="M7.5 0.5l1.6 1.1 1.9-.3.9 1.7 1.7.9-.3 1.9 1.1 1.6-1.1 1.6.3 1.9-1.7.9-.9 1.7-1.9-.3L7.5 14.5l-1.6-1.1-1.9.3-.9-1.7-1.7-.9.3-1.9L.6 7.5l1.1-1.6-.3-1.9 1.7-.9.9-1.7 1.9.3L7.5.5z" fill="#fff" />
          <path d="M4.5 7.6l2 2 4-4" stroke={C.lineGreen} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>
      <button style={{ ...btnReset, opacity: 0.55 }} aria-label="call" type="button">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 4h3l2 5-2.5 1.5a11 11 0 005 5L14 13l5 2v3a2 2 0 01-2 2A14 14 0 013 6a2 2 0 012-2z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </button>
      <button style={{ ...btnReset, opacity: 0.55 }} aria-label="video" type="button">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2.5" y="6.5" width="13" height="11" rx="2" stroke="#fff" strokeWidth="1.8" />
          <path d="M15.5 10.5L21 7v10l-5.5-3.5v-3z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </button>
      <button style={{ ...btnReset, opacity: 0.55 }} aria-label="menu" type="button">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3 6h14M3 10h14M3 14h14" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function Stars({ filled = 4, total = 5 }) {
  return (
    <div style={{ display: 'flex', gap: 2 }} aria-label={`${filled} out of ${total} stars`}>
      {Array.from({ length: total }).map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 1.5l2.7 5.5 6.1.9-4.4 4.3 1 6L10 15.4l-5.4 2.8 1-6L1.2 7.9l6.1-.9L10 1.5z"
            fill={i < filled ? '#f5b842' : '#d9d9de'} />
        </svg>
      ))}
    </div>
  );
}

function CopyIcon({ color }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ marginRight: 1 }} aria-hidden="true">
      <rect x="4.5" y="4.5" width="9" height="10" rx="1.5" stroke={color} strokeWidth="1.4" />
      <path d="M2.5 11V3a1.5 1.5 0 011.5-1.5h7" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function OpenIcon({ color }) {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ marginRight: 2 }} aria-hidden="true">
      <path d="M9 2.5h4.5V7" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 3L7.5 8.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 9.5V12a1.5 1.5 0 01-1.5 1.5H4A1.5 1.5 0 012.5 12V5.5A1.5 1.5 0 014 4h2.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function EditIcon({ color }) {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ marginRight: 2 }} aria-hidden="true">
      <path d="M2.5 13.5l3-.7 8-8a1.6 1.6 0 00-2.3-2.3l-8 8-.7 3z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M9.5 4l2.5 2.5" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}

function FlexCard({ onCopy }) {
  const [pressed, setPressed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setPressed(true);
    setTimeout(() => setPressed(false), 180);
    setCopied(true);
    onCopy();
    setTimeout(() => setCopied(false), 1500);
    try { navigator.clipboard?.writeText(thaiReply); } catch { /* ignore */ }
  };

  return (
    <div style={{
      width: 310, background: '#fff', borderRadius: 16,
      border: '1px solid rgba(0,0,0,0.06)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 6px 14px rgba(20,30,40,0.06)',
      overflow: 'hidden', fontFamily: 'Inter',
    }}>
      <div style={{ height: 4, background: C.ochre }} />
      <div style={{ padding: 16 }}>
        <div style={{
          fontFamily: monoFont, fontWeight: 600, fontSize: 9.5,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: C.ochre, lineHeight: 1.2,
        }}>NEW REVIEW · LILIT BANG LAMPHU</div>
        <div style={{ height: 6 }} />
        <Stars filled={4} />
        <div style={{ height: 8 }} />
        <div style={{ fontWeight: 600, fontSize: 15, color: C.ink, letterSpacing: -0.1 }}>Olga K.</div>
      </div>
      <div style={{ margin: '0 16px', borderTop: `1px solid ${C.draft}` }} />
      <div style={{ padding: 16 }}>
        <p style={{
          margin: 0, fontStyle: 'italic',
          fontSize: 13.5, lineHeight: 1.55,
          color: 'rgba(29,36,44,0.78)',
        }}>
          &quot;Lovely small hotel, location perfect for Old Town. Only minor
          issues — luggage hallway has no lock, floor 1 keycard needed at
          odd hours.&quot;
        </p>
      </div>
      <div style={{
        background: C.draft,
        borderTop: '1px solid rgba(192,138,62,0.18)',
        padding: 16,
      }}>
        <div style={{
          fontFamily: monoFont, fontWeight: 600, fontSize: 9.5,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: C.ochre, lineHeight: 1.2,
        }}>AI DRAFT · TH</div>
        <div style={{ height: 8 }} />
        <p style={{
          margin: 0, fontFamily: thaiFont,
          fontSize: 13.5, lineHeight: 1.7, color: C.ink,
        }}>{thaiReply}</p>
      </div>
      {/* Action buttons. Honest about LINE Flex schema limits — LINE
          doesn't support clipboard actions in Flex cards (would require
          LIFF webview). So the marketing mockup mirrors the REAL
          production card: 'Reply on Google' (primary, opens GBP reviews
          dashboard with the right authuser hint) + 'Edit' (deep-link to
          ReviewHub dashboard for tweaking before paste). Two buttons,
          not three. */}
      <div style={{
        borderTop: '1px solid rgba(0,0,0,0.06)',
        padding: 12,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
      }}>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Open Google to reply"
          style={{
            ...flexBtn,
            background: C.teal,
            color: '#fff',
            border: `1px solid ${C.teal}`,
            transform: pressed ? 'scale(0.96)' : 'scale(1)',
            transition: 'transform .15s ease, background .2s ease',
          }}
        >
          <OpenIcon color="#fff" />Reply on Google
        </button>
        <button type="button" style={{ ...flexBtn, background: 'transparent', color: C.teal, border: `1px solid ${C.teal}` }}>
          <EditIcon color={C.teal} />Edit
        </button>
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: C.teal, color: '#fff',
      display: 'grid', placeItems: 'center',
      fontFamily: 'Inter', fontWeight: 700, fontSize: 14,
      flexShrink: 0,
    }} aria-hidden="true">R</div>
  );
}

function TypingBubble() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, paddingLeft: 12, marginTop: 4 }}>
      <Avatar />
      <div style={{
        background: '#fff', borderRadius: '4px 16px 16px 16px',
        padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 4,
        boxShadow: '0 1px 1px rgba(0,0,0,0.04)', height: 32,
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#b4b8c0',
            animation: `lfc-tdot 1.1s ${i * 0.15}s infinite ease-in-out`,
          }} />
        ))}
      </div>
    </div>
  );
}

function Toast({ show }) {
  return (
    <div style={{
      position: 'absolute', top: 80, left: 0, right: 0,
      display: 'flex', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 50,
    }} aria-live="polite">
      <div style={{
        background: 'rgba(22,61,74,0.95)', color: '#fff',
        fontFamily: 'Inter', fontSize: 13, fontWeight: 500,
        padding: '10px 16px', borderRadius: 999,
        display: 'flex', alignItems: 'center', gap: 8,
        boxShadow: '0 8px 24px rgba(20,30,40,0.25)',
        transform: show ? 'translateY(0)' : 'translateY(-30px)',
        opacity: show ? 1 : 0,
        transition: 'transform .35s cubic-bezier(.2,.7,.2,1), opacity .25s ease',
        backdropFilter: 'blur(10px)',
      }}>
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="#06C755" />
          <path d="M4.5 8.2l2.3 2.3 4.7-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        Opens Google · paste reply
      </div>
    </div>
  );
}

function Phone({ children, mounted }) {
  const W = 390, H = 844;
  return (
    <div style={{
      width: W + 16, height: H + 16,
      borderRadius: 60,
      background: 'linear-gradient(160deg, #f5f5f7 0%, #e7e7ec 100%)',
      padding: 8,
      boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(0,0,0,0.08), 0 30px 60px -10px rgba(20,30,40,0.22), 0 60px 100px -20px rgba(20,30,40,0.18)',
      position: 'relative',
      opacity: mounted ? 1 : 0,
      transform: mounted ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.985)',
      transition: 'opacity .55s ease, transform .55s cubic-bezier(.2,.7,.2,1)',
    }}>
      <div style={{
        width: W, height: H, borderRadius: 52,
        overflow: 'hidden', background: '#fff', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 154, height: 30, background: '#000',
          borderRadius: '0 0 22px 22px', zIndex: 5,
        }} />
        {children}
      </div>
    </div>
  );
}

function IconCircle({ children }) {
  return (
    <div style={{
      width: 24, height: 24, display: 'grid', placeItems: 'center',
      color: '#8a93a0',
    }}>{children}</div>
  );
}
const ic = { stroke: '#8a93a0', strokeWidth: 1.7, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
function PlusIcon() { return (<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" {...ic} /><path d="M12 8v8M8 12h8" {...ic} /></svg>); }
function CamIcon() { return (<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5h3l1.5-2h7L17 8.5h3v9.5H4z" {...ic} /><circle cx="12" cy="13.5" r="3" {...ic} /></svg>); }
function PhotoIcon() { return (<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2" {...ic} /><circle cx="9" cy="10" r="1.5" {...ic} /><path d="M4 17l5-5 4 4 3-3 4 4" {...ic} /></svg>); }
function SmileIcon() { return (<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" {...ic} /><circle cx="9" cy="10.5" r=".8" fill="#8a93a0" /><circle cx="15" cy="10.5" r=".8" fill="#8a93a0" /><path d="M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8" {...ic} /></svg>); }
function MicIcon() { return (<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="9.5" y="3.5" width="5" height="11" rx="2.5" {...ic} /><path d="M6.5 12.5a5.5 5.5 0 0011 0M12 18.5v3" {...ic} /></svg>); }

export default function LineFlexCardMockup() {
  const [mounted, setMounted] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    const t0 = setTimeout(() => setMounted(true), 60);
    const t1 = setTimeout(() => setShowTyping(true), 700);
    const t2 = setTimeout(() => { setShowTyping(false); setShowCard(true); }, 2700);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const handleCopy = () => {
    setToast(true);
    setTimeout(() => setToast(false), 1500);
  };

  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: '24px 16px' }}>
      {/* keyframes scoped via uncommon prefix so they can't collide with app-wide animations */}
      <style>{`
        @keyframes lfc-tdot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
      <Phone mounted={mounted}>
        <StatusBar />
        <LineTitleBar animate={mounted} />
        <div style={{
          background: C.chatBg,
          height: 844 - 44 - 56 - 56,
          padding: '16px 0 20px',
          overflow: 'hidden', position: 'relative',
        }}>
          <Toast show={toast} />
          <div style={{
            display: 'flex', justifyContent: 'center', marginBottom: 14,
            opacity: mounted ? 1 : 0, transition: 'opacity .4s ease .3s',
          }}>
            <div style={{
              background: 'rgba(120,130,145,0.35)', color: '#fff',
              fontFamily: 'Inter', fontSize: 11, fontWeight: 500,
              padding: '3px 10px', borderRadius: 999, letterSpacing: 0.2,
            }}>Today</div>
          </div>
          <div style={{ position: 'relative', minHeight: 460 }}>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 6,
              paddingLeft: 12, paddingRight: 50,
              transform: showCard ? 'translateY(0)' : 'translateY(16px)',
              opacity: showCard ? 1 : 0,
              transition: 'transform .5s cubic-bezier(.2,.7,.2,1), opacity .4s ease',
            }}>
              <Avatar />
              <div>
                <FlexCard onCopy={handleCopy} />
                <div style={{
                  fontFamily: 'Inter', fontSize: 10.5,
                  color: 'rgba(29,36,44,0.45)',
                  marginTop: 4, marginLeft: 4,
                }}>09:42</div>
              </div>
            </div>
            {showTyping && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                opacity: 1,
              }}>
                <TypingBubble />
              </div>
            )}
          </div>
        </div>
        <div style={{
          height: 56, background: '#fff',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 12px',
        }}>
          <IconCircle><PlusIcon /></IconCircle>
          <IconCircle><CamIcon /></IconCircle>
          <IconCircle><PhotoIcon /></IconCircle>
          <div style={{
            flex: 1, height: 34, borderRadius: 17,
            background: '#F4F5F8',
            border: '1px solid rgba(0,0,0,0.05)',
            display: 'flex', alignItems: 'center',
            padding: '0 12px',
            fontFamily: 'Inter', fontSize: 13, color: 'rgba(29,36,44,0.4)',
          }}>Aa</div>
          <IconCircle><SmileIcon /></IconCircle>
          <IconCircle><MicIcon /></IconCircle>
        </div>
        <div style={{
          position: 'absolute', bottom: 8, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <div style={{ width: 134, height: 5, borderRadius: 100, background: 'rgba(0,0,0,0.25)' }} />
        </div>
      </Phone>
    </div>
  );
}
