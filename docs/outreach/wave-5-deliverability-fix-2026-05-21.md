# Wave 5 deliverability fix — 2026-05-21

**Honest re-analysis (2026-05-21 12:30 ICT, after Chrome MCP read of
both your earth.reviewhub Inbox and Sent folders):**

- Wave 5 sent 14 cold emails on 2026-05-16 around 9 PM ICT.
- **4 of the 14 BOUNCED on 5/19** (mailer-daemon delivery failures —
  visible in your inbox).
- **All "audit-view" timestamps cluster in 2 narrow batches** (5/16
  21:51:21–21:51:50 and 5/18 09:41:43–09:41:44) which fingerprints as
  YOUR own URL-verification clicks, not prospect engagement.
- **Real prospect engagement: 0–1 opens** (CORAN's second view at 5/17
  14:00 may or may not be them). 0 replies.

The earlier "64% open rate, Outcome B confirmed" was wrong. The
underlying data was contaminated by your own verification clicks +
4 invalid emails. I'm sorry for the confident misread.

---

## The 4 BOUNCED emails — find a different channel

These addresses are dead. Don't re-send to them. Use the contact paths
from `docs/outreach/wave-5-prospects.md`:

| # | Prospect | Bounced email | Alternative channel |
|---|---|---|---|
| 1 | Chuwattana Boxing Gym | chuwatthanaboxinggym@gmail.com | **Phone:** 084-023-3600 · **FB:** facebook.com/Chuwatthana-Boxing-Gym-261658753853598 |
| 2 | Eminent Air Boxing Gym | eminentairboxinggym@hotmail.com | **Phone:** 087-901-1255 · **Website:** eminentgym.com (contact form?) · **IG:** @eminentairboxinggym |
| 3 | Rithirit Gym Academy | rithiritgym@gmail.com | **Phone:** 095-534-5980 · **FB:** facebook.com/RithiritGymAcademy |
| 4 | Master Toddy Muay Thai Academy | mastertoddy@gmail.com | **Phone:** 084-325-8822 · **Website:** mastertoddy.com (contact form?) · **IG:** @mastertoddy_bangkok |

### IG / FB DM template (English)

For each of the 4 above. Send via Instagram DM (your authed IG) or FB
Messenger from the brand-account. **Send 1, wait for response, then
send #2** — don't blast all 4 at once (looks spammy).

```
Hi {trainer/master/coach name if known, otherwise "team"},

Quick note — sent an email last week about reply drafts for your
Google reviews but it bounced (the {gmail/hotmail} address doesn't
work, just FYI in case you didn't know).

I'm Earth, solo founder of ReviewHub (Bangkok). I noticed
{specific-observation-from-their-reviews — Chuwattana's trial-class
fighter reviews / Eminent Air's named-coach pattern / Rithirit's
Master-Jitti-by-name 5-stars / Master Toddy's long-term-fighter
reviews}.

I drafted reply suggestions for your 10 most recent reviews and you
can see them here — no signup, no card:

→ {THE ORIGINAL AUDIT-PREVIEW URL FROM YOUR 5/16 SEND}?variant=L

If the drafts feel right (or wrong) for the gym, a one-line reply
either way is genuinely useful. No pressure.

— Earth
reviewhub.review
```

**Note the `?variant=L` URL trick:** since these prospects didn't see
ANY variant yet (email bounced), they get the low-friction L variant
directly — no contamination. This is a clean test.

You can find the original audit URLs in `tmp/outreach-stats-2026-05-21.json`
under each `business_name` → I don't have the share_tokens (admin
endpoint strips them for security) but you can pull them from your
Sent folder or by querying `audit_previews` with `business_name LIKE
'Chuwattana%'` etc. on the DB.

---

## The 10 DELIVERABLE emails — what really happened + what to do

These 10 emails did NOT bounce. So they're sitting in the prospects'
inboxes (or spam folders). 9 of 10 have view counts that fingerprint
as YOUR verification clicks, not theirs. So most prospects probably
never opened.

