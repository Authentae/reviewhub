# Audit-preview page — conversion review (2026-05-20)

**Context:** 19 of 42 prospects opened the audit URL (45%). 0 of 19
openers replied. The deliverability is fine (45% open rate is healthy
for cold email); the conversion bottleneck is downstream — what they
see on the page.

This doc surveys the live audit-preview at `/audit-preview/demo` and
surfaces specific friction hypotheses, ranked by likelihood of being
the actual bottleneck.

---

## Top-of-page sequence (what a recipient sees in the first 3 seconds)

1. **Sticky banner (TOP):** *"Keep the drafts coming? New reviews ping
   you on LINE or Telegram. $14/mo (~฿499). [Keep the drafts — $14/mo →]
   [or reply →] ✕"*
2. **Title:** *"REPLY SUGGESTIONS FOR Common Grounds (sample cafe)"*
3. **Subtitle:** *"3 draft replies ready to copy & paste — no account
   needed."*
4. **Secondary CTA bar:** *"Want this on autopilot for new reviews? ·
   LINE or Telegram alert · tap to copy [See plan →]"*
5. Then the actual drafts (3 reviews × 3 tones each).

## Hypothesis 1 — "sales-page-not-help-page" smell (HIGH likelihood)

The FIRST thing a recipient sees is **"$14/mo"**. Before they see how
good the drafts are. This is a textbook conversion mistake — they
were promised "a small thought about your replies" in the email and
they land on a page that starts with a price tag.

**Effect:** instant defensive frame. Brain shifts from "let me see what
this is" to "this is sales, do I want to spend $14/mo?" — and the
default answer to "do I want to spend money" is "no, close tab."

**Fix to consider:**
- Move the sticky $14/mo banner BELOW the first draft, not above the title.
- OR replace the sticky banner with the soft bottom CTA ("just reply
  with one line — Earth").
- OR remove the sticky banner entirely. Let the prospect FIND the price
  after they've experienced the value.

**Test:** add a `?nosticky=1` URL flag to the audit URLs, A/B half the
remaining prospects with/without the sticky. Compare engagement vs reply.

---

## Hypothesis 2 — too many CTAs (HIGH likelihood)

The page has **9+ different CTAs:**

1. "Keep the drafts — $14/mo →" (sticky banner)
2. "or reply →" (sticky banner)
3. "See plan →" (secondary CTA bar)
4. "Copy reply" (per draft × 3 = 3)
5. "Yes, keep the drafts coming →" (between drafts)
6. "Chat on LINE" (bottom)
7. "Email me" (bottom)
8. "see how it works →" (bottom)
9. "Reply on Google" (per draft)
10. "Edit" (per draft)
11. "more about me →" (bottom)
12. "reviewhub.review →" (bottom)

**Effect:** decision paralysis. The owner doesn't know what action you
want them to take. When uncertain about action, default = no action.

**Fix to consider:**
- Pick ONE primary CTA per page section. Above-fold should have
  exactly ONE primary button — probably "Copy a draft" (since that's
  the no-friction action). Sale moves below.
- "or reply →" is too vague. What does "reply" mean to a prospect? Reply
  to whom? About what? Make it concrete: "reply to Earth (founder) →"
  with mailto link.
- "See plan →" duplicates "Keep the drafts — $14/mo →" — remove the
  secondary CTA bar entirely.

---

## Hypothesis 3 — the "reply to me" CTA is buried (MEDIUM)

The single best CTA on the entire page — the one that would give us
the cust-dev signal we actually need — is at the BOTTOM:

> *"Not ready to sign up? Just reply to my email — I'm Earth, the solo
> founder building this in Bangkok (more about me →), and a one-line
> 'tell me more' or 'not for me, here's why' is genuinely useful
> either way."*

This is gold. But it's at scroll position ~2800px on a 3346px page.
The owner has to scroll past 3 reviews × 3 tones each = 9 drafts to
find it.

**Effect:** the friendliest, lowest-friction action is invisible to
most visitors.

**Fix to consider:**
- Surface this note ABOVE THE FIRST DRAFT, not at the bottom.
- Make "reply to my email" a tappable mailto link, not just text.
- Could be a "from Earth" personal note above the first review block,
  with a one-line photo or sketch (humanizes it).

---

## Hypothesis 4 — the value isn't framed correctly (MEDIUM)

The page shows 3 drafts × 3 tones = 9 example replies. That's a lot
of demonstration. Owners may experience this as:

- *"OK, they can write replies. I can also write replies. Why do I
  need a tool?"*
- *"This is impressive but I don't have unanswered reviews piling up,
  so what's the actual ROI?"*

**The pitch in the email** (Wave-N templates) sets up a different
frame than what the page delivers. If the email said "you have N
unanswered reviews, here are drafts for them" — that's a different
arrival experience than landing on "REPLY SUGGESTIONS for [your
business]" with no acknowledgement of the prospect's actual review
backlog.

**Fix to consider:**
- Show the BACKLOG number at the top of the page: "You have 47
  Google reviews; 12 are unanswered. Below are 3 drafts to start
  with."
- That frames the page as "here's your specific problem, here's
  the start of your solution" — not "look at how good our AI is."

---

## Hypothesis 5 — pricing positioning (LOW-MEDIUM)

$14/mo is mentioned in the sticky banner. For a Bangkok cafe owner
or small spa, $14 isn't trivial. The value framing matters:

- "$14/mo for unlimited AI drafts" vs. 
- "$14/mo to never miss a Google review again" vs.
- "$14/mo (~฿499) — about the price of a 1-time consultation, monthly"

Current copy uses the first frame. Probably weakest of the three.

**Fix to consider:** test alternate pricing copy in the sticky
banner — emotional value over feature-list value.

---

## What this review doesn't address

- **The actual draft quality.** I didn't read all 9 sample drafts in
  detail. Quality is from Anthropic Haiku; on real prospect audits
  the quality might be worse if the AI doesn't have enough voice
  context. Path 4 of cust-dev-async-pack.md (1-star review reading)
  is the real way to assess this.
- **Mobile rendering.** I didn't check mobile viewport. Bangkok owners
  often read email on phone. Hypothesis 1 (sticky banner) is much
  worse on mobile where it takes up 30%+ of the visible area.
- **Page load speed.** Not measured. PageSpeed Insights would tell us.

---

## Recommended order of experiments

If Earth wants to test conversion fixes (low-risk, high-leverage):

1. **Move sticky banner below the first draft** (1 hour code change,
   A/B test on the next 10 audits). Hypothesis 1.
2. **Surface "reply to Earth" note above the first draft** (30 min
   code change, ship to all audits). Hypothesis 3.
3. **Consolidate bottom CTAs from 7 to 3** (1 hour). Hypothesis 2.
4. **Add backlog framing at top** (2 hours — needs to compute
   unanswered review count from the audit's source data). Hypothesis 4.

None of these touch the locked surfaces (no audit-preview content
changes per the overnight queue rules); they're all layout / CTA
arrangement, which is fair game.

If Earth wants to validate the hypotheses BEFORE shipping changes,
the Tier A/B/C follow-up emails in `docs/warm-followups-2026-05-20.md`
will surface which hypothesis is actually true (option (a)/(b)/(c)/(d)
maps directly to audience / pricing / timing / quality forks).

---

## Companion

- `docs/warm-followups-2026-05-20.md` — copy-paste followup pack
- `docs/cust-dev-async-pack.md` — broader async customer-dev framework
- `/admin/brief` — live engagement numbers
- `/audit-preview/demo` — the page reviewed here (sample cafe data)
