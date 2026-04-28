// Template variable substitution for review response text.
// Supported variables:
//   {reviewer_name}  — reviewer's display name
//   {rating}         — numeric rating (1–5)
//   {platform}       — platform with proper display name (Google, Yelp,
//                      Wongnai, Tabelog (食べログ), Naver Place, …)
//   {business_name}  — business display name
//
// Unknown placeholders are left as-is so a typo (e.g. {Rating}) is visible to
// the user rather than silently swallowed.

// Single source of truth for display labels lives in lib/platforms.js — pull
// from there so {platform} substitution stays in sync with the registry as
// new locale platforms are added.
const { PLATFORM_META } = require('./platforms');
const PLATFORM_DISPLAY = Object.fromEntries(
  Object.entries(PLATFORM_META).map(([id, meta]) => [id, meta.label])
);

function substituteVars(text, review, business) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/\{reviewer_name\}/g, () => review?.reviewer_name ?? '')
    .replace(/\{rating\}/g,        () => review?.rating != null ? String(review.rating) : '')
    .replace(/\{platform\}/g,      () => PLATFORM_DISPLAY[review?.platform] ?? (review?.platform ?? ''))
    .replace(/\{business_name\}/g, () => business?.business_name ?? '');
}

// True if text contains at least one recognised variable placeholder.
function hasVars(text) {
  return /\{(?:reviewer_name|rating|platform|business_name)\}/.test(text);
}

module.exports = { substituteVars, hasVars };
