# Audit-preview page friction teardown — 2026-05-11

**Why this doc exists:** Wave 1+2 data names this page as the conversion
bottleneck. 4 of 4 prospects who opened the page didn't reply — including
Chakrabongse, who opened it 14 times. The drafts work (people read them).
The signup path doesn't (nobody clicks). This is a heuristic UX teardown
of `client/src/pages/AuditPreview.jsx` against what we know about the
target prospect (Bangkok hospitality owner, 40-60yo, 200+ Google reviews,
likely already paying SOMEONE for review management or doing it ad-hoc
themselves).

Read the page in the prospect's shoes. Their question isn't "should I sign
up" — it's "is this person legit and is this product better than what I
already do?" The page has to answer the second question before the CTA
can land.

---

## What the page does well

1. **Personalization is real, not theatrical.** The header says "Reply
   suggestions for {business_name}" and the cards show the prospect's
   actual reviews with actual draft replies. This is the "wait, this is
   real" moment that explains the 100% open rate among hospitality
   prospects (Wave 2 data).
2. **No-account-needed pattern.** "Just copy & paste — no account needed"
   in the header lowers the perceived ask. Contrast with most SaaS
   landings where step 1 is signup-wall.
3. **CTA timing.** The teal CTA panel appears AFTER the drafts, not
   before. Prospect gets value first, ask second. Correct sequencing.
4. **Honest pricing.** "$14/mo (~฿490)" stated explicitly in the CTA.
   No "request a quote" friction. No surprise pricing on the next page.
5. **30-day refund + cancel-anytime** disclosure right under the CTA
   button. Reduces commitment anxiety.
6. **Footer alt-CTA** — "Not ready? Just reply to my email" — gives
   the not-yet-buyer a no-commitment exit path. Right instinct.
7. **Sticky conversion bar** — appears after scroll, ensures the CTA
   is always within tap reach for mobile. Solves the buried-CTA problem.
8. **30-day link expiry** mentioned explicitly. Mild urgency without
   manufactured scarcity.

---

## Where the page leaks engaged readers

These are ranked by how likely each is to explain the Chakrabongse 14×
view-no-reply pattern.

### #1 — The page assumes high-intent "ready to buy" prospects

**Symptom:** the only conversion path is `/register?from=audit&...`. A
prospect who is interested-but-not-yet-decided (the median state for
a 14×-viewer) has only two paths: sign up (high commitment) or close
the tab. The footer "reply to my email" alt-CTA exists but is below
the giant teal CTA card AND below the 5-item FAQ — the engaged reader
who got there has already mentally moved past the conversion moment.

**What's likely happening with Chakrabongse:** she read the drafts
(✓), read the CTA, scrolled to FAQ to check legitimacy, opened a few
FAQs, didn't see anything that closed the deal, and tab-closed. Came
back hours/days later, re-read drafts, didn't see new info, tab-closed
again. 14 times. The page has nothing to escalate her engagement past
"these drafts are good" → "but I'm not sure about the rest of it."

**Intervention:** add a mid-page "low-commitment next step" between
the drafts and the giant teal CTA. Something like "Want to try the
LINE notification flow before signing up? Send me a message at
[link to founder LINE OA / WhatsApp / email] and I'll set up a
test connection for free." The point isn't the specific offer — it's
that there must be a "yes, but" option between "no" and "sign up
right now."

### #2 — No social proof + zero "who else uses this"

**Symptom:** the page doesn't say a single word about other customers,
testimonials, or even number-of-businesses-using. Pre-revenue means
this is honest — we have nothing to claim. But the reader doesn't
know that. They assume absence = "this is brand new and untested."

**What's likely happening:** Chakrabongse runs a heritage property
that's been around 25+ years. She's risk-averse on tech vendors.
She doesn't want to be vendor #1 for someone who might disappear.

**Intervention:** add a "we're new and that's the trade" line near
the founder-note. "I'm Earth, the solo founder. ReviewHub launched
April 2026 — that means you'd be among my first 50 customers, get
direct founder access, and your feedback shapes what ships next.
If you'd rather wait for a proven vendor, that's fair — Birdeye and
Podium have been around longer." Honesty as a feature.

### #3 — The "differentiator" claim is invisible

**Symptom:** the CTA paragraph says "Connect Google once. New reviews
ping you on LINE — with an AI-drafted reply in your voice." The two
real differentiators (LINE notification + matches your voice) are
delivered as a parenthetical mid-sentence. A skim-reader sees "AI
drafts replies" — same value prop as Birdeye et al.

**Intervention:** make differentiator EXPLICIT and SHOWN, not stated.

