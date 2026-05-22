# What shipped overnight — 2026-05-22 (read first when you wake up)

**Single-page summary of the overnight session you asked me to run.**
Detailed docs linked at the bottom; this is the orientation page.

---

## 3 actions only you can take (in priority order)

### 1. 🚨 Flip LemonSqueezy from test mode → live (2 min)

`app.lemonsqueezy.com → Settings → General → Mode` → toggle off
test mode. Until this is done, the Checkout Overlay I shipped takes
NO real money (test mode = no real charge).

**Reviewer warning:** don't test with your own real card after
flipping. Use the test card `4242 4242 4242 4242` in test mode for
smoke-testing instead.

### 2. 🚨 Wave 6 send — Tue 2026-05-26 or Wed 2026-05-27, 9-11 AM ICT/SGT (~45 min)

13 verified-email prospects (dental + spa × Bangkok + Singapore)
fully prepped overnight. Paste-ready Gmail bodies, subject A/B/C
distributed, voice-anchor specifics inlined per prospect.

Open: `docs/outreach/wave-6-send-sheet.md`

For each of 13 prospects:
1. Generate the audit-preview URL (admin tool)
2. ONE verification click in your browser (single, deliberate — NOT
   a batch tab-through; the verification-batch problem from Wave 5
   is now detected by `/api/admin/funnel` so don't recreate it)
3. `curl -I <url>` → must return 200
4. Paste body from send-sheet → Send
5. Mark timestamp + subject variant in your tracker

### 3. Wave 6 harvest — Sun 2026-06-01 (~15 min)

```bash
curl 'https://reviewhub.review/api/admin/funnel?from=2026-05-26&to=2026-05-27' \
  --cookie 'your_admin_session'
```

(Or hit it from your authed Chrome browser at the URL above.)

Read **`verification_cluster_check` FIRST** in the response. If
`clusters_detected > 0`, those "opens" are your own clicks, not
prospects — use `honest_open_estimate` as the real number.

Then match to `docs/wave-postmortems/wave-6-outcomes-tree.md` and
execute the matching branch.

---

## What shipped (technical — for reference, not action)

| # | What | Where | What it does for you |
|---|---|---|---|
| 1 | LemonSqueezy live checkout | `client/src/lib/checkout.js` + LS dashboard | The audit-preview CTA opens LS Checkout Overlay on reviewhub.review (no domain bounce). Variant ID `1076073`. Numeric ID for future webhook config in Railway env. |
| 2 | LS Checkout Overlay HTML embed | `client/index.html` + `server/src/app.js` CSP | `lemon.js` loaded defer; CSP allows `assets.lemonsqueezy.com` script + `*.lemonsqueezy.com` frame |
| 3 | Wave 6 prospect roster | `docs/outreach/wave-6-prospects.md` | 13 prospects, EVERY email verified on the prospect's own website (no pattern guesses — Wave 5's bounce mode is fixed at research time) |
| 4 | Wave 6 outcomes tree | `docs/wave-postmortems/wave-6-outcomes-tree.md` | Pre-committed decision branches A-F. Read once at harvest, execute. |
| 5 | Wave 6 send sheet | `docs/outreach/wave-6-send-sheet.md` | 13 paste-ready Gmail bodies, subject A/B/C distributed |
| 6 | Wave 6 followup template | `docs/wave-postmortems/wave-6-followup-template.md` | +7-day followup for any opened-no-reply Wave 6 prospects |
| 7 | Wave 5 muay thai IG DMs | `docs/outreach/wave-5-muay-thai-im-scripts.md` | DM scripts for the 4 bounced Wave 5 prospects (Chuwattana, Eminent Air, Rithirit, Master Toddy) — paste into IG/FB |
| 8 | First-customer onboarding sequence | `docs/skills/first-customer-onboarding-sequence.md` | 5-email 30-day arc, activates on first paid webhook. Pre-staged. |
| 9 | Funnel diagnostic endpoint | `/api/admin/funnel` (server/src/routes/admin.js) | Per-step conversion + AUTOMATIC verification-cluster detection (no more "Wave 5 64% open rate" mistakes) |
| 10 | Strategic synthesis | `docs/strategy/post-wave-5-synthesis.md` | 5-page strategic doc — read this if you want the full picture |
| 11 | Wiki + operating queue + CLAUDE.md updates | (multiple) | Stage state synced; next-session-me has full context |
| 12 | `scripts/research-prospect.mjs` | (already committed) | Puppeteer-based email verifier — reusable for Wave 7+ research |

---

## What I deliberately did NOT do (and why)

