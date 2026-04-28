// LINE Messaging API push notification.
//
// Sends a LINE chat message to the SMB owner (or whoever they configure)
// when a new review arrives. Especially useful for the Thai market where
// LINE replaces email for most business communication.
//
// Setup (one-time, by the operator — autopilot can't do this):
//   1. Create a LINE Messaging API channel:
//        https://developers.line.biz/console/
//        → Provider → Channel → Messaging API → Create
//   2. Copy the channel access token (Messaging API tab → Issue token)
//   3. Add this user (or yourself) as a friend of the bot
//        → scan the bot's QR code from the channel basic settings
//   4. Get the recipient's userId from a webhook event (or use the
//        `getProfile` endpoint after a follow event). The userId
//        looks like: U1234567890abcdef1234567890abcdef
//   5. Set Railway env vars:
//        LINE_CHANNEL_ACCESS_TOKEN=...     (from step 2)
//        LINE_OWNER_USER_ID=U...           (from step 4 — owner-only MVP)
//   6. Redeploy.
//
// MVP scope: this module sends to a SINGLE userId set in env. Per-user
// LINE recipient routing is a follow-up — we'd need a `users.line_user_id`
// column populated via the LINE follow webhook. For a solo founder
// monitoring their own business, owner-only is enough at launch.
//
// LINE Messaging API quota on the free tier: 200 push messages/month.
// Plenty for negative-review alerts to a single recipient.

const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';

function isConfigured() {
  return !!(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_OWNER_USER_ID);
}

/**
 * Send a plain-text LINE push to the configured owner.
 * Fire-and-forget; never throws (LINE outages must not block review ingest).
 *
 * @param {string} text - The message body. Max 5000 chars per LINE API.
 * @returns {Promise<void>}
 */
async function sendOwnerPush(text) {
  if (!isConfigured()) return;
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const userId = process.env.LINE_OWNER_USER_ID;
  // LINE caps text messages at 5000 chars. Defensive truncate so a freak
  // long review body can't break the call.
  const safeText = String(text || '').slice(0, 5000);
  if (!safeText) return;

  // 5-second timeout. LINE is usually <500ms; if they're slow we don't
  // want to back up the request that triggered the alert.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  if (typeof timer.unref === 'function') timer.unref();
  try {
    await fetch(LINE_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text: safeText }],
      }),
      signal: ctl.signal,
    });
    // We don't inspect the response. LINE returns 200 on success and
    // various 4xx on bad token/userId. Failure is logged but never
    // surfaced to the caller — alerts are advisory, not load-bearing.
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[LINE] push failed:', err.message);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send a notification about a new review.
 * Formats the message with stars, reviewer name, platform, and a snippet.
 */
async function notifyNewReview(review, businessName) {
  if (!isConfigured()) return;
  const { PLATFORM_META } = require('../platforms');
  const platformLabel = PLATFORM_META[review.platform]?.label || review.platform || '';
  const stars = '★'.repeat(review.rating || 0) + '☆'.repeat(5 - (review.rating || 0));
  // DB column is `review_text`; accept either to stay robust to callers
  // passing a transformed shape.
  const fullText = String(review.review_text ?? review.text ?? '');
  const snippet = fullText.slice(0, 200);
  const lines = [
    `🔔 New review for ${businessName}`,
    `${stars} (${review.rating}/5) — ${review.reviewer_name || 'Anonymous'} on ${platformLabel}`,
    '',
    snippet ? `"${snippet}${fullText.length > 200 ? '…' : ''}"` : '(no text)',
    '',
    'Reply in your dashboard: https://reviewhub.review/dashboard',
  ];
  return sendOwnerPush(lines.join('\n'));
}

module.exports = {
  isConfigured,
  sendOwnerPush,
  notifyNewReview,
};