- A small "How this is different from Birdeye / agency" 3-bullet
  comparison BELOW the CTA. Three bullets max:
  - "We ping you on LINE; they email you"
  - "We learn your voice from your past replies; they use a template"
  - "We're $14/mo + cancel anytime; they're $99-300/mo + annual contract"
- A 1-screenshot mock of what a LINE notification looks like
  (current copy mentions LINE 2× but doesn't show it).

### #4 — Founder voice is in the footer, not the body

**Symptom:** "I'm Earth, the solo founder building this in Bangkok"
is in the footer paragraph that starts with "Not ready to sign up?".
A reader who got value from the drafts and is wondering "who built
this" only finds the answer if they scroll past the FAQ. Solo-
founder authenticity is the single biggest moat we have vs SaaS
chains; burying it is wrong.

**Intervention:** move "I'm Earth" to right BEFORE the teal CTA card,
not the footer. Phrase it as a personal note: "Drafts above are AI-
generated. The product, the email you got, this page — all me. I'm
Earth, building ReviewHub solo from Bangkok. Ask me anything." Then
the giant teal CTA. Then the FAQ.

### #5 — No screenshot of the LINE flow

**Symptom:** the page says "New reviews ping you on LINE" but doesn't
show what that looks like. For a feature that's the differentiator,
text-only is weak.

**Intervention:** below the CTA, a single screenshot mock: phone
showing a LINE OA message with a Flex card containing the review +
AI draft + Copy button. Could be a dev-mode screenshot from Earth's
own LINE account. ~30min to ship.

### #6 — No "what if I already have someone managing this" path

**Symptom:** Chakrabongse probably already has a marketing
agency/intern handling Google reviews. The page doesn't acknowledge
the "I already have someone" objection.

**Intervention:** add it as the first FAQ item. "I already have
someone managing my Google reviews" → "Then ReviewHub is a tool
they'd use, not a replacement for them. The drafts cut the time-per-
review from 5 minutes to 30 seconds, and the LINE notifications mean
nothing slips through. If your person is happy doing it manually,
that's fine — keep them. If they're complaining about volume, this
helps."

### #7 — Pricing context is single-tier-only

**Symptom:** the page mentions $14/mo. Doesn't mention that's the
ENTRY tier; doesn't mention there are higher tiers for multi-location
or higher review volume. A 200+ reviews property might think "$14
sounds cheap, what's the catch?" or "$14 is for a single-location;
I have 3 properties, this isn't built for me."

**Intervention:** below the CTA, one line: "$14/mo is Starter (one
business, AI drafts). Pro ($29) for multi-location. Full pricing
at /pricing." Single sentence, link to detail page, removes the
implicit catch.

---

## Recommended ship order (when Wave 4 data confirms the problem)

Day 1 (~2 hours of work):
- **Move founder note UP** to between drafts and CTA (intervention #4)
- **Add 3-bullet differentiator** below CTA (intervention #3)
- **Add "I already have someone" FAQ** as first FAQ item (intervention #6)
- **Add pricing-tier hint** under CTA (intervention #7)

Day 2 (~2 hours):
- **Add LINE notification screenshot** below CTA (intervention #5)
- **Add "we're new and that's the trade" honesty paragraph** (intervention #2)

Day 3 (~30min):
- **Add mid-page low-commitment-next-step** between drafts and CTA (intervention #1)
  This is the most-leverage but also the highest-design-risk; consider
  shipping after #4-#7 to isolate which intervention moved the needle.

---

## What to MEASURE after shipping

The Plausible `AuditRegisterClick` event already fires on the CTA. Add:
- `AuditFooterReplyClick` — fires on footer "reply to my email" click
- `AuditFAQOpen` — fires on FAQ expand (which questions get expanded
  most often = which objections are top-of-mind)
- `AuditScrollDepth` — fires at 25%/50%/75%/100% milestones

Without these we ship UX changes blind to which intervention worked.
~1 hour to ship the events; pre-requisite for any A/B.

---

## What this teardown is NOT

- Not a finished spec — every intervention should be A/B'd against
  control, not shipped wholesale. The page already converts SOMEHOW
  (else our 100% open + 0% reply wouldn't be statistically real
  signal — readers ARE paying attention).
- Not a claim that all 7 interventions are right. Pick 1-2, ship, measure,
  iterate. Shipping all 7 at once gives no causal information.
- Not a substitute for talking to the prospects directly. The
  highest-value next move remains: get one of the 4 engaged readers
  to TELL us what stopped them. The Tue 5/12 follow-up to Chakrabongse
  is that conversation; this teardown is the contingency plan if that
  follow-up gets no reply.
