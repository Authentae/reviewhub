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
async function pushFlex(lineUserId, altText, flexContents, options = {}) {
  if (!isEnabled()) {
    return { ok: true, skipped: true };
  }
  if (!lineUserId || !flexContents) {
    return { ok: false, error: 'lineUserId and flexContents required' };
  }
  // LINE Flex Messages render text as visual card elements — owners
  // CANNOT long-press the text inside a Flex card to copy it (the
  // copy-text gesture works on chat-bubble text messages but not on
  // Flex contents). So when there's an AI-drafted reply, we send TWO
  // messages in one push:
  //   1. The Flex card (header + draft + action buttons) for visual
  //      summary + tap targets
  //   2. A plain-text message containing JUST the draft, so the owner
  //      can long-press → Copy → paste in Google's review form
  // LINE allows up to 5 messages per push call so this stays well
  // within limits.
  const messages = [{
    type: 'flex',
    altText: altText || 'New review on Google',
    contents: flexContents,
  }];
  if (options.copyableText) {
    const txt = String(options.copyableText).slice(0, 4500); // LINE text limit is 5000
    if (txt.trim()) {
      messages.push({ type: 'text', text: txt });
    }
  }
  try {
    const res = await fetch(PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ to: lineUserId, messages }),
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
  draftLanguage,
  approveUrl,
  editUrl,
  replyOnGoogleUrl,
}) {
  const stars = '★'.repeat(rating || 0) + '☆'.repeat(Math.max(0, 5 - (rating || 0)));
  // Brand tokens — same hex values used across the landing/dashboard
  // (--rh-paper, --rh-ink, --rh-ochre-deep, --rh-teal-deep, --rh-sage).
  // Keeps the LINE Flex card visually adjacent to the landing-page
  // mockup so owners who saw the marketing don't feel a downgrade.
  const PAPER = '#fbf8f1';
  const INK = '#1d242c';
  const INK_SOFT = '#4a525a';
  const OCHRE = '#a07d20';
  const TEAL = '#1e4d5e';
  const RULE = '#e6dfce';

  const langTag = (draftLanguage || '').toUpperCase().slice(0, 4);
  const draftHeader = langTag ? `AI DRAFT · ${langTag}` : 'AI DRAFT';

  // Editorial eyebrow — caps + mono-feel via wide letter-spacing.
  // LINE Flex has no font-family control; the closest we get to the
  // mockup's JetBrains Mono eyebrow is uppercase + xs weight bold.
  const eyebrow = `NEW REVIEW · ${(businessName || 'YOUR BUSINESS').toUpperCase().slice(0, 40)}`;

  // Build the footer button array based on which URLs were provided.
  // Reply-on-Google is preferred — it's the action that actually works
  // today (until GBP API approval). Approve via dashboard is the v2.
  const footerButtons = [];
  if (replyOnGoogleUrl) {
    footerButtons.push({
      type: 'button',
      style: 'primary',
      action: { type: 'uri', label: 'Reply on Google', uri: replyOnGoogleUrl },
      color: TEAL,
    });
  } else if (approveUrl) {
    footerButtons.push({
      type: 'button',
      style: 'primary',
      action: { type: 'uri', label: 'Approve & post', uri: approveUrl },
      color: TEAL,
    });
  }
  if (editUrl) {
    footerButtons.push({
      type: 'button',
      style: 'link',
      action: { type: 'uri', label: 'Edit in dashboard', uri: editUrl },
      height: 'sm',
    });
  }

  return {
    type: 'bubble',
    size: 'mega',
    styles: {
      header: { backgroundColor: PAPER },
      body: { backgroundColor: '#ffffff' },
      footer: { backgroundColor: PAPER, separator: true, separatorColor: RULE },
    },
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        // Editorial eyebrow
        {
          type: 'text',
          text: eyebrow,
          size: 'xs',
          color: OCHRE,
          weight: 'bold',
          wrap: true,
        },
        // Stars + reviewer name on one baseline — more prominent than before
        {
          type: 'box',
          layout: 'baseline',
          margin: 'md',
          contents: [
            { type: 'text', text: stars, color: '#d4a857', size: 'lg', flex: 0 },
            {
              type: 'text',
              text: reviewerName || 'Anonymous',
              color: INK,
              size: 'md',
              weight: 'bold',
              margin: 'md',
              wrap: false,
            },
          ],
        },
      ],
      paddingAll: 'lg',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        // Review text — first thing the owner reads
        {
          type: 'text',
          text: (reviewText || '').slice(0, 400),
          wrap: true,
          size: 'sm',
          color: INK,
        },
        // Draft section — visually offset with sage-tinted box
        {
          type: 'box',
          layout: 'vertical',
          margin: 'xl',
          paddingAll: 'md',
          backgroundColor: PAPER,
          cornerRadius: 'sm',
          contents: [
            {
              type: 'text',
              text: draftHeader,
              size: 'xs',
              color: OCHRE,
              weight: 'bold',
            },
            {
              type: 'text',
              text: (draftText || '').slice(0, 500),
              wrap: true,
              margin: 'md',
              size: 'sm',
              color: INK,
            },
          ],
        },
        // Honest instructional hint — LINE Flex schema doesn't support
        // text-selection on card internals, so the owner needs to copy
        // from the plain-text bubble we send as a follow-up message,
        // then tap Reply on Google here. Spell it out so the workflow
        // is discoverable on first use.
        {
          type: 'text',
          text: 'Long-press the message below to copy →',
          size: 'xs',
          color: INK_SOFT,
          margin: 'md',
          align: 'center',
          wrap: true,
        },
      ],
      paddingAll: 'lg',
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: footerButtons,
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
