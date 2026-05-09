// LINE Messaging API helper.
//
// Wraps the LINE Messaging API push endpoint. Used to send notifications
// when a new review lands (the LINE-pivot core feature, ships June 2026
// per the public commitment in landing + /line page).
//
// Behavior:
// - If LINE_OA_ENABLED env var is not 'true', every send is a no-op
//   (returns { skipped: true }). Lets the code ship to prod safely
//   before LINE OA credentials are configured.
// - If LINE_CHANNEL_ACCESS_TOKEN is missing, also no-ops.
// - On send, hits https://api.line.me/v2/bot/message/push with the
//   correct auth + payload.
// - Errors are caught + returned (no throw) so callers (cron jobs,
//   webhook handlers) can log + continue. Failed sends shouldn't
//   crash the review-fetch loop.
//
// Reference: https://developers.line.biz/en/reference/messaging-api/#send-push-message

const PUSH_URL = 'https://api.line.me/v2/bot/message/push';

function isEnabled() {
  return process.env.LINE_OA_ENABLED === 'true' &&
         !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
}

/**
 * Send a plain text message to a LINE user via the OA bot.
 *
 * @param {string} lineUserId - Opaque LINE userId (33-char "U..." string)
 * @param {string} text - Message body. LINE limits to 5000 chars.
 * @returns {Promise<{ ok: boolean, skipped?: boolean, error?: string, status?: number }>}
 */
async function pushText(lineUserId, text) {
  if (!isEnabled()) {
    return { ok: true, skipped: true };
  }
  if (!lineUserId || !text) {
    return { ok: false, error: 'lineUserId and text required' };
  }
  // LINE caps text at 5000 chars; truncate cleanly to avoid 400.
  const safeText = text.length > 5000 ? text.slice(0, 4997) + '...' : text;
  try {
    const res = await fetch(PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: 'text', text: safeText }],
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
 * Send a Flex Message (rich card) to a LINE user via the OA bot.
 *
 * Flex Messages let us render the review preview + draft reply +
 * approve/edit buttons in a single LINE bubble. Spec:
 * https://developers.line.biz/en/docs/messaging-api/using-flex-messages/
 *
 * @param {string} lineUserId
 * @param {string} altText - Fallback shown in chat list / push preview
 * @param {object} flexContents - LINE Flex Message contents object
 * @returns {Promise<{ ok: boolean, skipped?: boolean, error?: string }>}
 */
async function pushFlex(lineUserId, altText, flexContents) {
  if (!isEnabled()) {
    return { ok: true, skipped: true };
  }
  if (!lineUserId || !flexContents) {
    return { ok: false, error: 'lineUserId and flexContents required' };
  }
  try {
    const res = await fetch(PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{
          type: 'flex',
          altText: altText || 'New review on Google',
          contents: flexContents,
        }],
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
 * Build a Flex Message bubble for a "new review with draft reply"
 * notification. Owner sees the review text, the AI-drafted reply, and
 * an "Approve & post" + "Edit" button pair.
 *
 * @param {object} params
 * @param {string} params.businessName
 * @param {string} params.reviewerName
 * @param {number} params.rating - 1-5
 * @param {string} params.reviewText
 * @param {string} params.draftText
 * @param {string} params.approveUrl - URL to /api/reviews/:id/approve-from-line?token=...
 * @param {string} params.editUrl - URL to /dashboard/reviews/:id (deep link)
 * @returns {object} LINE Flex Message contents
 */
function buildReviewNotificationFlex({
  businessName,
  reviewerName,
  rating,
  reviewText,
  draftText,
  approveUrl,
  editUrl,
}) {
  const stars = '★'.repeat(rating || 0) + '☆'.repeat(Math.max(0, 5 - (rating || 0)));
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'New Google review',
          size: 'sm',
          color: '#666666',
          weight: 'bold',
        },
        {
          type: 'text',
          text: businessName || 'Your business',
          size: 'lg',
          weight: 'bold',
          margin: 'sm',
          wrap: true,
        },
      ],
      paddingAll: 'lg',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'baseline',
          contents: [
            { type: 'text', text: stars, color: '#d4a857', size: 'md', flex: 0 },
            {
              type: 'text',
              text: reviewerName || 'Anonymous',
              color: '#888888',
              size: 'sm',
              margin: 'md',
            },
          ],
        },
        {
          type: 'text',
          text: (reviewText || '').slice(0, 300),
          wrap: true,
          margin: 'md',
          size: 'sm',
        },
        { type: 'separator', margin: 'lg' },
        {
          type: 'text',
          text: 'Draft reply',
          size: 'xs',
          color: '#1e4d5e',
          weight: 'bold',
          margin: 'lg',
        },
        {
          type: 'text',
          text: (draftText || '').slice(0, 500),
          wrap: true,
          margin: 'sm',
          size: 'sm',
        },
      ],
      paddingAll: 'lg',
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          style: 'primary',
          action: {
            type: 'uri',
            label: 'Approve & post',
            uri: approveUrl,
          },
          color: '#1e4d5e',
        },
        {
          type: 'button',
          style: 'link',
          action: {
            type: 'uri',
            label: 'Edit on dashboard',
            uri: editUrl,
          },
          height: 'sm',
        },
      ],
      paddingAll: 'lg',
    },
  };
}

module.exports = {
  isEnabled,
  pushText,
  pushFlex,
  buildReviewNotificationFlex,
  PUSH_URL, // exported for tests to override
};
