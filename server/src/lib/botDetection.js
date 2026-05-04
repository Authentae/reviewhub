// Lightweight bot/preview-bot user-agent detection.
//
// Used by the public /audit-preview/:token endpoint to distinguish a
// real human viewer (signal worth notifying the founder about) from a
// link-preview crawler that fires when the URL is pasted in
// Slack/Twitter/iMessage etc. Without this filter every cold email
// would generate 2-3 false-positive "prospect opened your audit"
// notifications the moment the prospect's email client renders the
// URL preview card.
//
// Conservative on purpose: false-positives (real human flagged as bot)
// just mean the founder gets one fewer notification; false-negatives
// (bot flagged as human) mean a noise notification. We bias toward
// missing some notifications rather than false-firing, since founder
// trust in the signal matters more than total notification volume.

// Specific bots that hit URLs for link-preview generation. Listed
// explicitly because their UAs don't always contain the literal
// substring "bot".
const KNOWN_PREVIEW_AGENTS = [
  'Slackbot',
  'Twitterbot',
  'facebookexternalhit',
  'LinkedInBot',
  'WhatsApp',
  'TelegramBot',
  'Discordbot',
  'Applebot',
  'Googlebot',
  'bingbot',
  'DuckDuckBot',
  'YandexBot',
  'Baiduspider',
  'Pinterestbot',
  'redditbot',
  'embedly',
  'iframely',
  'Mastodon',
  'SkypeUriPreview',
];

// Generic patterns matched case-insensitively. The /bot/ family alone
// catches dozens of long-tail crawlers we'd otherwise need to enumerate.
const GENERIC_PATTERNS = /bot|crawl|spider|preview|fetch|scrape|monitoring|uptime|headless/i;

function isLikelyBot(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') {
    // Missing UA on a public HTTP request is itself a strong bot signal —
    // every real browser sends one. Treat as bot.
    return true;
  }
  for (const agent of KNOWN_PREVIEW_AGENTS) {
    if (userAgent.indexOf(agent) !== -1) return true;
  }
  if (GENERIC_PATTERNS.test(userAgent)) return true;
  return false;
}

module.exports = { isLikelyBot };
