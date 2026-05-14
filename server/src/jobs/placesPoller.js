// Places API v1 — review poller.
//
// Walks businesses with `google_place_id IS NOT NULL`, fetches up to 5 most
// recent reviews via Google Places API (NEW), inserts new ones, generates
// AI drafts for them, and (if the owner has linked LINE OA) pushes a Flex
// notification with the draft.
//
// Why this exists alongside `syncReviews.js`:
//   - syncReviews iterates `platform_connections` rows backed by the
//     OAuth-based Business Profile API. That requires Google's allow-list
//     approval (3-42 days) — until approved, those calls 403.
//   - This poller iterates `businesses.google_place_id` and uses the
//     read-only Places API which only needs an API key. It unblocks the
//     LINE-pivot v1 demo while we wait for Business Profile API approval.
//   - Replies are NOT auto-posted in v1 — the LINE notification's
//     "Approve & post" button deep-links to a dashboard page where the
//     owner copy-pastes into Google. v2 (after Business Profile approval)
//     swaps the same button to one-tap auto-post.
//
// Frequency: poll every 30 min by default (PLACES_POLL_INTERVAL_MS).
// At pre-revenue scale the $200/mo free tier covers it (see spec).
//
// Overlap guard, error isolation, and AI-draft / LINE-push flow all mirror
// the conventions in syncReviews.js. Failure of one business never blocks
// the others.

const { all, get, insert, run, transaction } = require('../db/schema');
const googlePlaces = require('../lib/providers/googlePlaces');
const { generateDraft } = require('../lib/aiDrafts');
const lineMessenger = require('../lib/line/messenger');
const { analyzeSentiment } = require('../db/seed');
const { captureException } = require('../lib/errorReporter');

// Public-facing dashboard URL for the "Approve & post" button. Falls back
// to the prod domain so a missing env var doesn't produce a broken link.
function dashboardBase() {
  return process.env.PUBLIC_APP_URL || 'https://reviewhub.review';
}

/**
 * Poll a single business for new Places reviews.
 * Returns { inserted, error }.
 */
