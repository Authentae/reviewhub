# ReviewHub — 90-Day Strategy (PLG, extension-led)

**Locked:** 2026-04-24 (revised from sales-led version after founder
confirmed preference for solo / no-customer-contact execution)
**Review date:** 2026-07-23 (90 days)

---

## The bet

You will not do customer calls, demos, or outbound DMs. Those are off the
table — not bad, just not you. Instead the bet is:

**A browser extension on the Chrome Web Store does the selling for you.**
People search for "AI review reply Chrome extension" on Google / in the
Store → they find yours → they install free → some upgrade.

Plus a supporting cast of SEO content, Product Hunt, and a lifetime deal
burst to compound the extension's distribution.

## Who we're for

Global English-speaking solo operators and small-business owners who:

- Have a public review footprint on Google, Yelp, Facebook, TripAdvisor,
  Trustpilot, Amazon, Etsy, or similar
- Respond to reviews themselves (not delegated to staff)
- Search for tools on the internet rather than wait to be sold to
- Comfortable installing a Chrome extension

Thailand-first positioning is **paused**, not abandoned. Once the
English-market PLG engine works, Thai SMB becomes a deliberate Year-2
expansion with different channels (LINE, local partnerships).

## Who we are NOT for (do not build for them)

- Enterprise buyers (Birdeye owns; we shouldn't compete)
- US home-services (NiceJob owns)
- Multi-location chains requiring account managers
- Anyone who needs a sales call before buying

## The promise

**"Reply to every review on every platform in 10 seconds — one Chrome
extension, one button, AI drafts your response."**

## Pricing (unchanged — different framing)

| Tier | Price | What it gets |
|---|---|---|
| Free | $0 | 3 AI drafts/month, all platforms via extension |
| Solo | $14/mo (~$16/day ≈ one iced coffee) | Unlimited AI drafts, email alerts, multi-platform dashboard |
| Agency | $59/mo | 5 businesses, priority support, white-label widget |

Free-to-paid trigger: AI draft quota (3/mo).

Added lever: **lifetime deal run at month 6** via AppSumo / PitchGround
($99 for Solo-tier-forever, capped at first 100-200 buyers).

## Success criteria — 90 days

| Metric | Week 4 | Week 8 | Week 12 |
|---|---|---|---|
| Chrome Web Store installs | 50 | 300 | 1,000 |
| Free ReviewHub signups (from any source) | 30 | 150 | 500 |
| Paying Solo customers | 0-1 | 2-5 | **10** |
| MRR | $0-14 | $28-70 | **$140+** |
| Blog posts live | 2 | 6 | 10 |
| Product Hunt launch status | scheduled | launched | post-launch follow-up |

---

## The 90-day plan, week by week

### Weeks 1-2 — Ship the distribution engine

Zero human contact required. Sit in your room and do this:

1. **Deploy ReviewHub to production.** Follow `docs/first-deploy.md`.
   (Railway + Brevo + domain, ~1 weekend). Product must be live or the
   extension has nothing to authenticate against.
2. **Publish the Chrome Extension.** `extension/` is built. Sequence:
   - Create icons (see `extension/icons/ICONS.md`)
   - Zip the directory contents
   - Register Chrome Web Store developer account ($5 one-time)
   - Submit → wait 1-3 business days for review
3. **Rewrite your landing page hero** to lead with the extension:
   - Primary CTA: "Install free Chrome extension"
   - Secondary CTA: "Sign up for the dashboard"
4. **Add a `/extension` landing page** — dedicated URL for SEO + ads +
   Product Hunt.

### Weeks 3-4 — First content drop + Product Hunt prep

5. **Write 2 SEO-targeted blog posts**:
   - "How to respond to negative Google reviews — with AI"
   - "The 5 best review response generator tools in 2026" (include
     yourself + honest comparison — it ranks better)
6. **Publish on IndieHackers.com**: "I built a Chrome extension that
   replies to reviews on any platform. 500 lines of code, no framework.
   Here's the stack."
7. **Prepare Product Hunt launch** (launches end of week 4 or start of
   week 5):
   - Prep screenshots, tagline, tagline A/B candidates (see
     `extension/store-listing.md`)
   - Reach out ASYNC to a known hunter via their public Twitter DMs or
     PH profile message board — not a call, just a one-line ask
   - Queue up a Twitter thread describing the build journey

### Weeks 5-6 — Launch spike + harvest

8. **Launch on Product Hunt.** 24 hours of attention on the site + your
   socials. Realistic: 200-500 upvotes if decent. 1,000-3,000 unique
   visitors. 50-150 extension installs in the launch week.
9. **Post Show HN on Hacker News** 2-3 days after PH to catch a different
   audience. Honest title: "Show HN: A Chrome extension that drafts
   review replies on any platform."
10. **Post on r/SideProject, r/SaaS, r/IndieDev** with different angles.
    Link back to the landing page, not directly to the Store.

### Weeks 7-10 — Compound content + affiliate

11. **Write 1-2 blog posts per week**, Thursdays. Topics mined from
    questions you see in Reddit + Quora + Indie Hackers: "Do Google
    review responses affect SEO?", "What's a good response to a 1-star
    review?", "How often should I reply to reviews?"
12. **Launch affiliate program** via LemonSqueezy's built-in affiliate
    tools or Rewardful. 20% lifetime commission. Email 20 micro-SaaS
    bloggers and YouTubers via their public contact forms (no DM / no
    call — just a template email):

    > Hi — I'm the solo maker of ReviewHub, a Chrome extension + web
    > dashboard for replying to online reviews. Just launched on Product
    > Hunt [link]. If you cover SaaS / indie / local business tools and
    > the product seems a fit, I'd love to offer you 20% lifetime
    > commission on any paid signup via your affiliate link. No pressure
    > at all — reply if interested, ignore if not.
    >
    > Best, [name]

    Expect 2-3 replies from 20 emails. Even 1 affiliate partnership is
    worth the hour.
13. **Keep the content engine turning** — 2 posts/week, 8+ posts by end
    of week 10.

### Weeks 11-12 — Lifetime deal preparation

14. **Apply to AppSumo / PitchGround / DealMirror.** These LTD platforms
    have inbound form applications — no calls. AppSumo typically wants
    products with ~$1K MRR or 100+ users (you'll be close by week 12).
15. **If LTD accepted:** launch at month 4. Typical indie SaaS clears
    $10-50K from an LTD run. Trades some MRR for a cash burst + 1,000+
    users overnight.
16. **If LTD not yet accepted:** run a "last-chance lifetime deal" on
    your own site ($99 for 100 buyers only). Same effect, smaller scale.

---

## Supporting activities — all solo, all silent

### Build-in-public Twitter presence

- **One tweet per day.** Days 1-30: "Day X of building ReviewHub —
  shipped [thing]." Days 31-60: metrics updates + honest reflections.
  Days 61-90: building compound content from the first 60 days.
- **No DMing strangers.** Post + wait. The right people find you.
- **Engage on reply threads only** — like + thoughtful reply to posts
  from adjacent indie makers (Bannerbear, Fathom, Simple Analytics,
  PlausibleInsights alumni). Builds silent relationships.

### SEO content strategy

Target these keyword clusters in order:

1. **High-intent bottom-funnel** (ship first):
   - "ai review reply generator"
   - "chrome extension for review replies"
   - "how to respond to google reviews"
   - "nicejob alternative"
   - "reviewflowz alternative"

2. **Education / middle-funnel** (ship in months 2-3):
   - "do review responses affect SEO"
   - "how often to respond to reviews"
   - "best way to respond to negative reviews"

3. **Brand / top-funnel** (long-tail, low priority):
   - "online reputation management for small business"
   - "google business profile tips"

Expect 6-12 months before SEO drives meaningful traffic. This is a slow
compounding asset, not a quick win.

### Free no-signup tool (optional amplifier)

Build `reviewhub.app/tools/review-reply-generator` — paste a review,
get a draft, no login. This:

- Ranks for "review reply generator" SEO
- Catches people who aren't ready to sign up but want to try
- Converts some % to Free signups via the "get more drafts" footer

Build effort: ~1 day. Recommend building in week 6 or 7 after core PLG
launch is stable.

---

## What you measure, honestly, every Friday

Open a Notion page or a spreadsheet. Update it weekly:

- Chrome Web Store installs (total + this week)
- Free signups (total + this week)
- Paying customers (total + this week)
- MRR
- Blog posts published this week
- Traffic source breakdown (from Plausible / Fathom / GA)
- Biggest thing you learned this week

Review honestly. If week 4 is <50% of targets, don't panic — rethink
the copy, the tagline, the top-of-funnel; don't rebuild the product.

---

## Anti-patterns — watch for these

- **"I'll add one more feature before I launch."** You've done that 20
  times this year. Launch.
- **"Let me redesign the landing page first."** The current version is
  good enough. Ship it.
- **Reading yet more indie hacker advice without acting on any of it.**
- **Checking installation counts 10× per day.** Tracks anxiety, not
  progress. Once a day max.
- **Rewriting the positioning statement every 2 weeks.** Commit.

---

## Realistic money expectations

- Month 3 (day 90): $100-300 MRR. Enough to know the flywheel can turn.
- Month 6: $500-1,500 MRR. Enough to know you have a business.
- Month 12: $1,500-5,000 MRR. Enough to justify more investment.
- Month 24: $5,000-15,000 MRR. Replacement-income level for a solo
  founder.

Some indie hackers compress this — Pieter Levels hit six figures year-1
with Nomad List. Some take 3-5 years. Variance is huge. **Baseline
expectation: $5K MRR in ~18-24 months with zero customer calls.**

---

## Founder's compact (revised)

> For the next 90 days, I will:
>
> - Ship the Chrome extension on the Store within 14 days of deploy
> - Publish at least 2 blog posts per week
> - Launch on Product Hunt by day 45
> - Email 20 potential affiliates in one batch, then stop
> - Post one Twitter update every weekday
> - Not schedule a single customer call
> - Not add a new product feature unless 3+ users request it
> - Not rewrite the strategy doc unless metrics require it
> - Open this document every Friday and update honestly
>
> Signed: __________________________ Date: __________
