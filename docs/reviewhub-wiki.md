# ReviewHub wiki — the business in one searchable file

Karpathy-style memory wiki. Single source of truth for *non-code* facts
about ReviewHub: who's using it, what's making money, what's blocked,
what worked, what didn't. Claude reads this every session before
proposing big changes.

**Update rule:** when something material happens (first paying customer,
a real outreach reply, a churn, a pricing change, a competitor move,
a learned lesson), add a line here. Not git-commit-detail, not
operating-queue-task — just the *fact* that future-you needs to know.

Sections grow over time. Don't archive — just date-stamp.

---

## Customers

_(empty — pre-revenue as of 2026-05-05)_

When the first paying customer lands, log: business name, plan,
acquisition channel (cold email / audit funnel / inbound / referral),
date, and any pre-purchase friction worth remembering.

## SEO infrastructure

- **2026-05-05** — Google Search Console verified for
  `https://reviewhub.review` (URL prefix property, HTML-tag method).
  Verification meta tag in `client/index.html`. Sitemap.xml submitted.
  Owner: earth.reviewhub@gmail.com.
- **Bing Webmaster Tools** — TODO. Cleanest path: log into
  https://www.bing.com/webmasters → Import from Google Search
  Console (one click).
- 5 vertical landing pages live: `/for-restaurants`, `/for-dentists`,
  `/for-hotels`, `/for-spas`, `/for-cafes`. Each has Service JSON-LD.
- `/blog` index live + 3 static blog posts cross-linked.
- 2 free tools: `/tools/review-reply-generator` (AI-powered) and
  `/tools/reply-roaster` (heuristic critique).

## Outreach waves

- **Wave 1 — 2026-05-04:** 9 emails sent. No replies as of 2026-05-06.
  Mix of cooking schools + B&Bs. Verticals targeted: Pink Chili,
  House of Taste, Sweets Cottage, Tingly Thai, May Kaidee, Better
  Moon, White Ivory, Vera Nidhra, Aim House.
- **Wave 2 — 2026-05-06 14:39 ICT:** 2 emails sent.
  - Old Capital Bike Inn (info@oldcapitalbkk.com) — Thai, UNAWARE
    segment (0% response), specific observation: owner Jason +
    bike tour. Audit URL eb9b38c2…
  - Loftel 22 Hostel (loftel22bangkok@gmail.com) — Thai, UNAWARE
    segment (0% response), specific observation: 2 unanswered 1-stars.
    Audit URL 5413ee40…
  - Skipped: Chakrabongse Villas — recent response rate ~60%, owner
    Narisa replies personally. Stock pitch wouldn't land. Either
    needs a custom pitch or skip.
- **Wave 2.1 — 2026-05-06 ~16:00 ICT:** 1 email sent (custom pitch).
  - Chakrabongse Villas (reservation@chakrabongse.com) — English,
    custom-pitch (not stock outreach). Acknowledged Narisa's existing
    reply quality first, framed ReviewHub as voice-scaling not voice-
    replacing. Audit included 1 critical 4★ review to demo nuance.
    Audit URL 9326cf61…4340 (initial send had a 3-char typo in the
    token from screenshot transcription; follow-up apology + correct
    link sent 5 min later). Subject: "A small thought after reading your
    replies on Google". Lesson: high-context prospects deserve
    fresh-per-prospect emails (per CLAUDE.md "templates → fresh-per-
    prospect when context is high" rule).
- **Wave 1 bounce logged:** baansukhumvit@yahoo.com address not found;
  Yahoo listing was stale third-party. Reinforced verified-live-website-
  email-only rule.

## Deliverability diagnostic — 2026-05-06 evening

Mail-tester result for earth.reviewhub@gmail.com: **8.2/10 "almost
perfect"**. Authentication clean (DKIM signed + valid + AU + EF, IP
reputation +2). NOT in a spam folder.

The 1.8-point deduction breakdown:
- **PDS_OTHER_BAD_TLD: -1.999** — `.review` TLD on SpamAssassin's
  untrustworthy-TLDs list (generic flag for all `.review` domains
  due to historical spammer use, not flagged specifically against us)
