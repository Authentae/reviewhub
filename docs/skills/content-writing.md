# Content writing — the meta-skill for anything customer-facing

This is the skill I (the agent) consult BEFORE writing any customer-
facing prose: blog posts, landing copy, changelog entries, free-tool
copy, marketing-page text, public announcements, screencast scripts.

It does NOT cover:

- Onboarding emails → [`onboarding-email.md`](onboarding-email.md)
- Cold outreach DMs/emails → [`audit-outreach.md`](audit-outreach.md)
  + [`thai-smb-outreach.md`](thai-smb-outreach.md)
- Social posts (X, LinkedIn, Reddit) → [`social-presence.md`](social-presence.md)
- Support replies → [`support-response.md`](support-response.md)

If what I'm writing fits one of those, I open that skill instead.
If it doesn't (or it spans formats), I read this one.

This skill exists because in 2026-05-06 → 05-07 I shipped three
content failures that the per-format skills wouldn't have caught:

1. A bio mentioning the Chrome extension, weeks after we'd dropped it
   (stale-input failure — the launch deck was old)
2. A typo'd audit URL in a Chakrabongse outreach email
   (no link-verification gate)
3. Five SEO surfaces in one autopilot block before pressure-testing
   whether SEO was the right channel for this stage
   (no stage-fit check)

All three are about *cross-format* discipline — voice consistency,
honesty gates, link verification, pressure-testing the brief — not
format-specific rules. That's what this skill covers.

---

## 1. The product I'm writing about (current as of 2026-05-07)

Update this section first if any line below is no longer true.

- **What ReviewHub is:** AI-drafted review replies in the owner's
  voice. Owner approves, ReviewHub posts to the platform. Google +
  60 other platforms via CSV. Web app — no Chrome extension, no iOS
  app, no Android app.
- **Who it's for:** SMB owners (Bangkok hospitality, cafés, salons,
  fitness, pharmacies, B&Bs) who get 30+ reviews/month and don't
  reply to most of them.
- **What it costs:** Free tier (3 AI drafts/month, 1 location, no
  scheduling), Starter $14/mo, Pro $29/mo, Business $59/mo.
  Monthly + annual. 14-day refund, no trial. **Pricing source of
  truth: `server/src/billing/plans.js`. Never quote pricing from
  any other file.**
- **Where it lives:** https://reviewhub.review (Cloudflare-fronted,
  Railway-hosted).
- **What we DON'T have yet:** any paying customers, brand recognition,
  case studies, social proof, integration partners, an iOS/Android
  app, a Chrome extension. Anything claiming we have these = a
  lie. Pre-revenue = the truth, not a stigma.
- **What's working in outreach right now:** Bangkok hospitality 200+
  reviews via personalized audit URLs (Wave 2-3). Mail-tester
  scored 8.2/10 (inbox-tier). Cooking schools (Wave 1) didn't reply
  — wrong audience, not deliverability.

---

## 2. Voice — brand vs founder

There are TWO voices on customer-facing surfaces, and they don't
overlap. Mixing them is the most common content failure.

### Brand voice — "ReviewHub"

Used for: blog posts, landing/marketing pages, changelog, free-tool
copy, social posts, public announcements.

- Speaks as the product. Never "I", never "me", never "our founder".
- Calm, helpful, specific. Same register as Instrument Serif
  headlines + plain-prose body on reviewhub.review.
