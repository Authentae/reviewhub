# Onboarding email sequence — audit (2026-05-05)

Read every email at `server/src/lib/email.js:ONBOARDING_STRINGS` (Day 0
/ 1 / 3 / 7 / 14). Honest critique below.

## Headline verdict

**These are better than 90% of SaaS onboarding emails I've seen.** Real
founder voice, low pressure, clear CTAs. Day 3 ("cafe story") and Day
14 ("one last thing") are particularly strong. No major rewrites
needed. Five small wins below.

## Per-email scorecard

### Day 0 — Welcome (B+)
**Working:** 3-step numbered orientation, pitches the audit funnel as
free + no-upsell, "I read every one" personal sign-off.
**Weak:** "Hi there" is generic — but we don't capture first name at
register, so the only fix is to ask for it (probably not worth the
extra signup friction). "Bangkok" sign-off is a tasteful founder
signal but could be stronger if it linked to /audit explicitly.

### Day 1 — Stuck on setup (B+)
**Working:** Acknowledges the most common drop-off point (platform
connection), gives platform-specific guidance, offers an explicit
opt-out ("Not for you? Reply with one word").
**Weak:** "Search 'transfer Google Business Profile ownership'" tells
the user to leave the email. Could link to a specific guide we host.

### Day 3 — Cafe story (A)
**Working:** This is the best email in the sequence. Specific story,
actual draft text shown verbatim, real outcome (DM → 5-star edit).
Sells the product without feeling like a pitch.
**Weak:** Story is anonymous. A pseudonymous attribution ("a Sukhumvit
café we work with") would make it feel less like a stock testimonial.

### Day 7 — Free vs Starter (B−)
**Working:** Honest plan comparison, "Most owners hit the free-tier
AI cap around week 2" social proof, pressure-free CTA.
**Weak:** Too dense. 4 plans × 4 features each = a wall of text in an
inbox. Real readers skim past walls of text. Could be cut to "FREE: 3
replies/mo, STARTER: $14, unlimited replies + alerts" and link to the
new /pricing anchor block we shipped today.

### Day 14 — Goodbye (A)
**Working:** 4-bucket survey is brilliant — turns churn risk into
user research. "I read every reply and the answers shape what I build
next" is real founder humility. Last-email promise actually keeps the
unsub rate down.
**Weak:** Nothing significant. Don't touch this one.

## Five small wins (in order of payoff/effort)

1. **Day 7 — trim the plan list** and link to /pricing. We just shipped
   a strong pricing-context anchor; let it do the heavy lifting. Email
   should be a teaser, not a comparison sheet.

2. **Day 1 — link to a hosted Google ownership-transfer guide** instead
   of telling them to Google it. We don't have one yet → that's a TODO.
   Either write a short blog post (`/blog/transfer-google-business-
   ownership`) or link Google's official help page.

3. **Day 3 — pseudonymous attribution** for the cafe story. "A
   Sukhumvit café we work with" or "@beanholic" if real, or
   pseudonymous if not. Adds 5% authenticity, costs nothing.

4. **Day 14 — add a fifth bucket: "It worked, just unsubscribing from
   tips"**. Some users will be happy customers who just don't want
   weekly emails. The current 4-bucket survey forces them into a "no"
   bucket they don't fit.

5. **All emails — capture first name at signup** (NOT NOW). Adds
   signup friction. Only worth it after PMF, when you have data
   showing personalisation lifts retention. Defer 6 months.

## What I'm shipping now

Win #1 (trim Day 7) is a clean win — high payoff, no dependencies,
EN+TH+ES+JA all need updating but each is a small block. Will ship
as part of this same batch.

The other 4 wins go into [docs/operating-queue.md](docs/operating-queue.md)
under WEB or CONTENT for the founder to pick from.

## What's already good and shouldn't be touched

- The 5-email cadence (0/1/3/7/14). Don't make it longer or more frequent.
- The "I read every reply" sign-off on Day 0. That's the trust anchor.
- The 4-bucket churn survey on Day 14.
- The Day 3 cafe story narrative arc. Just pseudonymously attribute it.
- The "Not for you? Reply with one word" opt-out on Day 1.
