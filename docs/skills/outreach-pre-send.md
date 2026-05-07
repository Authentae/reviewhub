# Outreach pre-send checklist

This is the skill the agent consults BEFORE drafting any cold-
outreach or follow-up email that goes out under Earth's name.
It exists because Wave 1 had a typo'd audit URL (Chakrabongse,
2026-05-06) that almost shipped to a prospect, and Wave 2 had
the right audience but a CTA that didn't convert (3/3 opens, 0
replies — see `docs/wave-postmortems/wave-2-bangkok-hospitality.md`).

The checklist runs in two places:
1. **Before drafting**: shape rules (length, language, tone)
2. **Before queuing as draft**: integrity + safety checks (URL
   verification, identity, schedule)

A separate Node validator at `scripts/validate-outreach.js`
mechanizes the checks that can be machine-checked. Items that
require human judgment stay in this doc.

## Section 1 — Shape rules (before drafting)

### 1.1 Identity

- [ ] **From:** earth.reviewhub@gmail.com (the brand account),
      NOT theearth1659@gmail.com (personal). If unsure, check
      `docs/skills/audit-outreach.md` "Send from" line.
- [ ] **Sign-off:** "Earth" or "— Earth" or "Earth\nReviewHub
      (made-in-Bangkok side project)". Match the audit-outreach
      skill's voice rules.
- [ ] **Never sign:** "the team", "the ReviewHub team", "we",
      first-person plural for solo founder. Per `content-writing.md`
      §2 voice split.

### 1.2 Language match

- [ ] **Reply in the language the recipient last used** if there's
      a prior thread. For first-touch:
- [ ] If business is Thai-named or Thai-script-website primary →
      Thai email
- [ ] If business is internationally-positioned (English website,
      mostly-English reviews) → English email
- [ ] If mixed (e.g. Sukhumvit boutique with English-Thai bilingual
      site) → English (Bangkok-cosmopolitan default)
