# LINE-native pivot — strategic context + ship plan

Drafted 2026-05-09 after Earth pressure-tested the question *"why am I
thinking LINE notifications are the killer move?"*

The agent did real research (LY Corporation data, competitor feature
comparison, Birdeye/Podium/NiceJob review). The data validated Earth's
intuition stronger than expected.

This document is the **strategic frame + ship plan** for the LINE-
native pivot. The actual artifacts:

- [`hero-copy.md`](./hero-copy.md) — landing-page hero copy variants
  (3 options + recommendation)
- [`wave-5-pitch.md`](./wave-5-pitch.md) — Wave 5 outreach pitch
  (TH + EN, with LINE notification as headline)
- *Future:* `audit-preview-variant.md`, `line-oa-integration.md`,
  `wave-5-prospect-list.md`

---

## The thesis

> **ReviewHub is repositioned from "global AI review-reply SaaS" to
> "Bangkok-native review tool that fits how Thai SMBs actually work
> (i.e. via LINE, not via Slack/email)."**

This is a NICHE-DOWN move, which is correct strategy at pre-revenue.
"Bangkok hospitality 200+ reviews on LINE" is sharper than "global
SMBs with reviews."

## Why this is defensible

**Market data (researched 2026-05-09):**
- 54M Thai LINE users = 80%+ of population
- 92% of Thai internet users use LINE *weekly*
- 70%+ follow at least one brand/business account
- Thai e-commerce is structurally conversation-driven (per LY Corp)
- LINE Official Accounts are infrastructure-level adopted (Social
  Security Office, Waterworks Authority, Ministry of Public Health all
  on LINE OA)

**Competitor data (researched 2026-05-09):**
- Birdeye: email, SMS, in-app, Slack ($299/mo entry)
- Podium: email, Slack, Teams ($289-549/mo) — customers complain about
  notification volume + slow response time
- NiceJob: in-app social proof popups ($75/mo)
- **Zero competitors do LINE.** Zero do anything SE-Asia-specific.
- Their roadmaps are Slack/Teams (US enterprise patterns). They have
  no incentive to localize.
- Localizing requires Thai business registration + LINE Developer
  account verification — structural barrier for foreign teams.

**Founder fit:**
- Earth is Bangkok-physical, has Thai entity (LINE OA registration
  is doable for him, near-impossible for US-based competitors)
- His network is Thai SMBs
- Thai-language competence + cultural fluency are structural moats
  for this audience
- Current marketing positioning (English-first, generic global SMB)
  doesn't match his actual customer access path

## What changes in the pivot

| Surface | Current | Pivoted |
|---|---|---|
| Landing page hero | "AI review replies in 10 seconds" | "รีวิวมาเมื่อไหร่ ได้รับแจ้งใน LINE ทันที — ตอบกลับใน 10 วินาที" |
| Audience targeting | Global English-speaking SMBs | Bangkok-area Thai SMBs |
| Pricing emphasis | $14/mo primary, ฿490 secondary | ฿490/mo primary, $14 secondary |
| Competitive set | Birdeye, Podium, NiceJob, etc. | Nothing — first Thai-native review tool |
| /vs/ pages | Currently primary nav | Demoted to secondary nav (irrelevant for Thai market) |
| Product roadmap | "AI drafts" as headline feature | "LINE notification + AI drafts" as headline |
| Kill-switch threshold | 1 paying customer in 60 days | Same — but LINE pivot creates clearer path to that signal |

## What the pivot does NOT change

- Free tier stays at 3 drafts/month
- Paid tiers stay at $14/$29/$59 (with baht equivalents prominent)
- The audit-preview funnel concept (send free draft to prospect,
  ask for signup) remains
- The 60-day kill-switch deal stays locked
- Wave 4 sends Tue/Wed as planned (current pitch — the pivot affects
  Wave 5 onward, not Wave 4)

## Ship plan (sequenced)

### Day 1 (today, 2026-05-09) — Strategic + copy

- [x] Research validation done
- [x] Hero copy variants drafted (`hero-copy.md`)
- [x] Wave 5 pitch drafted (`wave-5-pitch.md`)
- [ ] Audit-preview hero variant copy
- [ ] LINE OA integration scaffold (server-side webhook receiver
  behind feature flag — does nothing yet, just deploys safely)

### Day 2-3 — Code + landing

- [ ] Landing.jsx hero rewrite — Variant A (Thai-first)
- [ ] Pricing.jsx baht-first toggle default ON for Thai locale
- [ ] /line page (waitlist signup capture)
- [ ] AuditPreview.jsx alt-CTA mentions LINE notification roadmap
- [ ] Test changes locally + production deploy

### Day 4-7 — Wave 5 outreach + waitlist

- [ ] Mine Wave 5 prospects (10 new, with LINE-pitch lens applied
  during prospect selection)
- [ ] Generate audit URLs for Wave 5
- [ ] Send Wave 5 (Tue 5/13 next-week 9-11am ICT) using
  `wave-5-pitch.md` LINE-native pitch
- [ ] Track waitlist signups + audit-URL views

### Day 8-14 — LINE OA integration if signal

- [ ] Decision point: does Wave 5 + waitlist signal demand for LINE
  notifications? Threshold = 3 waitlist signups OR 1 reply mentioning
  LINE OR 50%+ open rate vs Wave 4
- [ ] If yes: ship LINE OA integration (LINE Login OAuth + webhook +
  Flex Message templates)
- [ ] If no: revert positioning, the LINE pivot was the wrong call,
  evaluate why before next move

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| LINE pivot doesn't lift conversion | Medium | Wave 5 metrics decide within 7 days |
| LINE OA integration takes longer than 14 days | Medium-high | Ship behind feature flag; landing positioning works without integration for first 14 days (waitlist) |
| Existing English-speaking prospects feel abandoned | Low | English copy stays available via locale toggle; the pivot is positioning, not exclusion |
| Confirms "Thai-only" positioning, limits future US/global expansion | Low | Niche-down at pre-revenue is correct; expansion follows revenue |
| Foreign competitor copies the move | Very low | Structural barrier (Thai business registration, LINE Developer verification, Thai language fluency) |
| Pivot pulls focus from Wave 4 (in-flight) | Medium | Wave 4 sends Tue/Wed regardless; pivot affects Wave 5 onward |

## What Earth signs off on by approving this plan

1. The repositioning moves from "global English SaaS" to "Bangkok-native
   tool" — irreversible-ish for at least 30 days. Reverting after the
   landing-page change costs another day of work.
2. Committing to ship LINE OA integration within 14 days IF Wave 5
   produces signal. Not committing until signal is fine; not shipping
   AFTER promising in Wave 5 pitch is brand damage.
3. The kill-switch (2026-07-08, 1 paying customer) stays. The pivot
   doesn't extend the runway — it's a sharper bet within the same
   timeline.

If any of these feel wrong, push back BEFORE we ship Day 2-3 code
changes. Once landing.jsx hero changes, we're committed for at least
30 days.

## What's NOT in this plan (deliberate)

- **Telegram support.** Wrong market for SE Asia. Skip.
- **Building LINE OA integration before Wave 5 sends.** Pitch tests
  positioning; positioning + waitlist signups validate demand;
  validation triggers build. Don't build before pitch validates.
- **/vs/ pages content rewrite for Thai competitors.** None exist
  worth comparing to. The pages just demote in nav, content unchanged.
- **Founder conversations with Thai SMB friends.** Those are confirmatory,
  not blocking. Earth can do them in parallel as Wave 5 runs. Removing
  the gate per agent's earlier deference correction.
