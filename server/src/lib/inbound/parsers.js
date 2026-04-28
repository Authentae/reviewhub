// Inbound email parsers — extract review fields from forwarded notification emails.
//
// When a review platform (Booking.com, Wongnai, etc.) emails the business owner
// "you got a new review", and the owner forwards that email to their
// reviews+<secret>@reviewhub.review alias, this module parses the original
// content into { platform, reviewer_name, rating, review_text, external_id }.
//
// Each parser is best-effort. If a specific field can't be extracted, return
// null/empty for that field — the caller falls back to generic defaults so a
// review still lands on the dashboard even with imperfect parsing. Worst case:
// the user sees the raw email body as the review text.
//
// Forwarded-email envelope: most users use Gmail's Forward feature, which
// keeps the original message body but adds "---------- Forwarded message ---------"
// and a new From: header (the user's own email). We strip the forward header
// before parsing.

// Detect platform from the original sender's domain. The forwarded email's
// outermost "From:" is the user (because they forwarded), so we look at the
// "X-Original-Sender", "Reply-To", or the ---Forwarded message--- block's
// embedded "From:" header for the actual platform sender.
const SENDER_DOMAIN_TO_PLATFORM = {
  'booking.com':           'booking',
  'agoda.com':             'agoda',
  'agoda-reviews.com':     'agoda',
  'traveloka.com':         'traveloka',
  'airbnb.com':            'airbnb',
  'expedia.com':           'expedia',
  'hotels.com':            'hotels',
  'klook.com':             'klook',
  'trip.com':              'tripcom',
  'tripadvisor.com':       'tripadvisor',
  'tripadvisorsupport.com':'tripadvisor',
  'trustpilot.com':        'trustpilot',
  'wongnai.com':           'wongnai',
  'tabelog.com':           'tabelog',
  'retty.me':              'retty',
  'hotpepper.jp':          'hotpepper',
  'gnavi.co.jp':           'gurunavi',
  'naver.com':             'naver',
  'kakaocorp.com':         'kakaomap',
  'dianping.com':          'dianping',
  'meituan.com':           'meituan',
  'yelp.com':              'yelp',
  'facebookmail.com':      'facebook',
  'google.com':            'google',
  'mybusiness.googleapis.com': 'google',
  'reclameaqui.com.br':    'reclameaqui',
  'thefork.com':           'thefork',
  'lafourchette.com':      'thefork',
  'shopee.com':            'shopee',
  'shopee.co.th':          'shopee',
  'lazada.com':            'lazada',
  'grab.com':              'grabfood',
  'foodpanda.com':         'foodpanda',
};

function platformFromSender(senderEmail) {
  const m = String(senderEmail || '').toLowerCase().match(/@([^>\s]+)/);
  if (!m) return null;
  const domain = m[1];
  // Try exact match, then progressive subdomain stripping.
  if (SENDER_DOMAIN_TO_PLATFORM[domain]) return SENDER_DOMAIN_TO_PLATFORM[domain];
  for (const key of Object.keys(SENDER_DOMAIN_TO_PLATFORM)) {
    if (domain.endsWith('.' + key) || domain === key) return SENDER_DOMAIN_TO_PLATFORM[key];
  }
  return null;
}

// Strip Gmail/Outlook forward boilerplate so parsers operate on the original message body.
function stripForwardWrapper(body) {
  if (!body) return '';
  const markers = [
    /-{3,}\s*Forwarded message\s*-{3,}/i,
    /Begin forwarded message:/i,
    /---{0,3}\s*Original Message\s*---{0,3}/i,
  ];
  for (const re of markers) {
    const m = body.match(re);
    if (m) return body.slice(m.index + m[0].length);
  }
  return body;
}

