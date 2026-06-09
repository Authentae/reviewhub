# Content + conversion roadmap (passive-income loop, 2026-06-08)

Data-backed roadmap so SEO-content cycles target REAL search demand, not guesses.
Built from competitive/keyword research during the passive-income /goal loop.

## Positioning validation (good news)
Independent 2026 guides converge on one consensus for getting more reviews:
**automate the ask, send it via SMS, time it within ~2 hours of the service.**
- "SMS review requests convert **3-5× better than email**."
- "Automated text 30-60 min after job completion is the highest-converting
  single tactic."
- "Conversion drops sharply after the first 24 hours."

That consensus IS ReviewHub's mechanism (automatic, timed follow-up with a one-tap
link). Our product + content are aligned with what the market already believes
works — we don't have to convince anyone the method works, just that we do it well.
Implication: lean into **SMS + timing + automation** in copy and content.

## Content backlog — ranked by (search intent × proven demand × fit)
Proven demand = competitors already rank with these; high intent = searcher wants
to act. Write ONE per content cycle, template-matched, global, honest.

1. **Review request templates (SMS + email)** — HIGHEST. Competitors rank with
   "75 templates", "32 templates", "18 templates" listicles → proven volume +
   high intent. Give genuinely usable copy-paste templates by business type
   (clinic, salon, restaurant, home service, retail), honest (no incentives),
   each ending with the automation tie-in. Slug idea: `google-review-request-templates`.
2. **Best time to ask for a Google review** — timing is the consensus lever;
   clear intent. Cover same-day / within-2-hours, by business type. Slug:
   `best-time-to-ask-for-a-google-review`.
3. **Google reviews via SMS (why it beats email)** — directly maps to our channel
   strength; competitors actively publishing this in 2026. Slug:
   `get-google-reviews-via-sms`.
4. **How many Google reviews do you need?** — benchmark/data angle, high informational
   intent, links naturally to "so here's how to get them". Slug:
   `how-many-google-reviews-do-you-need`.
5. **QR code post** — DONE (2026-06-08, `how-to-make-a-google-review-qr-code`).
6. **Flagship get-reviews guide** — DONE (`how-to-get-more-google-reviews`).

Internal-linking rule: every new get-reviews post links to the flagship + 1-2 siblings.

## Conversion / product findings (for Earth or an account-access session)
- **Onboarding activation step is REPLY-focused, not get-reviews.**
  `client/src/components/OnboardingChecklist.jsx` steps = account → name business →
  reviews come in → **respond to a review**. The final "activation" milestone is
  replying (the bonus), but the product's main value + the passive-income engine is
  **sending review requests** (`/review-requests`). A new user who follows the
  checklist learns to reply, not to get reviews. **Fix:** make "send your first
  review request" the activation step (needs a `hasSentRequest` signal + the
  /review-requests CTA). NOT done here because it renders only behind login —
  can't verify end-to-end without an account (auth is off-limits in the loop).
  High-value: time-to-first-review-request is the retention/passive-income lever.

## Sources
NetReputation, FunkLevis, Referrizer, DigitalStudios, Google Business Profile Help
(get-reviews 2026 guides); Sakari, ReviewCatalyst, Textedly, Synup, Apptoto, Textline
(SMS review-request best practices + templates).