| Vertical | Prospect | Real prospect opens (estimated) |
|---|---|---|
| Spa | CORAN Boutique Spa | **1 possible** (5/17 14:00 — could be them, could be you re-checking) |
| Spa | Dahra Spa Silom | 0 |
| Spa | Infinity Wellbeing | 0 |
| Spa | Preme Spa | 0 |
| Spa | Treasure Spa Thonglor | 0 |
| Coffee | Ink and Lion Cafe | 0 |
| Coffee | Ceresia Coffee Roasters | 0 |
| Dental | Asok Montri Dental Clinic | 0 |
| Dental | IDENT Dental Clinic | 0 |
| Muay Thai | Luktupfah Muay Thai | 0 |

So the cold-send didn't break Gmail's deliverability filters (no
bounces), but the open rate is approximately 0. Two probable causes:

1. **Subject line wasn't compelling** — 5-day window with 0 opens
   suggests the subject reads as cold/scammy.
2. **Sender unknown** — earth.reviewhub@gmail.com has no
   recognisable brand to these prospects.

### Recommended re-send: ONE per prospect, different subject

Reply to the original Wave 5 thread (don't start new — preserves the
audit URL context if they search later). Subject auto-becomes
"Re: {original subject}". The body re-states the offer with the
LOW-FRICTION variant URL.

**Send window:** Wed 9-11 AM Bangkok (you're in it right now) OR
Thu 9-11 AM. After Thu 11 AM, the cohort is past their cold-email
half-life.

```
Hi {prospect name / "team at {business}"},

Following up briefly — I sent the original last week and I'm not
sure if it reached you (Gmail auto-filtering is a wild guess
sometimes).

If the original is in your spam folder, the short version is: I
drafted reply suggestions for your 10 most recent Google reviews
in your voice — no signup, no card, just a preview. Link below.

→ {ORIGINAL AUDIT URL}?variant=L

If the drafts read right (or wrong) for {business}, a one-line
"yes" or "no" reply is genuinely useful. If it's "not interested,"
I won't follow up again either way.

— Earth
reviewhub.review
```

**Why `?variant=L`:**
- They never saw any variant (didn't open the original).
- L = low-friction lead (LINE/email primary, Stripe demoted) — the
  variant we shipped specifically for the "cold prospect, no trust
  yet" segment.
- Clean test: NEW eyeballs hitting L.

---

## Send-order priority (if time is short)

Tier-1 (do today, 9-11 AM Bangkok):
1. **DM Chuwattana on FB** — original email bounced, they never knew you
   sent anything. Highest potential surprise-value.
2. **Re-send to CORAN** (the one possible real open) — they might
   already be slightly aware of you.
3. **Re-send to Asok Montri + IDENT** (both dental, both 0 opens, but
   the vertical is interesting if signal materialises).

Tier-2 (Thu 9-11 AM):
4. Re-send to Preme + Treasure + Dahra + Infinity (4 spa).
5. Re-send to Ink and Lion + Ceresia (2 coffee).
6. Re-send to Luktupfah (1 muay thai deliverable).

Tier-3 (over the week):
7. DM Eminent Air / Rithirit / Master Toddy via FB or website contact form.

---

## What NOT to do

- **Don't send the 9 followups I drafted earlier today** — they assumed
  the prospects opened the audit (they didn't). Pasting "I noticed you
  opened it but didn't reply" to someone who never saw the email would
  read as creepy or wrong.
- **Don't keep grinding muay thai email** — the 4-of-5 bounce rate
  means your source (likely "guess the email from business name + 
  gmail.com pattern") doesn't work for that segment. Switch channels.
- **Don't celebrate Wave 5 as a win yet** — open rate is unknown and
  approximately 0. We won't have real signal until the resend produces
  measurable opens.

---

## What's still pending on Earth's side

1. **Complete the remaining Stripe setup task** (open
   dashboard.stripe.com → "Continue setup" wizard → finish the next
   step). Required before any paid conversion can actually transfer
   funds.
2. **Flip LS test→live** (if you decide LS is the active provider).
3. **Send DMs / re-sends per the order above.**
4. **SaaSHub verification** (`docs/outreach/saashub-verification-2026-05-21.md`
   — about to write).

---

## What I (Claude) will do next, autonomously

- Document SaaSHub verification (separate doc, you can do it in 5 min).
- Top Ahrefs SEO issues: surface non-canonical-in-sitemap (19
  instances) which is the highest-impact SEO issue Ahrefs flagged.
- Stop and wait for your billing-side decisions before any further
  shipping — the next ship has to align with which provider you commit
  to.
