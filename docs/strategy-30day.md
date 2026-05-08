# 30-day strategy — 2026-05-08 → 2026-06-07

**Stage:** Pre-revenue solo. ~50 commits today (2026-05-08), 30+
blog posts, 5 /vs pages, audit funnel built, $0 MRR.

**The one question:** what gets us from $0 to $1 MRR fastest?

Everything else is decoration.

---

## Where we actually are (the data, not the vibes)

- **Audience-fit confirmed.** Wave 2 hit 3/3 opens (100%), Wave 1
  hit 1/9 (~11%). Bangkok hospitality 200+ reviews IS the segment.
- **Pitch is the bottleneck.** Wave 2 hit 0/3 replies. Opened-but-
  no-reply means the audit URL → reply path isn't compelling enough.
- **Channel works.** Email from earth.reviewhub@gmail.com to
  verified owner addresses lands and gets opened. No need to pivot
  to LINE/IG yet.
- **One Wave 1 prospect bounced** (Baan Sukhumvit, yahoo.com
  address not found) — discovered 2026-05-08 inbox check. Wave 1
  was effectively 1/8, not 1/9.

This isn't a marketing problem. It's a **conversion problem** —
specifically a "first customer" problem, not a "scale" problem.

## The single bottleneck

Three Bangkok hotel/hostel owners have the audit URL open in a
tab right now. One of them is closer to a "yes" than anyone we've
ever sent to. **That's where strategic attention belongs for the
next 7 days.** Not the next blog post. Not the next /vs page.

If we get one paying customer in the next 14 days from those three
(or their Wave 4 successors), we have:
- A real "this works" story for the homepage
- A real testimonial (the only kind allowed per honesty gate)
- A real customer-development loop (their feedback, not our guesses)
- Permission to stop building speculatively

If no customer in 30 days, real signal that the audit-preview-to-
reply path is broken — fix it before scaling outreach.

---

## The 30-day plan

### Week 1 (this week — Wave 2 maturation)

> **Date-label correction (2026-05-08):** earlier rows used Thu/Mon
> labels but May 8 is Friday and May 12 is Tuesday. Dates below are
> the source of truth; day-of-week labels in older entries are off.

| When | Action | Status |
|---|---|---|
| Fri 5/8 | Watch earth.reviewhub@gmail.com inbox until Wave 2 reply window closes (~16:00 ICT). | ✓ Done — 0 replies. |
| Fri 5/8 | Refill outreach-queue.md with 10+ Bangkok hospitality 200+ reviews prospects. Verify owner emails live. | `[in-progress]` — `wave-4-candidates.md` has 12 candidates; agent pre-researching websites + emails 2026-05-08 to reduce Earth's verification time. |
| Fri 5/8 | Audit-preview measurement: Plausible tagged-events on register CTA. | Script tag wired in HTML. **Plausible.io account parked 2026-05-08.** We already have server-side `audit_previews.view_count` + Railway logs for "did they open." Click-tracking only matters for Scenario A A/B test in Week 2 — and if that activates, ship a server-side `/api/audit-clicks` endpoint (~30 min) instead of Plausible. No third-party needed. |
| Tue 5/12 | Send +3-day follow-ups to Wave 2 (Old Capital, Loftel 22, Chakrabongse). | ✓ Scheduled in Gmail for 10:00 AM ICT 2026-05-12. |
| Tue 5/12 | Send +5-day follow-up to Pink Chili (Wave 1 sole opener). | ✓ Scheduled (Pink Chili gets the customer-dev TH variant since Wave 1 was customer-dev cohort). |
| Tue 5/12 | Send 9 customer-dev emails to Wave 1 cohort. | ✓ All 9 scheduled (4 TH: Pink Chili, House of Taste, Better Moon, Sweets Cottage / 5 EN: Vera Nidhra, White Ivory, Tingly Thai, May Kaidee, Aim House). Baan Sukhumvit excluded — bounced address. |
| Wed 5/13 | Send Wave 4 (10+ new Bangkok hospitality 200+ reviews prospects). | Blocked on outreach-queue refill — see `wave-4-candidates.md`. Agent pre-research Fri 5/8 evening; Earth verifies owner-reply ratios + finalizes Mon 5/11. |

