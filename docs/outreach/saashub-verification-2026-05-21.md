# SaaSHub verification — 5-min task for Earth

**Triggered by:** SaaSHub approval email from Stan Bright (founder),
2026-05-21. ReviewHub.review listing is APPROVED but not yet VERIFIED.

**Why bother verifying:** verification unlocks 3 distinct benefits:

1. **Verified badge** on the listing — visual trust signal.
2. **"Recently Verified" placement** on SaaSHub homepage — temporary
   free traffic.
3. **Appearance as a verified alternative on competitors' listing
   pages** — when Birdeye / Podium / Reviewflowz visitors scroll the
   "Alternatives" section, we appear with a verified checkmark. This
   is the durable SEO + comparison-shopper traffic source.

**Why this isn't urgent vs urgent:** It's compounding-but-slow. Not on
the TTFPC critical path (won't move Wave 5.5 conversions). But it's a
5-min task with permanent payoff, so worth doing whenever you have
5 min between higher-priority items.

---

## Steps (5 min)

1. Open SaaSHub at https://www.saashub.com/manage/reviewhub-review
   (tab 992287426 is already there in your Chrome).
2. Click **Verify now** in the approval email (or navigate to the
   verification section on the manage page).
3. SaaSHub will offer 2 methods. Pick whichever is faster for you:

### Method A — HTML meta tag (fastest if I do it for you)

SaaSHub gives you a meta tag like:
```html
<meta name="saashub-verification" content="abc123..." />
```

If you give me the content string, I'll:
1. Add the tag to `client/index.html` (already has slots for Bing /
   Ahrefs verification — same pattern)
2. Commit + push
3. Tell you to click "Verify" in SaaSHub

Total Earth time: ~30 seconds (paste the string into a chat to me).
Total deploy time: ~2-3 min (Railway redeploys client).

### Method B — DNS TXT record (if you'd rather not redeploy)

SaaSHub gives a DNS TXT record value. Add to Cloudflare:
1. Open Cloudflare dashboard → reviewhub.review zone → DNS.
2. Add Record → Type: TXT → Name: `_saashub` (or whatever SaaSHub
   specifies) → Value: the verification string.
3. Wait ~1 min for propagation.
4. Click "Verify" in SaaSHub.

Total Earth time: ~3 min.

### Method C — File upload

SaaSHub gives a file like `saashub-verification-abc.html` to upload
to `https://reviewhub.review/saashub-verification-abc.html`. Same
pattern as the `/.well-known/` standards.

If you pick this method, send me the filename + content and I'll
add it to `client/public/`. Same deploy time as Method A.

---

## My recommendation

**Method A (HTML meta tag)** — fastest, gives me the doing.

You: copy the meta tag content string from SaaSHub's verify page →
paste it to me here.

Me: ship the tag in 30 sec, you wait 2 min for Railway, click Verify.

Done.

---

## What NOT to do

- **Don't pay for Premium Listing yet.** The free listing is the
  primary benefit. Premium is a "compound this later when revenue
  exists" decision, not today.
- **Don't use "SaaSHub Submit"** (their free auto-directory-submit
  tool) yet. That's a separate Tier-3 task — it auto-promotes
  ReviewHub to other directories. Worth doing when we have ≥1 paying
  customer and durable positioning. Premature now.
- **Don't worry about voting in "SaaSHub Experts"** for product-of-
  the-day. Self-promotion gaming is hollow signal.

---

## After verification — note for the wiki

Append to `docs/reviewhub-wiki.md` under "SEO infrastructure":

```
- SaaSHub: listing approved 2026-05-21 (Stan Bright); verified
  {YYYY-MM-DD via Method X}; "Approved on SaaSHub" badge available
  for the site if we want it.
```