async function pollOne(businessId) {
  const biz = get(
    `SELECT b.id, b.user_id, b.business_name, b.google_place_id, b.google_managing_email,
            u.email AS owner_email,
            u.notif_new_review,
            COALESCE(u.preferred_lang, 'en') AS owner_lang,
            (SELECT line_user_id FROM line_oa_links
              WHERE user_id = b.user_id AND line_user_id IS NOT NULL
              LIMIT 1) AS line_user_id,
            (SELECT telegram_chat_id FROM telegram_links
              WHERE user_id = b.user_id AND telegram_chat_id IS NOT NULL
              LIMIT 1) AS telegram_chat_id
       FROM businesses b
       LEFT JOIN users u ON u.id = b.user_id
      WHERE b.id = ?`,
    [businessId]
  );
  if (!biz) return { inserted: 0, error: 'Business not found' };
  if (!biz.google_place_id) return { inserted: 0, error: 'No google_place_id set' };

  let reviews;
  try {
    reviews = await googlePlaces.fetchReviews(biz.google_place_id);
  } catch (err) {
    return { inserted: 0, error: err.message };
  }

  if (!Array.isArray(reviews) || reviews.length === 0) {
    return { inserted: 0, error: null };
  }

  // Filter to genuinely new ones BEFORE doing AI work — generateDraft costs
  // money + latency. We don't want to redraft on every 30-min tick.
  const newReviews = [];
  transaction((tx) => {
    for (const r of reviews) {
      const existing = get(
        `SELECT id FROM reviews
          WHERE business_id = ? AND platform = 'google' AND external_id = ?`,
        [biz.id, r.external_id]
      );
      if (existing) continue;

      const sentiment = analyzeSentiment(r.rating, r.review_text || '');
      const newId = insert(
        `INSERT INTO reviews (business_id, platform, reviewer_name, rating, review_text,
                              sentiment, external_id, created_at, updated_at)
         VALUES (?, 'google', ?, ?, ?, ?, ?, ?, ?)`,
        [
          biz.id,
          r.reviewer_name,
          r.rating,
          r.review_text || '',
          sentiment,
          r.external_id,
          r.created_at || new Date().toISOString(),
          r.created_at || new Date().toISOString(),
        ]
      );
      newReviews.push({ ...r, dbId: newId });
    }
  });

  if (newReviews.length === 0) return { inserted: 0, error: null };

  // FIRST-SYNC GUARD — when this is the very first poll for a business
  // (no prior reviews ever existed), Google may return up to 5 historical
  // reviews. Without this guard we'd push 5 LINE Flex cards on connect
  // for a small business, or many more for a hotel with hundreds of
  // reviews — owner gets a notification storm and unsubscribes.
  //
  // Detection: if before this poll there were ZERO reviews for the
  // business, treat all of them as historical backfill — INSERT them
  // (so they appear on the dashboard) but DON'T fire LINE pushes or
  // generate AI drafts on any of them. Send ONE summary push instead.
  //
  // Subsequent polls will work normally — only truly new reviews push.
  const priorReviewCount = get(
    'SELECT COUNT(*) AS n FROM reviews WHERE business_id = ? AND platform = ?',
    [biz.id, 'google']
  );
  // priorReviewCount.n is post-insert (we inserted above). Subtract the
  // batch we just inserted to know whether the table was empty BEFORE
  // this poll.
  const wasFirstSync = (priorReviewCount?.n || 0) - newReviews.length === 0;

  // (Earlier draft of this file added a 'first-sync flood' guard that
  // diverged the flow for the very first poll. Reverted 2026-05-14 —
  // Places API only ever returns up to 5 reviews per call, so the
  // hypothetical flood doesn't exist. The straight per-review push
  // path below handles 5 cards in a row fine, especially with the
  // rating-color + date differentiation in buildReviewNotificationFlex.)
  // Suppress lint warning about unused var:
  void wasFirstSync;

  // Per-review: AI draft + LINE notification. Each is best-effort — a draft
  // failure doesn't roll back the insert; a LINE failure doesn't block the
  // next review.
  for (const r of newReviews) {
    let draftText = '';
    try {
      const result = await generateDraft({
        review: { rating: r.rating, review_text: r.review_text },
        businessName: biz.business_name,
      });
      draftText = result?.text || result?.draft || '';
    } catch (err) {
      captureException(err, { job: 'placesPoller', op: 'generateDraft', businessId: biz.id });
    }

    // EMAIL notification — universal fallback channel, fires for every
    // user who has `notif_new_review` enabled (default ON at signup).
    // Same content as the LINE Flex card (rating-tinted header, AI draft,
    // Reply-on-Google link). Free per-send via Resend. Works for any user
    // anywhere in the world — doesn't require LINE OA, WhatsApp, etc.
    if (biz.owner_email && biz.notif_new_review) {
      try {
        const managingEmail = biz.google_managing_email;
        const replyOnGoogleUrl = managingEmail
          ? `https://business.google.com/reviews?authuser=${encodeURIComponent(managingEmail)}`
          : 'https://business.google.com/reviews';
        const { sendNewReviewNotification } = require('../lib/email');
        await sendNewReviewNotification(
          biz.owner_email,
          {
            rating: r.rating,
            reviewer_name: r.reviewer_name,
            review_text: r.review_text || '',
            sentiment: r.sentiment || 'neutral',
            platform: 'google',
            review_language: r.review_language || '',
            created_at: r.created_at || '',
          },
          biz.business_name,
          biz.owner_lang || 'en',
          { draftText: draftText || '', replyOnGoogleUrl }
        );
      } catch (err) {
        captureException(err, { job: 'placesPoller', op: 'sendNewReviewEmail', businessId: biz.id });
      }
    }

    // TELEGRAM notification — fires when the user has linked a Telegram
    // chat AND the bot is enabled on this deployment.
    if (biz.telegram_chat_id) {
      try {
        const telegram = require('../lib/telegram/messenger');
        if (telegram.isEnabled()) {
          const managingEmail = biz.google_managing_email;
          const replyOnGoogleUrl = managingEmail
            ? `https://business.google.com/reviews?authuser=${encodeURIComponent(managingEmail)}`
            : 'https://business.google.com/reviews';
          const { text, buttons, draftCopyMessage } = telegram.buildReviewNotification({
            businessName: biz.business_name,
            reviewerName: r.reviewer_name,
            rating: r.rating,
            reviewText: r.review_text || '',
            reviewDate: r.created_at || '',
            draftText: draftText || '',
            draftLanguage: r.review_language || '',
            replyOnGoogleUrl,
            editUrl: `${dashboardBase()}/dashboard/reviews/${r.dbId}`,
          });
          await telegram.pushWithButtons(biz.telegram_chat_id, text, buttons);
          // Follow-up draft-only message in <code> for one-tap copy on
          // mobile Telegram. Send AFTER the card so the card scrolls
          // up and the copy block sits at the bottom of the chat.
          if (draftCopyMessage) {
            await telegram.pushText(biz.telegram_chat_id, draftCopyMessage);
          }
        }
      } catch (err) {
        captureException(err, { job: 'placesPoller', op: 'telegramPush', businessId: biz.id });
      }
    }

    if (biz.line_user_id && lineMessenger.isEnabled()) {
      try {
        // Reply-on-Google deep-link with authuser hint when the business
        // has a managing-email set. Same URL pattern as the dashboard
        // "Reply on Google" button so the LINE Flex card and the dashboard
        // converge on a single action.
        const managingEmail = biz.google_managing_email;
        const replyOnGoogleUrl = managingEmail
          ? `https://business.google.com/reviews?authuser=${encodeURIComponent(managingEmail)}`
          : 'https://business.google.com/reviews';
        const flex = lineMessenger.buildReviewNotificationFlex({
          businessName: biz.business_name,
          reviewerName: r.reviewer_name,
          rating: r.rating,
          reviewText: r.review_text || '',
          reviewDate: r.created_at || '',
          draftText: draftText || '(draft unavailable — open dashboard)',
          draftLanguage: r.review_language || '',
          replyOnGoogleUrl,
          // editUrl deep-links to dashboard for tweaking the draft before
          // pasting on Google. The two buttons (Reply on Google / Edit)
          // mirror the dashboard "Reply on Google" + Copy pair.
          editUrl: `${dashboardBase()}/dashboard/reviews/${r.dbId}`,
        });
        await lineMessenger.pushFlex(
          biz.line_user_id,
          `New review for ${biz.business_name}`,
          flex,
          {
            // Plain-text follow-up so the owner can long-press → Copy →
            // paste in Google. Flex Message internals don't support
            // text-selection; a separate text bubble does.
            copyableText: draftText || '',
          }
        );
      } catch (err) {
        captureException(err, { job: 'placesPoller', op: 'pushFlex', businessId: biz.id });
      }
    }
  }

  return { inserted: newReviews.length, error: null };
}