// Pull the original sender's address out of forwarded email headers.
// Tries (in order): X-Original-Sender, Reply-To, "From:" inside the
// forwarded-message block.
function originalSender({ headers, body }) {
  if (headers && typeof headers === 'object') {
    if (headers['X-Original-Sender']) return headers['X-Original-Sender'];
    if (headers['Reply-To']) return headers['Reply-To'];
  }
  if (body) {
    const stripped = stripForwardWrapper(body);
    const fromMatch = stripped.match(/^From:\s*(.+)$/im);
    if (fromMatch) return fromMatch[1].trim();
  }
  return null;
}

// Extract a star rating from common "X out of 5" / "X stars" / "X/10" phrasings.
function extractRating(text) {
  if (!text) return null;
  // 1) "5/5" or "9/10" — explicit fraction
  const frac = text.match(/(\d+(?:\.\d+)?)\s*(?:\/|out of)\s*(\d+)/i);
  if (frac) {
    const num = parseFloat(frac[1]);
    const denom = parseInt(frac[2], 10);
    if (denom === 5) return Math.max(1, Math.min(5, Math.round(num)));
    if (denom === 10) return Math.max(1, Math.min(5, Math.round(num / 2)));
  }
  // 2) "★★★★☆" — count filled stars
  const stars = (text.match(/[★⭐]/g) || []).length;
  const empty = (text.match(/[☆]/g) || []).length;
  if (stars && (stars + empty <= 5)) return Math.min(5, stars);
  // 3) "5-star" / "5 stars"
  const word = text.match(/(\d)\s*[-\s]?\s*star/i);
  if (word) return Math.max(1, Math.min(5, parseInt(word[1], 10)));
  // 4) Booking.com style "Score: 8.4" out of 10
  const score = text.match(/score[:\s]+(\d+(?:\.\d+)?)/i);
  if (score) {
    const v = parseFloat(score[1]);
    if (v <= 10) return Math.max(1, Math.min(5, Math.round(v / 2)));
  }
  return null;
}

// Best-effort reviewer name extractor — looks for "from <Name>", "by <Name>",
// or a line like "Reviewer: <Name>".
function extractReviewerName(text) {
  if (!text) return null;
  const patterns = [
    /Reviewer:\s*(.+)/i,
    /Guest:\s*(.+)/i,
    /from\s+([A-Z][A-Za-zก-๙ぁ-んァ-ヶ一-鿿\s]{1,40})\s+(?:on|wrote|left)/,
    /by\s+([A-Z][A-Za-zก-๙ぁ-んァ-ヶ一-鿿\s]{1,40})\b/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1].trim().replace(/\s+/g, ' ').slice(0, 100);
  }
  return null;
}

// Extract the review body — heuristic: longest paragraph in the message that
// isn't header-y or signature-y.
function extractReviewText(body) {
  if (!body) return '';
  const stripped = stripForwardWrapper(body);
  const lines = stripped.split(/\r?\n/);
  // Drop empty lines, signature lines, link-only lines.
  const candidates = [];
  let buf = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (buf.length) { candidates.push(buf.join(' ')); buf = []; }
      continue;
    }
    if (/^(--|__|=|>)/.test(line)) continue;
    if (/^https?:\/\/\S+\s*$/.test(line)) continue;
    if (/^(?:From|To|Subject|Date|Sent|Reply-To|Cc|Bcc):/i.test(line)) continue;
    buf.push(line);
  }
  if (buf.length) candidates.push(buf.join(' '));
  if (!candidates.length) return '';
  // Pick the longest paragraph but cap at 5000 chars (DB column limit).
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0].slice(0, 5000);
}

// ── Per-platform parsers ────────────────────────────────────────────────────
// Each parser receives { headers, body, subject } and returns
// { platform, reviewer_name, rating, review_text, external_id } — fields it
// can't determine come back as null/empty.

function parseGeneric({ subject, body, platform }) {
  const fullText = [subject, body].filter(Boolean).join('\n');
  return {
    platform: platform || 'manual',
    reviewer_name: extractReviewerName(fullText) || 'Anonymous',
    rating: extractRating(fullText),
    review_text: extractReviewText(body),
    external_id: null,
  };
}