### Week 2 (5/13–5/19 — pitch tightening)

By end of Week 1 we'll know: did Wave 2 follow-ups convert? Two
scenarios.

**Scenario A — still 0/3 replies + 0 from Pink Chili + Wave 4
numbers come in:**

- Audit-preview page has a real conversion problem. Ship 2 CTA
  variants (e.g., "Have ReviewHub draft these next time" vs
  current "Get this for your business"). 50/50 split on new audit
  URLs. Need ~20 audits sent to see signal — Wave 4 + 5 worth.
- Send small Wave 3.5 batch (3-5 prospects) via LINE OA or
  Instagram DM to SAME audience type. If LINE > 0% reply where
  email = 0%, channel was the issue.

**Scenario B — 1+ reply from Wave 2 follow-ups:**

- Drop everything. Run `docs/skills/first-customer-playbook.md`.
  Hour 0 ack, Hour 4–24 setup walkthrough.
- Single most important thing: do NOT screw up the conversion.
  No 12-hour delays, no generic email, no upsell.

### Week 3 (5/20–5/26 — real-data mode)

By end of Week 2 we'll have view + reply data across 15-25
prospects — sample large enough to see patterns.

- **If Scenario B happened (paying customer):** strategic question
  becomes "what does customer #1 need that we haven't shipped?"
  Their feedback IS the roadmap. Every other priority drops.
- **If still no customer:** the 4-week plan was wrong. Pause
  outreach. Run 5 customer-development conversations with Wave 1+2
  non-responders. Different problem entirely.

### Week 4 (5/27–6/7 — decision point)

By Day 30 we should know:

1. **Yes, paying customer.** → Strategic plan flips to retention +
   customer #2. New plan needed.
2. **No, but audit-preview view-to-reply rate moved from 0% to >0%
   with the CTA variant.** → Pitch was the problem. Keep iterating.
3. **No, view-to-reply still stuck at 0%.** → Either the product
   isn't solving the problem the audit suggests it does, OR the
   "200+ reviews owners who open cold emails" segment isn't a
   segment that converts in <30 days. Real strategy reset needed.

---

## What NOT to do for 30 days

This is the harder half. Listed by ranked temptation:

| Don't | Why not |
|---|---|
| Ship more blog posts | We have 30. Marginal post moves nothing measurable. SEO compounds in months, not weeks. |
| Ship more /vs pages | Same. The 5 we have is enough. |
| Build new features | We have a product. Adding features without customer feedback = guessing. |
| Have the agent auto-post to X via Chrome MCP | Voice mismatch (it's Earth's account, not the agent's), identity-rule violation (CLAUDE.md), and posting cadence isn't an agent attention sink the strategy can afford. **But Earth posting himself is fine and encouraged** — 14 drafts ready in `docs/launch/x-first-week-posts.md`, 60 sec/post from his phone. The "no story to tell" reasoning is now stale: Wave 2 100% opens, audit-funnel iteration, 12 sends Tuesday IS the story. |
| Set up LinkedIn / Reddit / IndieHackers as new channels | Different from X — these need brand-new account setup, time on platform building presence. X account already exists; LinkedIn/Reddit don't. Defer until X is producing real engagement signal. |
| Run another autopilot blog-post sprint | 50-commit days are visible-productivity, not customer-productivity. Use saved hours for outreach + Wave 2 inbox watching. |
| A/B test 5 things | A/B testing requires traffic volume we don't have. Pick the ONE highest-leverage variant (audit-preview CTA, post-Wave-2) and ship that. |
| Refactor / cleanup | Codebase is fine. 0 customer-value from refactoring. |
| Add another free tool | content-writing.md §10: don't add #N+1 unproven. |
| Build /vs/{some new competitor} | The 5 we have are sufficient. Stop. |

## When to pivot vs when to hold

The plan has explicit decision points (Day 7, 14, 30). Halfway-
through pivots are **part of the plan when driven by data**. Only
failure mode is pivots driven by mood.

| Pivot triggered by | Cost | When to do it |
|---|---|---|
| New real signal (customer reply, view-rate data, prospect feedback) | Low — the plan was a bet, the data is what we wanted | Always |
| New anxiety / FOMO / shiny object | High — re-orient queue, lose continuity, usually still don't know if original plan worked | Almost never |

The question isn't "what if we change halfway." It's **"what would
have to be true to make us change."** If the answer is "Wave 2
produces unexpected signal" — fine, plan working. If the answer is
"I read about a new SEO trick" — resist.

## The first-customer trigger plan

When (not if) the first "tell me more" reply lands:

| Time after their reply | Action |
|---|---|
| 0–5 min | Read the reply twice. Don't write yet. |
| 5–15 min | Reply using `audit-outreach.md` §6 warm-response template (EN/TH). Personalize first sentence to whatever they said. Don't pitch. Don't qualify. Just give the path: `/register?from=audit&business=…` |
| 15 min – 24 hr | Watch for them to sign up. Attribution flow logs `from=audit` so signup is tagged. |
| When they sign up | Email Hour-1 welcome (in `first-customer-playbook.md`). Watch their account in `/admin/users` — confirm they connected Google, see their first AI draft. |
| When their first AI draft lands | Email "saw your first review came in — let me know if the draft missed anything obvious." Single most important moment of the relationship. They're judging the product right now. |
| Within 24h of signup | Offer a 15-min "is this working?" call. Optional, low-pressure. Real signal: what do they NOT love. |

## Success measure (Day 30)

**One number: did somebody pay us, yes or no.**

Not "how many leads," not "open rate," not "content shipped."
Pre-revenue solo at this stage has exactly one valid KPI.

Secondary signals (Day 30 retrospective only, not daily decisions):
- Wave 2 + Wave 4 combined open rate (target: >70%)
- Wave 2 + Wave 4 combined audit-URL view-to-reply rate
  (current: 0%, target: >5%)
- Number of `from=audit` signups (any positive number is a win)

---

## What happens if the plan needs to change

Update this doc with the date, what changed, and the data that
drove the change. Don't silently abandon. Future-agent (or
future-Earth) will re-derive the same wrong path otherwise.

