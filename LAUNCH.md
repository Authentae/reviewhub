# Launch checklist — Utility Tools

Step-by-step from "code merged" to "first dollar earned." Do these in order; each step depends on the previous.

## 0. Pick a domain (you)

Brand candidates (pick what feels right; check availability with `whois`):

- `tinkermint.com` — tinker (tools) + mint (money)
- `smolmath.com` — small math, lowercase-internet brandable
- `owedy.com` — short, "what you owe" niche-fit but generalizable
- `plaincalc.com` — plain calculators
- `mathstub.com` — math from your paystub (works generally too)
- `tinytools.io` — direct, .io fine for solo
- `numero.tools` — "numero" + .tools TLD
- `ledgerly.com` — finance vibe
- `vestand.com` — vest + and
- `quickerr.com` — small tools quicker than alternatives

Buy at Namecheap, Cloudflare Registrar, or Porkbun ($8–15/yr for .com). **Cloudflare Registrar** is recommended — at-cost pricing, free WHOIS privacy, and DNS lives in the same dashboard.

## 1. Create the new GitHub repo (you)

1. Go to https://github.com/new
2. Owner: your account or org. Name: match the domain (e.g. `tinkermint`, `owedy`).
3. Public or private: **public** is fine and helps SEO/trust; AdSense doesn't care.
4. **Do NOT** initialize with README, .gitignore, or license. We're pushing existing history.
5. Copy the SSH URL (e.g. `git@github.com:<you>/<repo>.git`).

## 2. Push the pre-staged history (you, one command)

A branch named `utility-sites-only` already exists in this repo with full history of just the `utility-sites/` folder, ready to push as the new repo's `main`.

```bash
cd /home/user/reviewhub
git remote add new-repo git@github.com:<you>/<repo>.git
git push new-repo utility-sites-only:main
```

That's it. The new repo now has a `main` branch with every commit that touched `utility-sites/`, with paths rewritten so the project sits at the repo root.

## 3. Clone the new repo for ongoing work (you)

```bash
cd ~/code   # or wherever you keep projects
git clone git@github.com:<you>/<repo>.git
cd <repo>
npm install
cp .env.example .env.local
npm run dev   # http://localhost:3000
```

From this point on, do all utility-sites work in the new repo, not in reviewhub.

## 4. Copy the CI workflow into the new repo (you)

The `.github/workflows/utility-sites.yml` file lives in the reviewhub repo, not inside `utility-sites/`, so it doesn't travel with the subtree split.

In the new repo:

```bash
mkdir -p .github/workflows
# Then create .github/workflows/ci.yml with the contents below,
# adjusted to remove the `paths:` filter and the `working-directory: ./utility-sites` line:
```

Minimal new-repo version (paste this):

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

Commit + push:

```bash
git add .github/workflows/ci.yml
git commit -m "ci: typecheck + lint + tests + build"
git push
```

## 5. Set up Vercel (you, ~10 minutes)

