# Product

## Register

brand

> ReviewHub has both a marketing site (landing, pricing, blog) and a
> product app (dashboard, settings, review-requests UI). The register
> here is **brand** because the active design work is the marketing
> surface — repositioning the homepage + blog around the "get more
> reviews" pivot (see `docs/strategy/demand-validation-2026-05-26.md`).
> For app-UI work (dashboard, settings), override to `product` per task.

## Users

Owners and managers of **appointment-based small businesses** worldwide —
dental clinics, spas, salons, wellness studios, repair services. The
common thread: they collect customer contact info (emails/phone), and
they struggle to GET Google reviews because customers mean to leave one
then forget. (Walk-in businesses like cafés are NOT the target — they
get reviews naturally and don't capture customer contacts.)

Context: a busy owner, often non-technical, reputation-aware enough to
know reviews matter for getting found and trusted. In Asia they live on
LINE, not email. They are skeptical of cheap unknown SaaS tools ("is
this safe to connect to my Google account?"), so the site must earn
trust fast.

## Product Purpose

Help appointment-based businesses **get more Google reviews on
autopilot**: after a visit, ReviewHub sends the customer a short,
friendly reminder with a one-tap link to the business's Google review
page, so the reviews they've earned actually show up. AI-drafted replies
to incoming reviews are the secondary bonus.

Success right now (Stage 0): **the first paying customer** — one
appointment-based business paying $14/mo. Everything on the marketing
site serves that single goal: make a skeptical owner understand the
value and trust us enough to try.

## Brand Personality

Honest, simple, trustworthy. Quiet confidence, not hype.

- **Honest** — no fake testimonials, no inflated claims. A pre-commit
  "honesty-lint" literally blocks marketing copy that overstates what
  the product does. The brand's credibility IS the product's moat.
- **Simple** — one job done well (get more reviews), explained in plain
  words a busy non-technical owner gets in 5 seconds.
- **Trustworthy** — looks legit and safe enough that an owner will
  connect their Google account. Reassuring, not flashy.

Voice: first-person plural ("we"), never founder names. Plain English,
calm, specific. No buzzwords.

## Anti-references

- **Generic SaaS-cream/sand AI-default look.** (Ironic note: the current
  brand uses a warm `--rh-paper #fbf8f1` near-white — that's exactly the
  2026 AI-default warm-neutral band. Worth questioning in any redesign.)
- **Birdeye / Podium** — corporate, busy, expensive-feeling enterprise
  dashboards. We are the opposite: small, clear, one job.
- **Hype-y marketing pages** — "supercharge / unleash / transform /
  seamless / game-changer." Banned. Specific nouns + verbs only.
- **Cheap-scammy-tool vibe** — the "$14 unknown = junk" trap. The site
  must look credible and safe, not bargain-bin.

## Design Principles

1. **Honesty over polish-hype.** Every claim must be literally true.
   Looking trustworthy beats looking impressive.
2. **One job, clear.** Lead with "get more reviews." Don't bury it under
   features. A skeptical owner should understand the value in one screen.
3. **Earn the trust to connect Google.** The hardest ask is "let us into
   your Google account." Design should reduce that fear (clarity,
   credibility signals, plain explanation), not add SaaS-clutter anxiety.
4. **Plain over clever.** Copy and UI for a busy, non-technical,
   often-second-language owner. Simple words, obvious actions.
5. **Local warmth where it counts.** Asia-first reality (LINE, not
   email; multilingual). Warmth carried by tone and specificity, not by
   a default warm-tinted background.

## Accessibility & Inclusion

- WCAG 2.1 AA target. (Current a11y score ~92-96 via axe-core; known
  open issue: ~59 color-contrast nodes failing AA — muted text on warm
  paper. A redesign should fix these, not inherit them.)
- `prefers-reduced-motion` respected on every animation.
- Multilingual: product ships 10 language packs; marketing has EN/TH
  pairs. Copy must translate cleanly (no idioms that break in Thai).
- Mobile-first: owners read on phones (esp. Asia). Test every heading at
  mobile width; current audit-preview LCP runs slow on mobile 4G — a
  redesign must stay fast.

---

*Written 2026-06-05 from existing project docs (CLAUDE.md, reviewhub-wiki.md,
project_reviewhub_design.md memory, and the 2026-05-26 get-more-reviews
pivot decision) rather than a fresh interview — the strategic answers were
already documented. Earth to confirm or adjust.*