Format for changes:
```
### 2026-MM-DD — [what changed]
**Driven by:** [data point — must be specific, falsifiable]
**Old direction:** [what we were doing]
**New direction:** [what we're doing instead]
**Why:** [the reasoning — 2 sentences]
```

### 2026-05-08 — Wave 2 + Wave 1-customer-dev sends moved to Tue 5/12 + audit-preview measurement shipped
**Driven by:** Wave 2 reply window closed at 16:00 ICT 2026-05-08 with 0/3 replies (per inbox check). Strategy doc's "still 0 replies" branch (Scenario A, Week 2) requires audit-preview CTA-variant A/B, which requires conversion measurement — we had none.
**Old direction:** Send follow-ups + customer-dev manually Mon morning. No instrumented funnel for the post-Wave-2 CTA-variant ship.
**New direction:** All 12 emails (3 follow-ups + 9 customer-dev) schedule-sent in Gmail for Tue 5/12 10:00 AM ICT — fires without further action. Plausible tagged-events instrumented on the audit-preview register CTA so Wave 4 conversion data starts flowing the moment Plausible.io is activated (`[wait:user]`, 5-min sign-up).
**Why:** Both moves are pure execution of the existing plan, not pivots. Schedule-send removes Mon-morning friction; tagging the CTA is the prerequisite for the Scenario A CTA-variant ship (Week 2) and costs nothing if Scenario B happens instead.

### 2026-05-08 — Tunnel-vision course correction
**Driven by:** Earth flagged that the agent was proposing X posting / LinkedIn / free-tools / dashboards while the strategy doc explicitly forbids those at this stage ("0 followers + week-1 brand awareness ≠ paying customers"; "channels without a story to put in them are noise"; "don't add another free tool").
**Old direction:** Agent was about to ship a "free Google Reply Generator" lead magnet as the next high-leverage item.
**New direction:** Re-anchor on the strategy doc. Next agent-shippable item per Week 1 row: pre-research Wave 4 candidates (websites + emails) to reduce Earth's verification time before Wed 5/13 send.
**Why:** Strategy doc's CLAUDE.md anchor ("strategy supersedes the queue when they conflict") exists exactly for this failure mode — agents drift toward visible-productivity work when the customer-acquisition path is slow. Wave 4 pre-research IS in scope; the rest was pivot-driven-by-FOMO.
