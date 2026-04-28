# Hook ReviewHub into Zapier / Make / n8n

You can pipe every new review and every response into your existing tools — CRM, Slack, Google Sheets, an email drip — without us shipping a custom Zapier app. Use ReviewHub's outbound webhooks.

## What ReviewHub fires

| Event | When | Payload |
|---|---|---|
| `review.created` | A new review lands in your dashboard (synced from Google or imported via CSV) | `{ id, business_id, platform, reviewer_name, rating, text, sentiment, created_at }` |
| `review.responded` | You (or auto-respond rules) post a reply to a review | adds `response_text`, `response_posted_at` |

Each delivery includes:

- `Content-Type: application/json`
- `X-ReviewHub-Event: review.created` (or `review.responded`)
- `X-ReviewHub-Signature: sha256=<hex>` (HMAC-SHA256 of the raw body using the secret you set)
- `User-Agent: ReviewHub-Webhooks/1.0`
- 5-second timeout, fire-and-forget (no retries — your endpoint must accept the event quickly)

## Setup — 3 minutes

### 1. Create the receiver in Zapier / Make / n8n

#### Zapier
- New Zap → Trigger: **Webhooks by Zapier** → **Catch Hook**
- Copy the unique URL (`https://hooks.zapier.com/hooks/catch/.../...`).
- Test will be empty until you fire the first event in step 3.

#### Make.com (Integromat)
- New scenario → first module: **Webhooks** → **Custom webhook**
- Click **Add** → name it → copy the URL.

#### n8n
- New workflow → first node: **Webhook**
- Set `HTTP Method: POST`, `Path:` whatever you want.
- Copy the **Production URL**.

### 2. Add the webhook in ReviewHub

- Settings → **Outbound Webhooks** → **+ Add webhook**
- URL: paste the URL from step 1
- Events: pick `review.created` (and optionally `review.responded`)
- Save the secret it shows you (or set your own). You'll need it for signature verification.

### 3. Fire a test event

- In your ReviewHub dashboard, click **Load demo data** (or wait for a real review to land).
- Verify the receiver in step 1 picked it up.
- Now Zapier / Make / n8n will show fields you can map to the next step.

## Common recipes

### Slack notification on every negative review
- Trigger: ReviewHub `review.created`
- Filter: `sentiment = negative`
- Action: Slack → Send Channel Message
  - Text: `:warning: ${reviewer_name} left ${rating}★ on ${platform}: ${text}`
  - Channel: `#customer-feedback`

### Google Sheets log of every review
- Trigger: ReviewHub `review.created`
- Action: Google Sheets → Create Spreadsheet Row
- Map: rating, reviewer_name, platform, sentiment, text, created_at

### CRM sync on positive reviews
- Trigger: ReviewHub `review.created`
- Filter: `sentiment = positive`
- Action: HubSpot/Pipedrive/Salesforce → Create Note on Contact
  - Match by reviewer email (if you stored one) or name.

### Auto-tweet 5-star reviews
- Trigger: ReviewHub `review.responded`
- Filter: `rating = 5`
- Action: Twitter → Post Tweet
  - `${reviewer_name} on ${platform}: "${text}" — thanks 🙏`
  - **Make sure** you have customer permission to repost their text publicly.

## Verifying the signature (recommended for production receivers)

The `X-ReviewHub-Signature` header is `sha256=<hex>` where the hex is the HMAC-SHA256 of the raw POST body using your webhook's secret.

```javascript
const crypto = require('crypto');
function verify(rawBody, header, secret) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}
```

If verification fails: someone tampered with the request, or your secret is wrong. Reject with 401.

## Limits

- 5-second timeout per delivery. Slow receivers drop events.
- No retries on failure. (Your monitoring should show non-200 responses; ReviewHub keeps the last 50 deliveries per webhook in `Settings → Outbound Webhooks → View deliveries`.)
- Webhooks are scoped per-user — not per-business. If you have multiple businesses, every event for any of them fires the same webhook.
- 10 webhook URLs max per user.

## Why use this instead of waiting for an official Zapier app

A custom Zapier app would require ReviewHub to publish an OAuth flow, get reviewed by Zapier, and maintain the integration — months of work for the same result you can wire up in 3 minutes today.

When usage justifies it (≥100 customers asking for one-click Zapier setup), we'll publish the official integration. Until then: webhooks.
