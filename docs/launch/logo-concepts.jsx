// logo.jsx — 5 ReviewHub logo concepts
// Each renders at the requested size; same path works at 16×16 (favicon) and 128×128.

const LOGO_GRADIENT_ID = 'rh-grad';

function LogoGradientDefs({ id = LOGO_GRADIENT_ID, from = '#1e4d5e', to = '#2c7889' }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={from} />
        <stop offset="1" stopColor={to} />
      </linearGradient>
    </defs>
  );
}

// Concept A — Star + sparkle corner (classic review + AI)
function LogoStarSpark({ size = 128, mono = false }) {
  const fill = mono ? '#1d242c' : `url(#${LOGO_GRADIENT_ID}-a)`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      {!mono && <LogoGradientDefs id={`${LOGO_GRADIENT_ID}-a`} />}
      <rect x="0" y="0" width="64" height="64" rx="14" fill={fill} />
      <path d="M30 18l4 9 10 1-7.5 6.5 2.2 9.5L30 39l-8.7 5 2.2-9.5L16 28l10-1 4-9z"
            fill="#fbf8f1" />
      <circle cx="47" cy="18" r="3.2" fill="#fbf8f1" />
      <circle cx="47" cy="18" r="1.4" fill={fill} />
    </svg>
  );
}

// Concept B — Chat bubble wrapping a star (reply = review)
function LogoBubbleStar({ size = 128, mono = false }) {
  const fill = mono ? '#1d242c' : `url(#${LOGO_GRADIENT_ID}-b)`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      {!mono && <LogoGradientDefs id={`${LOGO_GRADIENT_ID}-b`} />}
      <rect x="0" y="0" width="64" height="64" rx="14" fill={fill} />
      <path d="M14 20c0-4 3-7 7-7h22c4 0 7 3 7 7v14c0 4-3 7-7 7H30l-8 7v-7h-1c-4 0-7-3-7-7V20z"
            fill="#fbf8f1" />
      <path d="M32 19l2.5 5.5L40 25l-4 3.3 1.2 5.7L32 31l-5.2 3 1.2-5.7-4-3.3 5.5-0.5L32 19z"
            fill={fill} />
    </svg>
  );
}

// Concept C — Sparkle-only, geometric four-point (AI-forward, minimal)
function LogoSparkle({ size = 128, mono = false }) {
  const fill = mono ? '#1d242c' : `url(#${LOGO_GRADIENT_ID}-c)`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      {!mono && <LogoGradientDefs id={`${LOGO_GRADIENT_ID}-c`} />}
      <rect x="0" y="0" width="64" height="64" rx="14" fill={fill} />
      <path d="M32 10c1.5 10 4 12.5 14 14-10 1.5-12.5 4-14 14-1.5-10-4-12.5-14-14 10-1.5 12.5-4 14-14z"
            fill="#fbf8f1" />
      <path d="M48 40c.7 4 1.6 4.9 5.5 5.5-3.9.6-4.8 1.5-5.5 5.5-.6-4-1.5-4.9-5.5-5.5 4-.6 4.9-1.5 5.5-5.5z"
            fill="#fbf8f1" opacity="0.95" />
    </svg>
  );
}

// Concept D — "RH" monogram with sparkle crown (wordmark flex)
function LogoMonogram({ size = 128, mono = false }) {
  const fill = mono ? '#1d242c' : `url(#${LOGO_GRADIENT_ID}-d)`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      {!mono && <LogoGradientDefs id={`${LOGO_GRADIENT_ID}-d`} />}
      <rect x="0" y="0" width="64" height="64" rx="14" fill={fill} />
      <text x="32" y="44" textAnchor="middle"
            fontFamily="Newsreader, Georgia, serif"
            fontSize="28" fontWeight="600" fill="#fbf8f1"
            letterSpacing="-1.2">RH</text>
      <path d="M50 15l1.6 3.6 3.4.5-2.7 2.2.8 3.7-3.1-2-3.1 2 .8-3.7-2.7-2.2 3.4-.5L50 15z"
            fill="#fbf8f1" />
    </svg>
  );
}

// Concept E — Bubble with pulse / reply arc (motion-forward)
function LogoReplyArc({ size = 128, mono = false }) {
  const fill = mono ? '#1d242c' : `url(#${LOGO_GRADIENT_ID}-e)`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      {!mono && <LogoGradientDefs id={`${LOGO_GRADIENT_ID}-e`} />}
      <rect x="0" y="0" width="64" height="64" rx="14" fill={fill} />
      {/* outer sparkle ring */}
      <path d="M32 11l1.6 6.6c.3 1.1 1.2 2 2.3 2.3L42.5 22l-6.6 1.6c-1.1.3-2 1.2-2.3 2.3L32 32l-1.6-6.1c-.3-1.1-1.2-2-2.3-2.3L22 22l6.1-1.6c1.1-.3 2-1.2 2.3-2.3L32 11z"
            fill="#fbf8f1" />
      {/* reply-arc below */}
      <path d="M16 42c4 8 12 12 20 10 6-1.5 11-6 13-12" stroke="#fbf8f1" strokeWidth="3"
            fill="none" strokeLinecap="round" />
      <path d="M45 36l5 4-1 6" stroke="#fbf8f1" strokeWidth="3" fill="none"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const LOGO_CONCEPTS = [
  { id: 'a', name: 'Star + Spark',  description: 'Classic 5-point review star with an AI sparkle corner — instant legibility.', Component: LogoStarSpark },
  { id: 'b', name: 'Bubble + Star', description: 'Reply bubble frames a review star. Conveys "reply to reviews" directly.', Component: LogoBubbleStar },
  { id: 'c', name: 'AI Sparkle',    description: 'Pure 4-point sparkle pair. Most AI-forward, least review-specific.', Component: LogoSparkle },
  { id: 'd', name: 'RH Monogram',   description: 'Bold wordmark-ready "RH" with sparkle flourish. Best in type-heavy contexts.', Component: LogoMonogram },
  { id: 'e', name: 'Reply Arc',     description: 'Sparkle + hooked reply arrow. Evokes motion — "we send the reply."', Component: LogoReplyArc },
];

Object.assign(window, { LOGO_CONCEPTS, LogoStarSpark, LogoBubbleStar, LogoSparkle, LogoMonogram, LogoReplyArc });
