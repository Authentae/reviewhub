// Shared mocks, brand tokens, and atoms used by all four dashboards.
// All four scripts run in global scope under Babel — keep names UNIQUE.

const RH = {
  paper:  '#fbf8f1',
  paper2: '#f3eddd', // a touch warmer for nested surfaces
  ink:    '#1d242c',
  ink2:   '#4a525a',
  ink3:   '#8b939c',
  rule:   '#e8e3d6',
  ruleS:  '#efeadb',
  teal:   '#1e4d5e',
  tealT:  'rgba(30, 77, 94, 0.06)',
  tealM:  'rgba(30, 77, 94, 0.14)',
  rose:   '#c2566c',
  roseD:  '#9b3a52',
  roseT:  'rgba(194, 86, 108, 0.06)',
  roseM:  'rgba(194, 86, 108, 0.14)',
  sage:   '#6b8e7a',
  sageT:  'rgba(107, 142, 122, 0.08)',
  amber:  '#a07d20',
  amberM: 'rgba(212, 168, 67, 0.18)',
  white:  '#ffffff',
};

const SERIF = '"Source Serif Pro", "Source Serif 4", Georgia, serif';
const SANS  = 'Inter, ui-sans-serif, system-ui, sans-serif';
const MONO  = '"JetBrains Mono", ui-monospace, "SFMono-Regular", monospace';

const RH_REVIEWS = [
  {
    id: 2, name: 'Mark T.', rating: 2, platform: 'google',
    text: 'Waited 45 minutes for our mains. Server seemed overwhelmed. Food was fine when it finally came but the wait killed the night.',
    posted: '5 hours ago', sentiment: 'negative', responded: false, flagged: true,
    sla: '18h 42m to reply',
    suggested: 'Apologise for the wait, name the staffing fix, invite them back with a complimentary appetiser.',
  },
  {
    id: 5, name: 'Anonymous', rating: 1, platform: 'yelp',
    text: 'Found a hair in my food. Manager apologized and comped the dish but the experience was ruined.',
    posted: '6 days ago', sentiment: 'negative', responded: false, flagged: true,
    sla: 'Overdue · 4d ago',
    suggested: 'Lead with accountability. Mention the kitchen review you ran. Offer a private follow-up.',
  },
  {
    id: 6, name: 'Daniela R.', rating: 2, platform: 'tripadvisor',
    text: 'Came for our anniversary. Music was deafening, couldn\'t hear each other talk. The food deserved a calmer room.',
    posted: '1 day ago', sentiment: 'negative', responded: false,
    sla: '22h 10m to reply',
    suggested: 'Acknowledge the noise issue, mention the new acoustic panels going in next month.',
  },
  {
    id: 1, name: 'Sarah Mitchell', rating: 5, platform: 'google',
    text: 'Absolutely loved the truffle pasta — best meal in Bangkok this year. Service was warm without being intrusive. Will be back next month with friends.',
    posted: '2 days ago', sentiment: 'positive', responded: true, pinned: true,
    reply: 'Thank you so much, Sarah! The truffle pasta is a chef favourite. We can\'t wait to welcome you back — let us know when you\'re returning and we\'ll save your favourite table.',
  },
  {
    id: 3, name: 'Priya K.', rating: 5, platform: 'tripadvisor',
    text: 'Hidden gem near Asok BTS. The som tum was perfectly balanced. Took our visiting parents — they couldn\'t stop talking about it.',
    posted: '1 day ago', sentiment: 'positive', responded: true,
    reply: 'Khob khun ka, Priya! So glad your parents enjoyed the som tum — please bring them back any time, the chef would love to cook for them again.',
  },
  {
    id: 4, name: 'Lukas H.', rating: 4, platform: 'facebook',
    text: 'Solid evening. Cocktails were creative, mains were good but not amazing. Would recommend for date night, prices fair for the area.',
    posted: '3 days ago', sentiment: 'positive', responded: false,
  },
  {
    id: 7, name: 'Tomás A.', rating: 3, platform: 'google',
    text: 'Decent for the price but nothing memorable. The bread basket was the highlight, which says something.',
    posted: '4 days ago', sentiment: 'neutral', responded: false,
  },
];

const RH_STATS = {
  total: 247, avg_rating: 4.3, positive: 198, responded: 189,
  unresponded_negative: 3, this_week: 18,
  r5: 142, r4: 56, r3: 28, r2: 13, r1: 8,
};

const RH_PLATFORMS = {
  google:      { label: 'Google',      count: 156, dot: '#4285f4' },
  tripadvisor: { label: 'TripAdvisor', count: 42,  dot: '#34a853' },
  facebook:    { label: 'Facebook',    count: 28,  dot: '#7e57c2' },
  yelp:        { label: 'Yelp',        count: 21,  dot: '#c2566c' },
};

// Editorial platform glyph — flat monogram, no emoji.
function PlatformGlyph({ p, size = 14 }) {
  const meta = RH_PLATFORMS[p];
  if (!meta) return null;
  const ch = meta.label[0];
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: 3,
        background: meta.dot, color: '#fff',
        fontFamily: MONO, fontSize: size * 0.62, fontWeight: 700,
        lineHeight: 1, letterSpacing: 0,
      }}
    >{ch}</span>
  );
}

// Star row, hairline weight.
function Stars({ n, size = 12, dim = RH.rule, on = RH.ink }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1, lineHeight: 1, fontSize: size, letterSpacing: 0 }} aria-label={`${n} of 5`}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= n ? on : dim }}>★</span>
      ))}
    </span>
  );
}

// Mono eyebrow label.
function Eyebrow({ children, color = RH.ink3, style = {} }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em',
      textTransform: 'uppercase', color, ...style,
    }}>{children}</span>
  );
}

// Hairline rule.
function Rule({ color = RH.rule, style = {} }) {
  return <div style={{ height: 1, background: color, ...style }} />;
}

// Tiny avatar, brand teal.
function Avatar({ name, size = 32, bg = RH.teal }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: SANS, fontWeight: 600, fontSize: size * 0.42,
      flexShrink: 0,
    }}>{(name || '?').charAt(0).toUpperCase()}</div>
  );
}

// Sparkline for tiny trend visuals.
function Sparkline({ points, w = 80, h = 22, color = RH.teal }) {
  const max = Math.max(...points), min = Math.min(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${(i*step).toFixed(1)},${(h - ((v - min)/span)*h).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Editorial drop-cap rating glyph used by Direction B.
function RatingGlyph({ n, sentiment }) {
  const fg = sentiment === 'negative' ? RH.rose : sentiment === 'positive' ? RH.sage : RH.ink3;
  return (
    <div style={{
      width: 44, height: 56, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      borderRight: `1px solid ${RH.rule}`,
      paddingRight: 12, marginRight: 14,
    }}>
      <div style={{ fontFamily: SERIF, fontSize: 34, lineHeight: 1, fontWeight: 600, color: fg }}>{n}</div>
      <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.18em', color: RH.ink3, marginTop: 4 }}>STAR</div>
    </div>
  );
}

Object.assign(window, {
  RH, SERIF, SANS, MONO,
  RH_REVIEWS, RH_STATS, RH_PLATFORMS,
  PlatformGlyph, Stars, Eyebrow, Rule, Avatar, Sparkline, RatingGlyph,
});