1. Go to https://vercel.com/new
2. Import the new repo. Vercel auto-detects Next.js.
3. **Framework preset:** Next.js (auto). **Root directory:** leave blank (project is at repo root after split). **Node version:** 20.
4. Click **Deploy**. First deploy will succeed but render placeholders — that's expected.
5. Add Environment Variables (Settings → Environment Variables):
   - **Production:**
     - `NEXT_PUBLIC_SITE_URL=https://yourdomain.com` (no trailing slash)
     - `NEXT_PUBLIC_GA4_ID=` (after step 8)
     - `NEXT_PUBLIC_ADSENSE_CLIENT_ID=` (after step 9)
     - `NEXT_PUBLIC_ADSENSE_SLOT_*=` (after step 9)
     - Affiliate IDs (after step 10) — leave blank for now
   - **Preview:**
     - `ROBOTS_NOINDEX=1` (so previews don't get indexed)
     - `NEXT_PUBLIC_SITE_URL=https://yourdomain.com` (placeholder OK)

## 6. Connect the custom domain to Vercel (you)

1. Vercel → Project → Settings → Domains → **Add domain**, enter your domain.
2. Vercel shows DNS instructions — typically:
   - Apex (`yourdomain.com`): A record to `76.76.21.21`
   - `www`: CNAME to `cname.vercel-dns.com`
3. In Cloudflare Registrar (or wherever you bought it), add those records. Wait 5–15 minutes for DNS to propagate. Vercel auto-issues an HTTPS certificate.

## 7. Submit to Google Search Console (you, ~5 minutes)

1. Go to https://search.google.com/search-console/welcome
2. Add property → **URL prefix** → `https://yourdomain.com`
3. Verification method: **HTML tag** → copy the `content="..."` value.
4. In Vercel, set `NEXT_PUBLIC_GSC_VERIFICATION=<that token>` and redeploy.
5. Back in Search Console, click **Verify**.
6. Once verified: **Sitemaps → Add new sitemap → `sitemap.xml`** → Submit.
7. **URL Inspection** → enter `https://yourdomain.com/rsu-tax-shortfall` → Request indexing.

## 8. Google Analytics 4 (you, ~5 minutes — optional but recommended)

1. https://analytics.google.com → Admin → **+ Create → Account → Property**.
2. Property name: your brand. Time zone: yours. Reporting platform: web.
3. Add a **Web data stream** for your domain. Copy the **Measurement ID** (`G-XXXXXXXXXX`).
4. In Vercel: set `NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX` and redeploy.

Privacy/consent: the privacy page already discloses GA4. For EEA visitors, Google Funding Choices (free, AdSense bundles it) handles consent automatically once AdSense is active.

## 9. Apply for Google AdSense (you, 1–4 weeks waiting period)

**Important:** AdSense rejects sites that look thin, spammy, or have copied content. Wait until you have:
- The live domain pointing at the real site (not "Coming soon")
- At least the calculator + 3 of the 6 blog posts indexed (use Search Console to request indexing on each)
- Privacy + Disclaimer + Terms + About + Editorial Policy pages all reachable from the footer (already shipped)
- 7–14 days of organic traffic, even small amounts (helps approval)

### How to apply

1. Go to https://adsense.google.com → **Get started**.
2. Sign in with your Google account.
3. Enter your URL: `https://yourdomain.com`. Pick your country, accept terms.
4. **Connect your site:** AdSense gives you an HTML snippet (`<script async src="...adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX">`).
   - Extract the `client` value — that's your `NEXT_PUBLIC_ADSENSE_CLIENT_ID` (e.g. `ca-pub-1234567890123456`).
   - Set it in Vercel and redeploy. The site auto-injects the verification snippet via `components/Analytics.tsx → AdsenseLoader`.
5. Back in AdSense, click **Request review**. **Wait 1–4 weeks.**
6. Once approved, Google emails you. Then create **Display ad units**:
   - AdSense → **Ads → By ad unit → Display ads**
   - Create one called "Header" → copy its `data-ad-slot` ID → set `NEXT_PUBLIC_ADSENSE_SLOT_HEADER`
   - Create one called "In-content" → set `NEXT_PUBLIC_ADSENSE_SLOT_IN_CONTENT`
   - Create one called "Sidebar 300x600" → set `NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR`
7. Redeploy. Real ads appear within 1–2 hours.
8. Add your bank account in AdSense → Payments → Payment info. Minimum payout $100; you get paid by the 21st of the month after you cross it.

### If AdSense rejects you

Common reasons + fixes:
- **"Insufficient content"** — add 2–3 more blog posts and request review again. Don't keep submitting; wait at least 14 days between requests.
- **"Site does not comply with Google policies"** — usually AI-generated content or thin pages. Audit your blog posts; rewrite.
- **"Site not navigable"** — check that footer links to Privacy/Disclaimer/Terms work. Open every page in an incognito window.

## 10. Affiliate program signups (you, in priority order)

Apply only after the site is live and indexed. Some require traffic minimums.

1. **TurboTax + TaxAct** — both available through aggregator networks:
   - **FlexOffers:** https://www.flexoffers.com → sign up as publisher → search "TurboTax" and "TaxAct" → request approval. Easier and bundles both.
   - **Impact Radius:** https://impact.com → publisher signup → same partners. Sometimes higher payouts.
2. **Carta:** https://carta.com → contact via the Partners page. Free for individuals so the referral path is for the optional paid tier.
3. **Empower (formerly Personal Capital):** https://www.empower.com/partner-with-us → fills lead form. Pays per qualified lead.
4. **Harness Wealth:** https://www.harnesswealth.com — direct outreach via their partner email. Highest payout but smallest network so most selective.

For each: once approved, the partner gives you a unique referral ID (string). Set the corresponding env var in Vercel:

- `NEXT_PUBLIC_AFFILIATE_TURBOTAX_ID=...`
- `NEXT_PUBLIC_AFFILIATE_TAXACT_ID=...`
- `NEXT_PUBLIC_AFFILIATE_HARNESS_ID=...`
- `NEXT_PUBLIC_AFFILIATE_CARTA_ID=...`
- `NEXT_PUBLIC_AFFILIATE_EMPOWER_ID=...`

The placeholder `#` button text disappears the moment the env var is set.

## 11. CPA review of blog posts (you, $500–1500)

Before launching ads + affiliates, get the 6 blog posts in `content/blog/posts/` reviewed by a licensed CPA. Why: tax-related YMYL content needs E-E-A-T credibility, and a CPA-reviewed byline meaningfully boosts ranking.

How to find a reviewer:
- **Upwork / Contra:** "tax content reviewer" — $200–300/post is typical. Pick someone whose profile shows equity-comp experience.
- **Harness Wealth or your own CPA:** ask if they'll do editorial review separately from filing. Often $300–500/post.

After review:
- Update `reviewerName` in each post file from `'Pending CPA review'` to the CPA's actual name.
- Update `dateModified` to the review date.
- Commit + push. Schema.org structured data picks up the reviewer automatically.

## 12. Soft launch + Search Console nurture (you, ongoing)

Days 1–14 after AdSense approval:
- Post the calculator on r/personalfinance, r/cscareerquestions, r/financialindependence (read each subreddit's self-promotion rules first — most allow tools if you're a regular contributor).
- Email the link to 5–10 friends in tech with RSUs and ask for honest feedback.
- Watch Search Console for indexing status. Use **URL Inspection** to manually request indexing for any page that's slow.

Days 15–60:
- Watch which queries you're starting to rank for. Write follow-up posts targeting the top 3.
- Hit "Request indexing" on every new post the day you publish.

Once you're earning real money on this tool, ship tool #2 in the same `app/<slug>/page.tsx` pattern. ESPP qualifying disposition or ISO/AMT calculator are the natural compounders for the same audience.

## Reference: what each external account costs you

| Service                     | Cost                       | When                |
| --------------------------- | -------------------------- | ------------------- |
| Domain (.com)               | $8–15 / year               | Step 0              |
| Vercel hobby                | Free                       | Step 5              |
| Cloudflare DNS              | Free                       | Step 6              |
| Google Search Console       | Free                       | Step 7              |
| GA4                         | Free                       | Step 8              |
| AdSense                     | Free, ~30% rev share to G  | Step 9              |
| FlexOffers / Impact         | Free, ~10–20% to network   | Step 10             |
| CPA review (one-time)       | $500–1,500 total           | Step 11             |
| **First month total**       | ~$8 + CPA                  |                     |

That's it. The technical work is done; the rest is form-filling and patience.