function parseBooking(input) {
  const r = parseGeneric({ ...input, platform: 'booking' });
  // Booking.com emails put the score in the subject: "Booking.com Score: 8.4"
  if (!r.rating && input.subject) {
    const s = extractRating(input.subject);
    if (s) r.rating = s;
  }
  // Booking.com guest name often appears as "Guest review from <Name>".
  // Capture up to end-of-line or punctuation that ends a name phrase.
  const m = (input.body || '').match(/Guest review from\s+([^\n,.\r]+)/i);
  if (m) r.reviewer_name = m[1].trim().slice(0, 100);
  return r;
}

function parseAgoda(input) {
  const r = parseGeneric({ ...input, platform: 'agoda' });
  // Agoda subject pattern: "New review from <Name>" or rating in body.
  const m = (input.subject || '').match(/(?:New review from|Review by)\s+(.+)/i);
  if (m) r.reviewer_name = m[1].trim();
  return r;
}

function parseTraveloka(input) {
  return parseGeneric({ ...input, platform: 'traveloka' });
}

function parseWongnai(input) {
  const r = parseGeneric({ ...input, platform: 'wongnai' });
  // Wongnai emails are mostly Thai. Reviewer usually appears as
  // "คุณ <Name>" or in subject "<Name> รีวิวร้านคุณ"
  const m = (input.body || '').match(/(?:คุณ|จาก)\s+([ก-๙\sA-Za-z]{2,40})/);
  if (m) r.reviewer_name = m[1].trim();
  return r;
}

function parseTabelog(input) {
  return parseGeneric({ ...input, platform: 'tabelog' });
}

function parseTripadvisor(input) {
  const r = parseGeneric({ ...input, platform: 'tripadvisor' });
  // TripAdvisor subject: "<Name> wrote a review of <Property>"
  const m = (input.subject || '').match(/^(.+?)\s+wrote a review/i);
  if (m) r.reviewer_name = m[1].trim();
  return r;
}

function parseTrustpilot(input) {
  return parseGeneric({ ...input, platform: 'trustpilot' });
}

function parseGoogle(input) {
  const r = parseGeneric({ ...input, platform: 'google' });
  // Google My Business: "<Name> reviewed your business"
  const m = (input.subject || '').match(/^(.+?)\s+reviewed/i);
  if (m) r.reviewer_name = m[1].trim();
  return r;
}

function parseYelp(input) {
  return parseGeneric({ ...input, platform: 'yelp' });
}

function parseFacebook(input) {
  return parseGeneric({ ...input, platform: 'facebook' });
}

const PARSERS = {
  booking: parseBooking,
  agoda: parseAgoda,
  traveloka: parseTraveloka,
  wongnai: parseWongnai,
  tabelog: parseTabelog,
  tripadvisor: parseTripadvisor,
  trustpilot: parseTrustpilot,
  google: parseGoogle,
  yelp: parseYelp,
  facebook: parseFacebook,
};

// Dispatch entry point. Detect the platform from the original sender, run the
// matching parser, fall through to generic if no platform-specific parser
// exists for this sender.
function parseInboundEmail({ headers, subject, body }) {
  const sender = originalSender({ headers, body });
  const platform = platformFromSender(sender);
  const input = { headers, subject, body, platform };
  if (platform && PARSERS[platform]) {
    return { ...PARSERS[platform](input), originalSender: sender };
  }
  return { ...parseGeneric(input), originalSender: sender };
}

module.exports = {
  parseInboundEmail,
  platformFromSender,
  originalSender,
  stripForwardWrapper,
  extractRating,
  extractReviewerName,
  extractReviewText,
  // Exported for tests
  PARSERS,
  SENDER_DOMAIN_TO_PLATFORM,
};