| Skipped | Reason |
|---|---|
| Stripe Continue Setup completion | Hard safety rule — bank account / ID verification is prohibited for the agent. You'd have to complete this in your browser. LS now primary so Stripe is optional backup. |
| Sending the 9 Wave 5 followups I drafted earlier yesterday | Those followups assumed opens that didn't actually happen (verification-batch contamination). Drafted with bad data; would have wasted prospect attention. Honest finding > stale playbook execution. |
| Coffee shop prospects (Wave 6) | Researched 7 candidates across BKK + SG. NONE publish a public email on their websites. Coffee = walk-in trade, different buyer model. Documented as a finding; pivots needed if pursuing this vertical (IG DM channel). |
| KL / Manila prospects | Research time-budget exhausted at 13 verified across 2 cities. Better 13 verified > 30 with bounces (Wave 5 lesson). |
| More LCP / Lighthouse / a11y polish | Tier 3 polish below TTFPC bottleneck. Logged in operating queue for opportunistic later. |
| Stripe-as-primary-checkout reactivation | LS won the architecture call (MoR handles VAT/sales-tax globally — critical for Thai founder selling internationally). Stripe stays commented as backup. |

---

## The HONEST scoreboard

After 5 waves of cold outreach:
- ~41 total sends across all waves
- ~4 confirmed bounces (4 in Wave 5 muay thai)
- **0 confirmed real prospect opens** (the apparent "35% open rate"
  was contamination from your URL-verification clicks)
- **0 replies, 0 conversations, 0 customers**

That's the truth. Every framing softer than this has been an
artifact of bad measurement. The framework + funnel diagnostic +
verified-email protocol now in place prevent future artifact-driven
optimism.

Wave 6 is the next swing with clean methodology.

---

## What Wave 6 actually tests (5 hypotheses)

| # | Hypothesis | Confirmed if | Falsified if |
|---|---|---|---|
| 1 | Wave 5's "64% open" was verification contamination | Wave 6 cluster-check finds no batches AND open rate is reasonable | Wave 6 also shows batches |
| 2 | Verified emails > pattern-guesses for deliverability | Wave 6 bounce ≤5% (was 28.5%) | Wave 6 bounce >15% |
| 3 | Singapore SMB market responds better than Bangkok | SG opens >> BKK opens | Similar or BKK > SG |
| 4 | Variant L converts opens→replies | Reply rate >0% | Reply rate stays 0% |
| 5 | Dental + spa produce ≥1 conversion-quality reply | ≥1 reply that warrants conversation | 0 replies across all 13 |

Hypotheses 1-2 are ship-quality regardless of outcome (we learn how
to outreach better). Hypotheses 3-5 are conversion-quality (real
signal on whether ReviewHub is reachable + buyable).

---

## If Wave 6 produces 0 replies (worst case)

The strategic question stops being "open rate too low?" and becomes
"is anyone interested in this offer at all?" That's a fundamental
signal. Read `docs/strategy/post-wave-5-synthesis.md` § "If Wave 6
= 0 across all metrics" for the deeper questions and branches.

The short version: pivot the question from "how do we outreach"
to "are we offering the right thing to the right people." That's a
2-week conversation, not a 1-day fix.

---

## If Wave 6 produces a reply (best case)

Stop EVERYTHING else. Run `docs/skills/first-customer-playbook.md`.
The first conversation matters more than the next 10 prospects.

If they pay: trigger the onboarding sequence
(`docs/skills/first-customer-onboarding-sequence.md`).

---

## Commits this session (27 total in 24h)

Highlight commits (most important first):
- `7f282c6` — Funnel diagnostic + verification-cluster check
- `f43d2ef` — Strategic synthesis + wiki/queue updates
- `0df89c7` — Wave 6 outreach pack (drafts + outcome tree + send sheet)
- `88e1be1` — Wave 6 prospect research (13 verified)
- `638e8f3` — LS Checkout Overlay (in-domain modal)
- `2062fbe` — Switch checkout from Stripe to LS
- `de75c0f` — Audit-preview Variant L (low-friction lead)
- `69427e7` — TTFPC decision framework (load-bearing in CLAUDE.md)
- `23a036f` — Wave 6 followup template + muay thai IG DMs + onboarding sequence
- `3015ae5` — CLAUDE.md honest stage state sync

Full log: `git log --oneline -27`

---

## Honest closing

I worked the night on what would move TTFPC. The output:
- **Wave 6 is ready to fire** — your 45-min Tue/Wed action
- **LS is revenue-capable** — your 2-min toggle
- **Future-me won't repeat the Wave 5 verification-batch mistake** — the diagnostic catches it automatically
- **First-customer experience is pre-staged** — onboarding emails, customer-dev questions, first-customer playbook

What I couldn't do:
- Make customers appear
- Verify the LS checkout end-to-end (live mode requires your toggle + a test purchase)
- Replace the strategic thinking only you can do about whether the product / audience / channel / offer is correct

If the next two weeks produce a reply, today's work compounded.
If they don't, the strategic synthesis doc lays out the harder
questions to ask. Either way, the framework + measurement is
honest now in a way it wasn't 24 hours ago.

Good morning. Go flip LS first, then send Wave 6 between Tue/Wed.

— ReviewHub overnight agent
