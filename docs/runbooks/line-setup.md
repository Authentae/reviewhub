# LINE notification setup runbook

Get a LINE chat ping every time a new review lands. ~10 minutes one-time setup. Free tier covers 200 push messages/month — plenty for a single Thai SMB.

## Why bother

For Thai customers, LINE replaces email. You'll see and act on new reviews 10× faster than email. Especially valuable for negative reviews where every hour of delay turns into more visibility on Google.

The scaffold is already wired in production (`server/src/lib/notifications/line.js`). Activates the moment you set two env vars on Railway.

## Setup

### 1. Create a LINE Messaging API channel

1. Go to <https://developers.line.biz/console/>
2. Sign in with your LINE account
3. Click **Create a new provider** → name it `ReviewHub` → Create
4. Inside the provider, click **Create a Messaging API channel**:
   - Channel name: `ReviewHub Alerts`
   - Channel description: `Review notifications`
   - Category: `Business`
   - Subcategory: `Marketing/PR/Other`
   - Privacy policy URL: `https://reviewhub.review/privacy`
   - Terms of use URL: `https://reviewhub.review/terms`
5. Accept the terms, click **Create**.

### 2. Get the channel access token

1. Open the channel → **Messaging API** tab
2. Scroll to **Channel access token (long-lived)**
3. Click **Issue** → copy the long token (starts with something like `+abc/def...==`)
4. Save it for step 4.

### 3. Add yourself as a friend of the bot, then get your userId

The bot can only message users who've added it as a friend.

1. Same Messaging API tab → scroll to **QR code**
2. Open LINE on your phone → **Add friend** → Scan QR
3. The bot will appear as a contact (no profile pic until you add one)
4. Now we need your LINE userId. Two ways:

**Easy path — webhook receiver:**
- In the **Messaging API** tab, set **Webhook URL** to a temporary tool like `https://webhook.site` (paste any unique URL it generates)
- Enable **Use webhook**
- Send any message to your bot from LINE
- Open `webhook.site` → look at the most recent request → find `events[0].source.userId` → it'll look like `U1234567890abcdef1234567890abcdef`
- Copy this userId for step 4.
- (After you have the userId, you can disable the webhook URL — we don't use it for outbound push.)

**Alternative — use the `getProfile` cURL** (if you already know who's the only user):
- After the user follows the bot, LINE fires a follow event with their userId. Without a webhook URL set, you won't see it. Use the easy path above.

### 4. Set Railway env vars

```
LINE_CHANNEL_ACCESS_TOKEN=<from step 2>
LINE_OWNER_USER_ID=<from step 3, starts with U>
```

Click Deploy. Railway redeploys in ~90 seconds.

### 5. Test

Trigger any new-review notification (load demo data → "New Review" button). Within 5 seconds you should get a LINE message:

> 🔔 New review for The Corner Bistro
> ★★★☆☆ (3/5) — Dan T. on google
>
> "Pasta was excellent. Service took forever though…"
>
> Reply in your dashboard: https://reviewhub.review/dashboard

## Troubleshooting

**No message arrives, no error in Railway logs**
- Check the channel hasn't expired or been disabled in the LINE console.
- Confirm you haven't blocked the bot from your LINE app.
- Check `process.env.LINE_CHANNEL_ACCESS_TOKEN` and `LINE_OWNER_USER_ID` are actually set on Railway (Variables tab).

**`[LINE] push failed: <error>` in Railway logs**
- 401 Unauthorized → token is invalid. Re-issue from step 2.
- 400 Bad Request → userId format wrong. Must start with `U` and be 33 chars total.
- Network error → LINE API briefly down. The next review will retry naturally.

**Free tier exhausted (200/month)**
- LINE will reject push calls. Upgrade to paid plan or wait until next month.
- For typical Thai SMB volume (5–20 reviews/mo), 200/mo is ~10× headroom.

## Future enhancements (not yet shipped)

- Per-user routing: each customer's owner/manager can have their own LINE userId stored in `users.line_user_id`. Today the scaffold sends to a single `LINE_OWNER_USER_ID` (you).
- Rich messages: LINE supports image, button, carousel templates. Could send a tappable "Reply" button that deep-links into the dashboard.
- Outbound from dashboard: send the AI-drafted reply text to LINE so the customer sees it before posting.
- Review-request push: ask customers for a Google review via LINE OA broadcast.

These ship after first LINE-using customer asks. Don't pre-build.