- minor: FREEMAIL_FROM, HTML_MESSAGE, SPF_HELO_NONE (each -0.001)

**Strategic implication:** Wave 1 0/7 opens is NOT a deliverability
problem. Emails landed in inbox/promotions but recipients didn't engage.
Root cause: wrong audience (cooking schools don't care about Google
reviews). Don't double down on Wave 1 prospects with a follow-up;
instead send Wave 3 to better-fit verticals (hotels, B&Bs, dental).

**.review TLD as future concern:** worth tracking but not urgent. 8.2
is still inbox-tier. If outreach response stays poor across waves,
consider acquiring a more-trusted secondary domain (reviewhub.io /
reviewhub.app) for outreach links. Not now.

## Active outreach signals

- **2026-05-05** — Outreach queue has 3 verified prospects + 6 research
  targets. Wave 1 sent May 4 (9 emails). Awaiting 48h reply window
  before pattern-matching which verticals respond.
- Verticals showing source-availability so far: small B&Bs with own
  websites, vegetarian/pastry cooking schools, independent dental
  clinics, yoga/Muay Thai studios.

## Pricing

- Free + Starter $14/mo + Pro $29/mo + Business $59/mo (all annual = ~17% off)
- 14-day trial KILLED — caused tire-kickers, signup→pay conversion
  worse than direct paid signup
- Source of truth: `server/src/lib/billing/plans.js`
- Free tier intentionally has `email_alerts_new: false` — pushing free
  users toward Starter, the headline upgrade reason

## Lessons learned (the painful ones)

- **2026-05-05** — Production OAuth callback used `writeSessionCookie`
  (typo) instead of `setSessionCookie`. No integration test caught it.
  Lesson: any new auth route needs a route-level happy-path test before
  shipping.
- **2026-05-05** — Google sign-in callback set the session cookie but
  the React app uses a localStorage `rh_logged_in` marker for
  synchronous PrivateRoute checks. User bounced back to /login. Fix
  was a `/auth/google/done#token=…` handoff route. Lesson: any new
  auth path that lands on a private route needs both server cookie AND
  localStorage marker.
- **2026-05-05** — Queue file got stale (4 items marked `[ ]` were
  already shipped in earlier sessions). Lesson: agent should mark items
  `[done]` in the same commit that ships them, not as a follow-up.
- **2026-05-04** — `REPLY_TO_PLATFORMS` defaulted to OFF when env var
  was unset. Headline paid feature (auto-post replies to Google) was
  silently broken in prod. Now defaults ON when unset, with loud boot
  log. Lesson: defaults for paid-tier features should fail loud, not silent.

## What's making money

_(nothing yet — pre-revenue)_

When MRR > $0, log monthly: total MRR, by plan, churn, top acquisition
channel, biggest single-customer concentration risk.

## What's not working

- Cold email open rates — no data yet, May 4 wave too recent
- Audit funnel conversion — no signups attributed to audit yet
- LinkedIn / Twitter — not pursued; no time
- Paid ads — explicitly not pursuing pre-PMF

## Competitor moves

_(empty — track here when a relevant change is observed)_

Watch list: BirdEye, Podium, NiceJob, ReviewTrackers (US-focused but
relevant feature creep).

## Decisions deferred to future-you

- **Telegram bot for ops alerts** — needs always-on machine. Re-evaluate
  when first customer lands or when a $5-20/mo VPS becomes cheap relative
  to revenue.
- **Multi-agent crew formalization** — premature pre-revenue. Re-evaluate
  when one founder hour is worth more than agent ceremony cost (probably
  ~5-10 paying customers).
- **Bundle-size split for Settings.jsx (107KB)** — risky refactor, low
  user-visible payoff pre-revenue. Revisit if a customer complains about
  Settings load time.

## Glossary

- **Wave** — a single batch of cold outreach emails (Wave 1 = May 4 send)
- **Audit funnel** — outbound: send a free AI-generated reply audit, link
  to /register?from=audit&business=… for self-serve signup
- **Operating queue** — `docs/operating-queue.md`, the cross-domain todo list
