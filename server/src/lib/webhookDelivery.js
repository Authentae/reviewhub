// Outbound webhook delivery.
// Signs the payload with HMAC-SHA256 over the raw JSON body using the
// webhook's secret. The signature is sent as X-ReviewHub-Signature: sha256=HEX.
// Delivery is fire-and-forget (no retries) — callers must not await this in
// the request path; use .catch() to swallow errors silently.

const { createHmac } = require('crypto');
const { get, all, run } = require('../db/schema');

const VALID_EVENTS = ['review.created', 'review.responded'];
const TIMEOUT_MS = 5000;

function sign(secret, body) {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

async function deliver(webhook, event, payload) {
  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  const sig = sign(webhook.secret, body);
  let status = null;
  let responseSnippet = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ReviewHub-Signature': sig,
        'X-ReviewHub-Event': event,
        'User-Agent': 'ReviewHub-Webhooks/1.0',
      },
      body,
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    status = res.status;
    // Consume response body to free connection — but don't store it.
    // Storing response bodies risks logging customer review content if the
    // endpoint echoes back the webhook payload in its error message.
    try { await res.arrayBuffer(); } catch { /* ignore */ }
  } catch (err) {
    status = 0; // network error / timeout
    responseSnippet = err.name === 'AbortError' ? 'Timeout' : 'Network error';
  }
  // Best-effort update of delivery metadata and delivery log.
  try {
    run(
      "UPDATE webhooks SET last_triggered_at = datetime('now'), last_status = ? WHERE id = ?",
      [status, webhook.id]
    );
    run(
      "INSERT INTO webhook_deliveries (webhook_id, event, status, response_snippet) VALUES (?, ?, ?, ?)",
      [webhook.id, event, status, responseSnippet]
    );
    // Keep only the 50 most recent deliveries per webhook
    run(
      `DELETE FROM webhook_deliveries WHERE webhook_id = ? AND id NOT IN (
        SELECT id FROM webhook_deliveries WHERE webhook_id = ? ORDER BY id DESC LIMIT 50
      )`,
      [webhook.id, webhook.id]
    );
  } catch { /* ignore */ }
}

// Fire webhooks for a given user + event asynchronously (fire-and-forget).
// Returns immediately; delivery happens in the background.
function fireWebhooks(userId, event, payload) {
  if (!VALID_EVENTS.includes(event)) return;
  try {
    const hooks = all(
      "SELECT * FROM webhooks WHERE user_id = ? AND enabled = 1",
      [userId]
    );
    for (const hook of hooks) {
      let events;
      try { events = JSON.parse(hook.events); } catch { events = ['review.created']; }
      if (!events.includes(event)) continue;
      deliver(hook, event, payload).catch(() => { /* fire-and-forget */ });
    }
  } catch { /* never throw into caller */ }
}

module.exports = { fireWebhooks, VALID_EVENTS, sign };