- [ ] **Never** mix Thai and English in the same sentence ("ขอบคุณ
      Thank you so much"). Either-or, not both.

### 1.3 Length

- [ ] **Cold first-touch:** ≤ 200 words. Owner reads first paragraph;
      if not hooked, deletes.
- [ ] **Follow-up (3-5 days after open):** ≤ 150 words. Acknowledge
      open, give 3 plausible reasons for non-reply, give permission
      to say no.
- [ ] **Customer-dev (asking why they didn't engage):** ≤ 100 words.
      One question, no pitch.
- [ ] **Warm reply (they asked for path):** ≤ 80 words. Three
      sentences max: confirmation, link, one expectation.

### 1.4 Voice

- [ ] **No corporate-speak.** No "we sincerely apologize", "your
      feedback has been escalated", "should you have any further
      inquiries". Per `content-writing.md` §2.
- [ ] **No fake numbers / fake testimonials / fake customer counts.**
      Pre-revenue means no "trusted by 1,000+", no "loved by Bangkok's
      top hotels".
- [ ] **Acknowledge stage-honesty.** "Made-in-Bangkok side project",
      "small operation (me + the codebase)", "I personally watch
      every new signup the first week" — these all build trust.
- [ ] **Specific over vague.** "Replies that took 30 minutes each
      take 30 seconds" beats "save time on review management".

### 1.5 Permission to say no

- [ ] Cold first-touch: ends with "no need to reply if not relevant"
      or equivalent
- [ ] Follow-up: explicit "a one-word 'no' is genuinely useful"
- [ ] Customer-dev: "didn't see it" framed as also-data
- [ ] Never use guilt tactics, urgency tactics, or scarcity claims
      ("only 3 spots left this week" — we don't do this)

## Section 2 — Integrity + safety checks (before queuing draft)

### 2.1 URL verification (the Chakrabongse rule)

- [ ] **Every URL in the email body must return HTTP 200** when
      curl'd. Test command: `curl -sI "<url>" | head -1`. If
      anything other than `200 OK`, do not queue the draft.
- [ ] **Audit URLs (`/audit-preview/<token>`) must be the exact
      token from the audit_previews table.** No transcription
      from screenshots. Fetch programmatically.
- [ ] **No localhost / staging URLs in production sends.** Catch
      typos like `http://reviewhub.review` (missing https) or
      `https://reviewhub.com` (wrong TLD).

> **Validator limitation:** the React SPA returns 200 for ANY
> `/audit-preview/<anything>` (it serves the same React shell
> client-side, the actual share-token check happens via API
> after page load). The HTTP-200 check catches typo'd domains
> but NOT typo'd tokens. For audit URLs, ALSO check the API:
> `curl -s "https://reviewhub.review/api/audit-previews/share/<token>" | jq .`
> — should return `{ business_name, reviews, ... }`, not
> `{ error: "Not found" }`.

### 2.2 Recipient verification

- [ ] **Email is on the prospect's live website.** Don't trust
      addresses scraped from third-party listings (Travelfish, old
      TripAdvisor entries — those have stale addresses that bounce,
      see Baan Sukhumvit 2026-05-06).
- [ ] **No typos in the address.** Run a `mailto:` mental check:
      does the local-part and domain match what's on the website?
- [ ] **Not in the do-not-send list.** Bounced addresses (e.g.
      `baansukhumvit@yahoo.com`), opted-out addresses, prospects
      already converted — all flagged in `docs/outreach-queue.md`.
- [ ] **One recipient per send** unless explicitly bulk (newsletter).
      Cold outreach is 1:1.

### 2.3 Personalization integrity

- [ ] **Every {placeholder} is replaced.** No literal `{business_name}`
      or `{vertical}` in the rendered email. Run a regex check.
- [ ] **The personalization is correct for THIS recipient.** Don't
      send "Old Capital" copy to "Loftel 22" — copy-paste between
      drafts is the highest-risk failure mode.
- [ ] **Subject line specifies the prospect.** "Old Capital Bike Inn —
      [topic]" beats generic "Quick question".

### 2.4 Send timing

- [ ] **Send window: Tue 9-11am or Wed 9-11am ICT.** Avoids:
      - Sun/Mon — weekend backlog burial (Wave 1 lesson)
      - Late Friday — owner's weekend mode
      - Late afternoon — owner has left for the day
- [ ] **For follow-ups: send at least 3 days after the opener,
      not less than 5.** Don't follow-up the next morning; looks
      desperate.
- [ ] **For waves: stagger across multiple weekday mornings.** Don't
      send 12 emails Tuesday 9am sharp — looks like a campaign,
      lands in spam-pattern detection.

### 2.5 Identity safety

- [ ] **From-account is earth.reviewhub@gmail.com.** Per CLAUDE.md
      "Confirm identity before acting on the user's behalf" — the
      brand account is correct, personal account is wrong.
- [ ] **Subject line and body don't reveal Earth's personal
      identity** (theearth1659, personal phone number, etc.).

## Section 3 — When to override the checklist

The checklist exists to prevent the failure modes we've already
seen. New situations may need new rules. Override is allowed when:

- Earth explicitly says "this case is different" in chat
- A prospect's reply makes the rule wrong (e.g. they sign with a
  different language)
- The cost of strict adherence exceeds the cost of the failure
  the rule prevents (e.g. can't verify URL because the prospect's
  domain is on Cloudflare and curl returns 403 — judgment call)

**Always log overrides in the post-mortem.** Future-agent
re-derives the rule otherwise.

## Section 4 — Validator script

`scripts/validate-outreach.js` (companion to this doc) checks:

- §2.1 URL HTTP 200 (network call)
- §2.3 placeholder replacement (regex)
- §1.3 word count limits (text count)
- §2.2 recipient address format (regex)
- §2.5 from-account is earth.reviewhub (env or arg check)

Items requiring judgment (voice, language match, tone, timing) stay
in the human-checked list above.

Run: `npm run check:outreach <file.txt>` (script exits non-zero on
any failure; surfaces specific check that failed).

## When this skill should grow

After each wave post-mortem, look at "what failed that the checklist
should have caught." Add as a new bullet under the appropriate
section. The checklist that doesn't grow is the checklist that
stops working.

Don't add rules speculatively. Real failures only.