/**
 * Poll every business with a Place ID configured.
 */
async function pollAll() {
  if (!googlePlaces.isConfigured()) {
    return { totalInserted: 0, businessCount: 0, results: [], skipped: 'GOOGLE_MAPS_API_KEY not set' };
  }
  const businesses = all(
    `SELECT id FROM businesses WHERE google_place_id IS NOT NULL AND google_place_id != ''`
  );
  let totalInserted = 0;
  const results = [];
  for (const { id } of businesses) {
    const r = await pollOne(id);
    totalInserted += r.inserted;
    results.push({ businessId: id, ...r });
  }
  return { totalInserted, businessCount: businesses.length, results };
}

// Scheduler. Default 30 min interval (matches SYNC_INTERVAL_MS spirit but
// kept independent so ops can tune Places polling separately — Places API
// has its own quota and cost profile).
let _intervalHandle = null;
let _running = false;
async function runTickSafely(label) {
  if (_running) {
    console.warn(`[PLACES] ${label}: previous tick still running — skipping`);
    return;
  }
  _running = true;
  try {
    const r = await pollAll();
    if (r.skipped) {
      if (label === 'initial') console.log(`[PLACES] ${label}: skipped (${r.skipped})`);
      return;
    }
    if (r.totalInserted > 0 || label === 'initial') {
      console.log(`[PLACES] ${label}: ${r.totalInserted} new review(s) across ${r.businessCount} business(es)`);
    }
  } catch (e) {
    console.error(`[PLACES] ${label} failed:`, e.message);
    captureException(e, { job: 'placesPoller', op: label });
  } finally {
    _running = false;
  }
}
function startPlacesPoller() {
  const intervalMs = parseInt(process.env.PLACES_POLL_INTERVAL_MS || '1800000', 10);
  if (!intervalMs) {
    console.log('[PLACES] Poller disabled (PLACES_POLL_INTERVAL_MS=0)');
    return;
  }
  setTimeout(() => { runTickSafely('initial'); }, 8000);
  _intervalHandle = setInterval(() => { runTickSafely('tick'); }, intervalMs);
  _intervalHandle.unref?.();
  console.log(`[PLACES] Poller active (every ${Math.round(intervalMs / 1000)}s)`);
}
function stopPlacesPoller() {
  if (_intervalHandle) { clearInterval(_intervalHandle); _intervalHandle = null; }
}

module.exports = { pollOne, pollAll, startPlacesPoller, stopPlacesPoller };