- Has opinions ("'Thank you for your feedback' on a 1-star review
  reads as dismissal — be specific instead"), but never personal
  ones.
- No emoji unless explicitly requested.

### Founder voice — "Earth"

Used for: onboarding emails (Day 0/1/3/7/14), cold outreach replies,
direct support replies, in-app messages signed by a person.

- First-person. "I'm Earth, the founder of ReviewHub."
- Bangkok-grounded. Real expectations. Real limitations.
- Signoff: `— Earth, ReviewHub · Bangkok`
- Never: "we", "the team", "our company" — there is no team yet.

### The split rule

If a reader could plausibly reply to it, it's founder voice. If it
sits on a page, it's brand voice. A blog post is brand. A "Day 1"
nudge in their inbox is founder. A free tool's button label is
brand. The reply they send back to that nudge is for me-as-Earth
to handle, not the brand.

If I'm unsure, I ask before writing. Conflating the two = the
"our founder Earth..." failure mode.

---

## 3. The honesty gate (pre-revenue rules)

Pre-revenue means we cannot claim:

- A customer count ("trusted by 1,000+ businesses")
- A category leader position ("Bangkok's top review platform")
- Testimonials we don't have ("loved by Bangkok's top hotels")
- Time-saved metrics from real customers ("our customers save 4 hours/week")
- Integration partnerships we haven't formalized
- Awards, press, "as seen in"

What we CAN claim, with proof:

- The product mechanics ("AI drafts a reply, you approve, we post it")
- Performance characteristics ("replies that took 30 minutes each
  take 30 seconds")
- Pricing (from plans.js)
- What the audit URL actually shows (real reviews from the prospect's
  Google listing, real draft replies from our prompt)
- Our location ("made in Bangkok") — true, founder is here

What we should LEAN INTO instead of fake social proof:

- Founder accountability ("if it breaks, you reach Earth directly")
- Stage-honesty ("I'm building this myself; you'll get my full
  attention")
- Specificity (a real example beats a fake testimonial)
- Mechanism (show the product working on their reviews via audit
  URL — that's stronger than any claim)

When I catch myself drafting copy that needs a fake number to work,
the copy is wrong, not the gate.

---

## 4. Pre-publish checklist (every customer-facing ship)

Before any blog post, landing page, free-tool launch, changelog
entry, or marketing copy goes live, every line below must be true:

```
[ ] Voice matches §2 (brand vs founder, never both)
[ ] Honesty gate passes (no fake numbers, no extension/iOS/Android
    references, no team-cosplay)
[ ] Every URL referenced returns HTTP 200 (curl -I or fetch in
    DevTools — never trust a URL transcribed from a screenshot)
[ ] Pricing matches `server/src/billing/plans.js` exactly
[ ] If EN content has a TH counterpart elsewhere, the new content
    has a TH version too (or a tracked TODO to add it within 7
    days)
[ ] Length matches format (blog 600-2400 words, landing-page card
    ≤80 words, free-tool button ≤4 words, changelog entry 1
    sentence + optional 1 detail)
[ ] No platform-specific claims that don't apply (e.g. don't say
    "works with Yelp" if Yelp ingestion is mocked-only)
[ ] If content references a competitor, the comparison is honest
    (acknowledge who they're right for, don't smear)
[ ] Build runs clean (`npm run build` in client) if the content
    ships in a JSX file
[ ] If new page: sitemap.xml + RSS feed (where relevant) updated
    in the same commit
```

If ANY line fails, fix it before commit. Never "ship it and patch
in a follow-up commit" — broken copy on prod is read by real
prospects.

---

## 5. The stale-input check

Before executing on a brief — a queue item, a launch-deck section,
a prospect note, a copy doc someone wrote weeks ago — I run this
30-second check:

> *"Does this brief match the product as it exists today? Would a
> sharp peer push back on the framing?"*

Examples of stale inputs that have caused failures:

- Launch playbook (`docs/launch/product-hunt.md`) was written when
  Chrome extension was the hero. Treating it as authoritative in
  2026-05-07 produced a bio with extension language. The playbook
  is now refreshed; the lesson is *check it, don't trust it*.
- Outreach queue (`outreach-queue.md`) had "send in English" notes
  for properties whose owners are Thai-script-native. Field
  observation, not a commandment.
- An audit URL in a screenshot looks correct because tokens are
  opaque. Transcribed URLs almost always have a typo. Always copy
  programmatically.

The signal: any time I feel "the file says X so I'll do X" without
actively considering whether X fits *this* situation, stop and ask.

---

## 6. Per-format structure

### Blog posts (SEO target, 600-2400 words)

Structure:

1. **Hook** (1-2 sentences) — a specific question the reader
   panic-Googled. Not "Welcome to our blog about reviews."
2. **The honest answer** (50-100 words) — what they actually need
   to know, up front. If they bounce after this, they got the
   answer.
3. **The playbook** (the bulk) — step-by-step or pattern-by-pattern.
   Specific examples. Real reply templates they can paste.
4. **What NOT to do** (50-150 words) — common mistakes and why
   they backfire. This is where ReviewHub's opinions show up.
5. **CTA** (1 sentence + button) — soft tie-in to the product.
   Not "BUY NOW", not "Sign up free" if there's no signup nuance.
   Match the tone of the post.

Examples that nailed this: `how-to-remove-google-review.html`,
`fake-extortion-google-reviews.html`, `transfer-google-business-
profile-ownership.html`.

### Landing / marketing page copy

Each section card answers ONE question in ≤80 words. Card titles
are Instrument Serif. Body is Inter. No section is "About us" —
every section earns the reader's scroll by answering the next
question they'd ask.

The home page sequence (current): What is it? → How does it
work? → Who's it for? → What does it cost? → How do I start?

Don't deviate from this pattern without a specific reason.

### Changelog entries

Format:

```
**2026-05-07** — One-sentence customer-facing summary.

Optional: one extra detail if there's nuance (e.g. "Available on
Pro+ tiers" or "EN + TH copy"). Never more than 2 sentences.
```

Every entry has both EN and TH. The page is bilingual; an entry
that's English-only signals "we forgot Thai users exist."

### Free-tool copy

Tools are SEO + outreach hooks. Copy rules:

- Tool name: one short noun phrase ("Reply Roaster", "Review
  Impact Scorer"). Not "ReviewHub Roaster Pro".
- One-line description on /tools page: ≤120 chars.
- Button label: 2-4 words ("Roast my reply", "Score this review").
- Result page: show the analysis, then ONE soft CTA back to
  audit/signup. Not five.

Examples that work: `/tools/reply-roaster`, `/tools/review-impact`.

### Marketing copy on external surfaces (Product Hunt, directories)

Use `docs/launch/product-hunt.md` as the seed, but pressure-test
it against §1 (current product state) before using it. Refresh
the seed file rather than carrying a parallel version.

---

## 7. EN / TH parity

Every customer-facing page has a Thai counterpart. Rules:

- **Don't literal-translate.** "Schedule a call with our team"
  → ขอนัดคุยสั้นๆ กับ Earth (founder voice — there's no team).
- **Don't ทับศัพท์ everything.** "Free tool" = เครื่องมือฟรี is
  fine. "Review Impact Scorer" stays English (proper noun).
- **Drop English social-formulas in Thai.** "ไม่กดดัน" implies a
  power claim from a stranger; just drop it. See
  `feedback_thai_pragmatics.md` in memory.
- **Word-break for Thai headlines.** CSS `word-break: keep-all`
  doesn't cover Thai. For long headlines, split into `<span
  style="white-space: nowrap">` chunks at sensible phrase
  boundaries.

If the EN version ships and the TH version is more than 7 days
behind, the page is broken. Same priority as a 500 error.

---

## 8. The "is this worth writing" filter

Before writing, ask:

1. **Stage fit.** Does this content move us closer to first paying
   customer, or does it just feel productive? (Pre-revenue priority
   filter from CLAUDE.md.)
2. **Compounding value.** Will this still work in 6 months? Blog
   posts that target evergreen searches → yes. "Look what we
   shipped this week" posts → no.
3. **Marginal cost vs marginal lift.** Yet another vertical-landing
   page when /for-cafes is unproven = no. Refining the audit-preview
   conversion when prospects are arriving = yes.
4. **Founder energy.** Some content needs Earth (60-sec screencast,
   case study). Don't ship a draft that requires founder time before
   confirming he has it.

If the content fails (1) or (3), surface it before writing. The
queue may be wrong.

---

## 9. The pre-write checklist for the agent

Before I (the agent) draft any customer-facing content, I run this:

```
[ ] Did I read this skill in the current session?
[ ] Did I confirm §1 (product state) is still accurate?
[ ] Voice: brand or founder? (Don't mix.)
[ ] Format: which §6 sub-section applies?
[ ] Stale-input check: is the brief matching today's product?
[ ] §8 filter: does this fit the stage / compound / earn its time?
[ ] §3 honesty gate: am I about to write something we can't back?
```

If any answer is "no" or "unsure", stop. Surface the question
before drafting.

---

## 10. When NOT to add another piece of content

Don't write piece #N+1 if pieces #1 through #N aren't validated:

- Blog post traffic via Plausible — if existing posts have <50
  views/week, write a 6th post = no. Improve the top 2 posts'
  CTAs first.
- Free tools — Reply Roaster + Review Impact Scorer first need
  usage data before tool #3. (Lesson from the Places API pause,
  2026-05-06.)
- Vertical landing pages — /for-cafes, /for-bars, /for-fitness,
  /for-pharmacies all exist; conversion data per page first
  before /for-spas etc.
- Comparison pages — three exist (/vs/birdeye, /vs/podium,
  /vs/reviewtrackers). Don't add a fourth without traffic data
  on the existing three.

The signal: when about to add another instance, ask *"is N=2 or
N=3 working yet?"* If unproven, fix the existing ones instead.

---

## 11. When to update this skill

- **Product state changes** (new tier, dropped feature, new
  platform): update §1 immediately.
- **Voice drift** (I read a piece I wrote and it doesn't sound
  like ReviewHub): re-read §2 and tighten the DO/DON'T.
- **A new content failure mode**: add it to §3 / §5 / §6 with
  the date and a one-line lesson.
- **Pricing changes**: §1 + every blog post that quotes pricing
  needs an audit. Stale pricing in published content = legal
  exposure.

This file is a living document. The sign of a healthy skill is
that it changes shape when the product changes shape.
