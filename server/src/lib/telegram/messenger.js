// Telegram Bot API client — owner-side notification channel.
//
// Parallels lib/line/messenger.js. The Telegram Bot API is simpler than
// LINE Messaging API: HTTP POST with bot token + chat_id + text, no flex
// schema, no webhook signing complexity (we validate via secret_token
// header instead). Bot tokens are obtained from @BotFather in Telegram.
//
// Activation:
//  - TELEGRAM_BOT_TOKEN env var must be set
//  - TELEGRAM_BOT_ENABLED='true' (default false → all sends no-op)
//
// Why the bool flag separate from the token: some env presets carry the
// token across deployments but we want explicit per-environment opt-in.
// Same pattern as LINE_OA_ENABLED.

const PUSH_URL = (token) => `https://api.telegram.org/bot${token}/sendMessage`;

function isEnabled() {
  return process.env.TELEGRAM_BOT_ENABLED === 'true' &&
         !!process.env.TELEGRAM_BOT_TOKEN;
}

/**
 * Send a plain-text message to a Telegram chat. Telegram chat_id is per
 * bot, stable across the user's interactions with that specific bot.
 *
 * @param {string|number} chatId
 * @param {string} text — message body (up to 4096 chars)
 * @returns {Promise<{ ok: boolean, skipped?: boolean, error?: string }>}
 */
async function pushText(chatId, text) {
  if (!isEnabled()) return { ok: true, skipped: true };
  if (!chatId || !text) return { ok: false, error: 'chatId and text required' };
  try {
    const res = await module.exports._fetch(PUSH_URL(process.env.TELEGRAM_BOT_TOKEN), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: String(text).slice(0, 4096),
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '(no body)');
      return { ok: false, status: res.status, error: body.slice(0, 500) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

/**
 * Send a message with an inline keyboard (buttons). Used for the
 * "Reply on Google" / "Open dashboard" CTA pair on review notifications.
 *
 * @param {string|number} chatId
 * @param {string} text
 * @param {Array<Array<{ text: string, url: string }>>} buttons — rows of buttons
 */
async function pushWithButtons(chatId, text, buttons) {
  if (!isEnabled()) return { ok: true, skipped: true };
  if (!chatId || !text) return { ok: false, error: 'chatId and text required' };
  try {
    const res = await module.exports._fetch(PUSH_URL(process.env.TELEGRAM_BOT_TOKEN), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: String(text).slice(0, 4096),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: buttons || [] },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '(no body)');
      return { ok: false, status: res.status, error: body.slice(0, 500) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

/**
 * Build a notification message for a new review. Returns { text, buttons }
 * ready to pass to pushWithButtons. HTML parse_mode supports basic <b>,
 * <i>, <u>, <code>, <pre>, and emoji.
 *
 * Mirrors the LINE Flex card content shape so cross-channel notifications
 * converge on one editorial voice.
 */
function buildReviewNotification({
  businessName,
  reviewerName,
  rating,
  reviewText,
  reviewDate,
  draftText,
  draftLanguage,
  replyOnGoogleUrl,
  editUrl,
}) {
  // HTML escape for Telegram parse_mode=HTML
  const esc = (s) => String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const r = Math.max(0, Math.min(5, rating || 0));
  const stars = '⭐'.repeat(r);
  const langTag = (draftLanguage || '').toUpperCase().slice(0, 4);
  const draftHeader = langTag ? `AI DRAFT · ${langTag}` : 'AI DRAFT';

  // Rating-tier badge — instant visual signal at the top of the message.
  // 1-2★ = red/urgent (owner must reply same day), 3★ = yellow/neutral
  // (read carefully, often the most actionable feedback), 4-5★ = green/
  // positive (easy thank-you). Mirrors the LINE Flex card's rating-tint
  // header so cross-channel notifications feel like the same product.
  let tierBadge = '🟢';
  let tierLabel = 'POSITIVE';
  if (r <= 2) { tierBadge = '🔴'; tierLabel = 'ATTENTION'; }
  else if (r === 3) { tierBadge = '🟡'; tierLabel = 'NEUTRAL'; }

  // Date hint — same recency labels as the LINE Flex card
  let dateLabel = '';
  if (reviewDate) {
    const t = new Date(reviewDate);
    if (!isNaN(t.getTime())) {
      const diffMin = Math.floor((Date.now() - t) / 60000);
      if (diffMin < 1) dateLabel = 'just now';
      else if (diffMin < 60) dateLabel = `${diffMin}m ago`;
      else if (diffMin < 1440) dateLabel = `${Math.floor(diffMin / 60)}h ago`;
      else if (diffMin < 1440 * 7) dateLabel = `${Math.floor(diffMin / 1440)}d ago`;
      else dateLabel = t.toISOString().slice(0, 10);
    }
  }

  // Message body — Telegram HTML mode supports <b>, <i>, <code>,
  // <pre>, <blockquote>, <a>, emoji. Use blockquote for the review
  // text so it visually separates from the meta line, and emoji
  // section markers (📍 location, 🕐 time, 💬 review) so a glancing
  // owner can pick out the structure even without reading.
  //
  // The AI draft is intentionally NOT inlined here — it ships as a
  // follow-up `draftCopyMessage` wrapped in <code> so the Telegram
  // mobile tap-and-hold "Copy" captures exactly the draft, no
  // header noise. Pasting in Google's reply box needs zero cleanup.
  const businessLine = businessName ? `📍 <b>${esc(String(businessName).slice(0, 60))}</b>` : '';
  const metaLine = dateLabel ? `🕐 <i>${esc(dateLabel)}</i>` : '';
  const reviewBody = (reviewText || '').slice(0, 700).trim();

  const parts = [
    `${tierBadge} <b>${tierLabel}</b> · ${stars}  <code>${r}/5</code>`,
  ];
  if (businessLine || metaLine) {
    parts.push([businessLine, metaLine].filter(Boolean).join('   '));
  }
  parts.push('');
  parts.push(`💬 <b>${esc(reviewerName || 'Anonymous')}</b>`);
  if (reviewBody) {
    parts.push(`<blockquote>${esc(reviewBody)}</blockquote>`);
  }
  if (draftText) {
    parts.push('');
    parts.push(`✨ <i>${esc(draftHeader)} — copy the block below ↓</i>`);
  }

  const text = parts.join('\n');

  // Inline keyboard — Telegram-equivalent of the LINE Flex card footer.
  // Two actions: Reply on Google (primary, takes user straight to the
  // Google review box) + Edit in dashboard (for richer edit + post via
  // ReviewHub). Emoji prefix gives each button instant glanceable intent.
  const buttons = [];
  if (replyOnGoogleUrl) {
    buttons.push([{ text: '💬 Reply on Google', url: replyOnGoogleUrl }]);
  }
  if (editUrl) {
    buttons.push([{ text: '✏️ Edit in dashboard', url: editUrl }]);
  }

  // Second message containing ONLY the draft, wrapped in <code> so the
  // Telegram client renders a monospace block with tap-to-copy. Empty
  // when there's no draft (poller still pushed the new-review alert).
  const draftCopyMessage = draftText
    ? `<code>${esc(draftText.slice(0, 3500))}</code>`
    : null;

  return { text, buttons, draftCopyMessage };
}

module.exports = {
  isEnabled,
  pushText,
  pushWithButtons,
  buildReviewNotification,
  // exported for tests
  _fetch: (url, opts) => fetch(url, opts),
};
