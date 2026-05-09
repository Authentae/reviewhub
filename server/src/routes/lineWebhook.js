// POST /api/webhooks/line — LINE Messaging API webhook receiver.
//
// LINE sends events here when:
//  - A user adds the ReviewHub OA bot as a friend ("follow" event)
//  - A user sends a message to the bot ("message" event)
//  - A user unfriends ("unfollow" event)
//  - LINE platform validation pings ("verify" handshake — empty body)
//
// Reference: https://developers.line.biz/en/reference/messaging-api/#webhook-event-objects
//
// Critical responsibilities:
//
// 1. ALWAYS return 200 OK quickly. LINE retries on non-2xx and considers
//    the webhook broken if too many fail.
// 2. Validate signature (X-Line-Signature header — HMAC-SHA256 of raw body
//    using LINE_CHANNEL_SECRET). Without this, anyone can spoof events.
// 3. Handle the link-token flow: when a logged-in ReviewHub user generates
//    a link token in Settings, then sends `/link <token>` to the bot, this
//    handler matches the token to the user and stores their line_user_id.
// 4. Store follow/unfollow status so we know who's reachable.
//
// Behavior when LINE_OA_ENABLED is not 'true':
//  - Webhook still returns 200 (so LINE platform validation passes)
//  - But events are NOT processed (no DB writes)
//  - Lets the route ship to prod safely before LINE OA credentials exist.

const express = require('express');
const crypto = require('crypto');
const { get, run, insert } = require('../db/schema');
const { captureException } = require('../lib/errorReporter');
const { pushText } = require('../lib/line/messenger');

const router = express.Router();

// LINE webhook receivers MUST mount with express.raw() so the body can
// be HMAC-verified before JSON parsing. We expose a router but the
// actual express.raw() middleware mount happens in app.js, which then
// calls webhookHandler with the raw buffer attached to req.body.

function verifySignature(rawBody, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return false;
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');
  // Use timingSafeEqual to avoid timing attacks
  try {
    const a = Buffer.from(signature, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function handleFollowEvent(event) {
  const lineUserId = event?.source?.userId;
  if (!lineUserId) return;
  // Send the welcome message that explains the link flow.
  // Owner has just added the bot; we don't know who they are yet.
  // They need to type `/link <token>` (token from Settings page).
  await pushText(
    lineUserId,
    [
      'สวัสดีครับ — ReviewHub ที่นี่ครับ',
      '',
      'พิมพ์ /link <โค้ด> เพื่อเชื่อมบัญชี ReviewHub ของคุณ',
      'หาโค้ดได้ที่หน้า Settings → Connect LINE',
      '',
      'Hi — ReviewHub here.',
      'Type /link <code> to connect your ReviewHub account.',
      'Get the code from Settings → Connect LINE.',
    ].join('\n')
  );
}

async function handleMessageEvent(event) {
  const lineUserId = event?.source?.userId;
  const text = event?.message?.text || '';
  if (!lineUserId || !text) return;

  // /link <token> — the user-initiated linking flow
  const linkMatch = text.match(/^\s*\/link\s+([A-Za-z0-9_-]{8,64})\s*$/i);
  if (linkMatch) {
    const token = linkMatch[1];
    // Find a pending link with this token (and not expired)
    const pending = get(
      `SELECT id, user_id FROM line_oa_links
        WHERE link_token = ?
          AND link_token_expires_at IS NOT NULL
          AND datetime(link_token_expires_at) > datetime('now')`,
      [token]
    );
    if (!pending) {
      await pushText(
        lineUserId,
        'โค้ดไม่ถูกต้องหรือหมดอายุ ลองสร้างโค้ดใหม่ที่ Settings ครับ\n\nInvalid or expired code. Generate a new one in Settings.'
      );
      return;
    }
    // Activate the link: store line_user_id, clear token
    run(
      `UPDATE line_oa_links
          SET line_user_id = ?,
              link_token = NULL,
              link_token_expires_at = NULL,
              linked_at = datetime('now'),
              updated_at = datetime('now')
        WHERE id = ?`,
      [lineUserId, pending.id]
    );
    await pushText(
      lineUserId,
      'เชื่อมบัญชีเรียบร้อยครับ ตั้งแต่นี้รีวิวใหม่จะแจ้งเตือนที่นี่\n\nLinked! New reviews will notify you here from now on.'
    );
    return;
  }

  // Default reply: instructions
  await pushText(
    lineUserId,
    'พิมพ์ /link <โค้ด> เพื่อเชื่อมบัญชี ReviewHub\nType /link <code> to connect your ReviewHub account.'
  );
}

async function handleUnfollowEvent(event) {
  const lineUserId = event?.source?.userId;
  if (!lineUserId) return;
  // Mark the link as inactive but don't delete (audit trail).
  run(
    `UPDATE line_oa_links
        SET line_user_id = NULL,
            updated_at = datetime('now')
      WHERE line_user_id = ?`,
    [lineUserId]
  );
}

/**
 * Express handler. Mount with express.raw() so req.body is a Buffer.
 * The route in app.js handles raw-body parsing.
 */
async function webhookHandler(req, res) {
  // Validation handshake from LINE platform sends an empty body. Always 200.
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';

  // Feature flag — if LINE OA isn't enabled, accept and discard.
  if (process.env.LINE_OA_ENABLED !== 'true') {
    return res.status(200).json({ ok: true, skipped: true });
  }

  // Signature verification (only enforce if we have a secret configured)
  if (process.env.LINE_CHANNEL_SECRET) {
    const signature = req.headers['x-line-signature'];
    if (!verifySignature(rawBody, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  let payload;
  try {
    payload = rawBody ? JSON.parse(rawBody) : { events: [] };
  } catch {
    // LINE sends valid JSON or empty; bad JSON = bug or attack
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const events = Array.isArray(payload.events) ? payload.events : [];

  // Process each event independently; one failing event shouldn't block
  // others. ALWAYS return 200 to LINE so the platform doesn't retry.
  for (const event of events) {
    try {
      switch (event.type) {
        case 'follow':
          await handleFollowEvent(event);
          break;
        case 'message':
          if (event.message?.type === 'text') {
            await handleMessageEvent(event);
          }
          break;
        case 'unfollow':
          await handleUnfollowEvent(event);
          break;
        default:
          // ignore other event types (postback, beacon, etc.) for now
          break;
      }
    } catch (err) {
      captureException(err, { route: 'line-webhook', eventType: event?.type });
    }
  }

  return res.status(200).json({ ok: true });
}

router.post('/', webhookHandler);

module.exports = { router, webhookHandler, verifySignature };
