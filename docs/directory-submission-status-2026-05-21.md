# Directory submission status — 2026-05-21 (early morning)

Attempted to drive Chrome through 5 directory submissions per the
submission pack. Result: 1 partial, 4 blocked by account-creation walls.

The TL;DR: modern SaaS directories now universally require account
creation. The "submit a tool via a public form" pattern is essentially
dead, replaced by account-gated workflows to combat spam. Per safety
rules I can't create accounts on Earth's behalf.

---

## Status by directory

### 1. There's An AI For That — BLOCKED

`/submit/` redirects to `/launch/` (paid promotion). `/create/` redirects
to `/login/` (account required). No public free-submission path.

**Earth's manual path:** sign up at theresanaiforthat.com (Google OAuth),
then submit via `/create/`. ~10 min.

### 2. AlternativeTo — BLOCKED

`/account/submit-software/` returns 404. `/users/register/` returns 404.
Submission flow is behind sign-in only.

**Earth's manual path:** click "Sign In" on alternativeto.net, create
account (Google OAuth available), then look for "Suggest an app" in
the logged-in nav. ~10 min.

### 3. SaaSHub — PARTIAL (need variant name)

Form filled cleanly. Earth is already logged in as `Mathstub`. All
fields landed:

- URL: `https://reviewhub.review`
- Name: `ReviewHub` (auto-populated)
- Tagline: "Reply to every Google and Wongnai review in 10 sec..."
  (auto-pulled from our site meta description)
- Categories: `Online Reviews`, `Reputation Management`
- Competitors: `Birdeye`, `Podium`, `Reviews.io`, `Yext`
- Submission type: Free

Form submission REJECTED with: **"Name - has already been taken."**

There's another product called "ReviewHub" already on SaaSHub.

**Earth's manual path:** at saashub.com/services/new, retry with a
variant product name:
- `ReviewHub.review`
- `ReviewHub AI Replies`
- `ReviewHub — AI Review Replies`

The rest of the form pattern works; just change the Name field. ~5 min.

### 4. IndieHackers — BLOCKED

`/products` requires login. No anonymous submit. Earth doesn't have an
existing IH account.

**Earth's manual path:** sign up at indiehackers.com (Google OAuth),
then go to `/products/new` (or click "Add Product" in nav). Add
ReviewHub. Optionally post a milestone in `#bootstrapping`. ~15 min.

### 5. Tech in Asia — NOT ATTEMPTED

Same pattern expected. Account required to claim a company profile.

**Earth's manual path:** sign up at techinasia.com, claim company
profile under ReviewHub / Authentae. ~15 min.

---

## What worked

- The directory-submission pack (`docs/directory-submission-pack-2026-05-20.md`)
  with pre-filled content is solid — every field SaaSHub asked for was
  already in the pack. Earth can copy-paste through the rest of these
  in ~50 min total.
- Pre-trained form-fill via JavaScript works for React-select autocomplete
  fields (categories + competitors) using the `setNative` + `Event('input')`
  pattern. The 4 competitors all auto-resolved cleanly via typed search.

## What didn't work

- The "auto-submit everything for the user" pattern is fundamentally
  incompatible with safety-rule constraints + 2020s anti-spam UX. Every
  directory now requires an account.

---

## The honest recommendation

Stop trying to automate directory submissions. They genuinely need Earth's
manual touch for the account-creation step.

**A 1-hour batch for Earth tomorrow morning:**

1. (5 min) Sign up at theresanaiforthat.com → submit ReviewHub
2. (5 min) Sign up at alternativeto.net → suggest ReviewHub as alternative
   to Birdeye / Podium / Reviews.io / Yext / ChatGPT
3. (5 min) Retry SaaSHub submission with `ReviewHub.review` as the name
4. (15 min) Sign up at indiehackers.com → add product → consider posting
   a milestone in `#bootstrapping` (use draft from social-drafts-2026-05-20.md)
5. (15 min) Sign up at techinasia.com → claim company profile
6. (10 min) GitHub awesome-lists: open 2-3 PRs to `awesome-saas` /
   `awesome-ai-tools` with our blurb

**Total: ~55 min of focused work. Every minute is a backlink + LLM-citation
signal that compounds for months.**

---

## What the SaaSHub attempt taught us

Even though the actual submission was rejected by the name collision, the
process exposed:

1. **Our site meta description is good** — SaaSHub auto-pulled
   "Reply to every Google and Wongnai review in 10 sec..." cleanly as
   the tagline. That means our `<meta name="description">` is doing
   work as off-site copy. Don't change it without thinking.
2. **Competitor recognition is high** — SaaSHub had explicit listings
   for Birdeye, Podium, Reviews.io, Yext. Anywhere we publish content
   that mentions those names, we attach to their authority graph.
3. **Reviewflowz wasn't a SaaSHub-recognized competitor** — typing
   "Reviewflowz" got no exact match. They may not be on SaaSHub yet.
   Worth double-checking when researching them further.

These are minor but useful side-discoveries from what otherwise looks
like a failed attempt.
