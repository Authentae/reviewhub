# Free tools — install walkthrough

Tier-1 free tools to install on reviewhub.review. All $0, all use your existing
Google/Microsoft accounts, all give us data we don't have today.

**Time budget:** ~45 min total for all six.

**Status check** (what's already done):
- ✅ Google Search Console — verified (meta tag in `client/index.html` line 31)
- ✅ Plausible analytics — wired in `client/index.html` inline script
- ⬜ Microsoft Clarity — code shipped, needs your project ID
- ⬜ Bing Webmaster Tools — meta-tag slot ready, needs your token
- ⬜ Ahrefs Webmaster Tools — meta-tag slot ready, needs your token
- ⬜ Google Alerts — pure click-through, no code
- ⬜ Mail-tester — per-send tool, no code

---

## 1. Microsoft Clarity — session replays + heatmaps (~5 min)

**What you get:** every visitor session recorded as a watchable replay,
heatmaps of clicks/scrolls/rage-clicks, dead-click detection. Free, unlimited.
This is the data we've been missing — we ship conversion experiments blind
right now.

**Steps:**

1. Go to **https://clarity.microsoft.com** and sign in with your Microsoft
   account (use the same one you'll use for Bing Webmaster Tools next).
2. Click **"+ New project"**.
3. Project name: `ReviewHub`
4. Website URL: `https://reviewhub.review`
5. Category: `Technology > Software`
6. Click **Create**.
7. On the next screen ("Install tracking code"), find your **project ID** —
   a short alphanumeric string at the top, e.g. `abc12d3ef4`.
8. **DO NOT paste the script tag.** I've already shipped the integration —
   you just need the ID.

**Drop the ID into Railway:**

```bash
railway variables --set "VITE_CLARITY_PROJECT_ID=YOUR_ID_HERE"
railway up --detach
```

Or via the Railway dashboard: project `rare-passion` → service `reviewhub` →
Variables → New Variable → `VITE_CLARITY_PROJECT_ID` = your ID → Deploy.

**Verify within 10 min:**
- Open https://reviewhub.review/ in a new browser
- Browse 2-3 pages
- Back in Clarity dashboard → Recordings → your session should appear

**Privacy default:** Clarity masks input fields and credit-card-pattern numbers
out of the box. You don't need to do anything to be GDPR-compliant for the
basics, but review Clarity's project settings → Masking if you want stricter
defaults.

---

## 2. Bing Webmaster Tools — Bing index + ChatGPT search leverage (~10 min)

**What you get:** Bing's equivalent of Google Search Console — what queries
you rank for on Bing, sitemap submission, crawl errors. **Bigger reason:**
OpenAI's ChatGPT web-search feature uses Bing's index. Being indexed +
optimized on Bing increases your chance of being cited by ChatGPT when users
ask questions in our space.

**Steps:**

1. Go to **https://www.bing.com/webmasters** and sign in with the same
   Microsoft account you used for Clarity.
2. Click **"Add a site"**.
3. **Easy path:** Click "Import from Google Search Console" — Bing will pull
   reviewhub.review from your GSC since it's already verified there. Skip
   to step 7.
4. **Manual path** (if GSC import doesn't work): enter `https://reviewhub.review`
   → click "Add".
5. Bing will offer 3 verification methods. Choose **"Add a meta tag to your
   homepage"** (matches how Google verification works).
6. Copy the token value — looks like `1A2B3C4D5E6F7G8H9I0J`.
7. **Tell me the token** (or paste it here):
   ```
   <meta name="msvalidate.01" content="YOUR_TOKEN_HERE" />
   ```
   I'll uncomment line ~36 of `client/index.html`, fill in the token,
   build, commit, push, deploy. Takes 2 minutes.
8. Back in Bing Webmaster Tools, click **Verify**.
9. **Submit sitemap:** Sitemaps → Submit sitemap → `https://reviewhub.review/sitemap.xml`.

---

## 3. Ahrefs Webmaster Tools — free backlink + site audit (~10 min)

**What you get:** Ahrefs is normally $99/mo+ — their Webmaster Tools tier
is free for verified own-site usage. You get: every backlink pointing at
reviewhub.review (huge for SEO insight + competitor outreach), site audit
(broken links, redirects, schema errors), keyword positions you rank for.

**Steps:**

1. Go to **https://ahrefs.com/webmaster-tools** and sign up (free; use your
   business email earth.reviewhub@gmail.com or hello@reviewhub.review).
2. Click **"Add project"**.
3. Enter `https://reviewhub.review`.
4. Verification: pick **"HTML tag"** (mirrors the Bing flow).
5. Copy the token — looks like `abc123def456...` (longer than Bing's).
6. **Tell me the token** — I'll fill in the `<meta name="ahrefs-site-verification">`
   slot already in `client/index.html`.
7. Click **Verify** in Ahrefs.
8. Ahrefs starts crawling — first report ready in ~24h.

---

## 4. Google Alerts — competitor + brand monitoring (~3 min)

**What you get:** email pings when "ReviewHub", competitor names, or topic
keywords appear in new web content. Catches PR mentions, competitor launches,
and topical search trends without you actively monitoring.

**Steps:**

1. Go to **https://www.google.com/alerts** (signed into your Google account).
2. Create one alert per term. Recommended starter set:
   - `"ReviewHub"` (exact-match brand mentions — quotes matter)
   - `"reviewhub.review"` (URL mentions)
   - `Birdeye review` (competitor reviews / complaints)
   - `Podium reviews` (same)
   - `AI Google review reply` (people discussing the category)
   - `เครื่องมือ ตอบรีวิว Google` (Thai-language competitor scan)
3. For each: Sources = "Automatic", Language = "Any", Region = "Any",
   How many = "Only the best results", Deliver to = your email, How often
   = "As-it-happens" (or "At most once a day" if you don't want spam).
4. Click **Create Alert**.

---

## 5. Mail-tester — per-send deliverability (no signup, used per email)

**What you get:** every time you send a real outreach email, you can score
it 0-10 for spam-folder risk. Catches issues like missing SPF/DKIM, spammy
phrases, broken links, bad image-to-text ratio.

**Steps (run each outreach send through this):**

1. Go to **https://www.mail-tester.com**.
2. They show you a one-time email address — e.g. `test-abc123@mail-tester.com`.
3. From the Gmail account you'll send the real outreach from
   (`earth.reviewhub@gmail.com`), send your exact draft email to that address.
4. Back at mail-tester.com, click **"Then check your score"**.
5. Aim for 9/10 or higher. If lower, the report tells you exactly what to fix.

Free tier: 10 tests/day per IP. Plenty for our send volume.

---

## After all five are set up — what to do with the data

**Week 1 (this week):**
- Search Console: check which queries you're already getting impressions for
  → these become validated pillar keywords (no guessing).
- Clarity: watch the first 5-10 recorded sessions → where do users actually
  click? Where do they leave? That's your conversion-bottleneck list.
- Bing: same as Search Console but for ChatGPT-relevant index.
- Ahrefs: list of existing backlinks → outreach candidates ("hey, you linked
  to our blog post, want to test the audit tool?").

**Week 2:**
- Compare top GSC queries vs. proposed pillar head terms in
  `docs/seo-pillar-cluster-map.md` → adjust pillar wording to match
  what people actually search for.

**Ongoing:**
- Weekly Clarity scrub (10 min): watch 3-5 random sessions, note any UX
  surprises, add to operating queue.
- Monthly GSC review (15 min): top movers, top losers, new ranking pages.

---

## Where the integration code lives

- `client/src/main.jsx` — Clarity loader (env-var gated)
- `client/index.html` — Google verification (live), Bing + Ahrefs slots (commented)
- `server/src/app.js` — CSP whitelist for `*.clarity.ms`

Built: 2026-05-20 morning (post-overnight queue).
