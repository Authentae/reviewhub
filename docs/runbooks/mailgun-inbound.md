# Mailgun inbound email setup

Activates the email-forwarding pipeline so users can forward review-notification
emails from Booking.com / Wongnai / Tabelog / Yelp / etc. to their personal
`reviews+<secret>@reviewhub.review` address and have those reviews auto-land
on their dashboard within ~30 seconds.

The endpoint code is already shipped. This runbook is just the one-time
operator setup to point real email at it.

## Cost

Free for ~5,000 messages/mo on Mailgun's Foundation plan. Plenty for
launch — you'll likely never exceed it.

## One-time setup

1. **Sign up at https://mailgun.com**, verify your email.
2. **Add `reviewhub.review` as a sending domain** in Mailgun → Domains.
   - Mailgun shows you 4 DNS records to add (TXT for SPF, DKIM, MX,
     CNAME). Add them at your DNS provider (Cloudflare/Namecheap/wherever
     you bought reviewhub.review).
   - Click "Verify DNS Settings" in Mailgun. Wait ~10 minutes for
     propagation.
3. **Set up an inbound route**:
   - Mailgun → Receiving → Create Route
   - Filter expression: `match_recipient("reviews\\+.+@reviewhub.review")`
   - Action: `forward("https://reviewhub.review/api/inbound/email")`
     (also tick "Store and notify" if you want a backup)
   - Priority: 0 (highest)
   - Save.
4. **Get the webhook signing key** in Mailgun → API Security. Copy it.
5. **In Railway**, add env vars on the **server** service:
   ```
   MAILGUN_WEBHOOK_SIGNING_KEY=<paste from step 4>
   INBOUND_EMAIL_DOMAIN=reviewhub.review
   ```
6. **Redeploy** (Railway will auto-deploy when you save env vars).

## Verifying it works

After redeploy, send a test:

```bash
# Authenticated request to get your forwarding address
TOKEN="$(curl -s -X POST https://reviewhub.review/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"…"}' | jq -r .token)"

curl -H "Authorization: Bearer $TOKEN" https://reviewhub.review/api/inbound/address
```

Expected response:
```json
{
  "address": "reviews+abc123…@reviewhub.review",
  "mailgun_configured": true
}
```

`mailgun_configured: true` confirms the env var is wired.

Then:
1. Go to your Settings page → "Email forwarding" section
2. Copy the address it shows
3. From your personal Gmail, send a test email to that address with
   subject "Booking.com Score: 9/10" and body "Guest review from Test
   User\n\nGreat hotel".
4. Within 30 seconds, a review should appear on your dashboard with
   platform="booking", rating=5.

## What gets parsed automatically

Each platform's notification emails are parsed differently. Currently
supported with platform-specific extractors:

- Booking.com — score, guest name
- Agoda — guest name from subject
- Traveloka — generic
- Wongnai — Thai content + reviewer name
- Tabelog — generic
- TripAdvisor — reviewer name from subject
- Trustpilot — generic
- Google My Business — reviewer name from subject
- Yelp — generic
- Facebook — generic

Anything else falls through to the generic parser (extracts longest
paragraph as review text + tries to detect rating from "X stars" /
"X/5" / "X/10" patterns). Worst case: the email body lands as the
review text and the user can edit.

## Disabling

Unset `MAILGUN_WEBHOOK_SIGNING_KEY` in Railway env. The webhook reverts
to 401 for all requests; users can still see their forwarding address
in Settings (it's a no-op until you re-activate).

## Troubleshooting

**"Signature verification failed"**: env var not set or wrong key.
Re-copy from Mailgun → API Security.

**Mailgun retries 5x then drops**: your endpoint returned non-200.
Check Sentry — most likely a parser exception. The endpoint is
designed to return 200 on parse failures (just inserts a generic
review) so this should be rare.

**No review appears after forwarding**: check the Mailgun logs at
Mailgun → Logs. Filter for the recipient address. If you see
"delivered to webhook" but no review appears, the parser identified
an unknown secret — check Settings shows the correct address.
