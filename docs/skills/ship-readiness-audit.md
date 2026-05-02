# Ship-readiness audit

Recurring engineering checklist. Use it **every time** you ship a feature
that touches one of the surfaces below — or once a month as a drift sweep.

The pattern that justifies this file: across ~57 fixes shipped during the
persona-grind sessions, the single most common bug class was **"the new
thing was added but the existing X surface drifted out of sync."** Five
specific X surfaces drifted repeatedly:

1. Pricing source-of-truth consistency
2. GDPR completeness on schema additions
3. i18n coverage on new keys
4. Sitemap / robots / footer on new pages
5. Plan-gate `upgradeTo` correctness

If you ship a change without running the relevant check, you'll ship the
drift. Don't trust yourself to remember.

## How to use this

When shipping a feature, scan the section that matches the change. Each
section has a **trigger** (when it applies) and a **checklist** (the things
to verify). When in doubt, run all five — takes 10 minutes total.

Or paste this whole file into Claude after a ship and ask "audit my last
commit against this checklist."

---

## 1. Pricing source-of-truth

**Trigger:** anything that changes plan caps, tier feature lists, or
pricing copy. Includes:
- Editing `server/src/lib/billing/plans.js`
- Editing tier marketing claims on `/pricing` or `/`
- Editing FAQ entries about plans / limits
- Editing onboarding email day-7 (the plan-comparison email)
- Editing `support-response.md` skill file

**Why this drifts:** plans.js is the source of truth, but copy lives in
~7 surfaces. Updating one and forgetting the others is a 1-paste bug —
you tell day-7 email "5 AI replies/month free" while plans.js says 3.
Owner gets the email, hits the wall at 3, feels deceived.

**Checklist:**

- [ ] `server/src/lib/billing/plans.js` — actual source of truth: caps,
      feature flags, prices monthly + annual in USD + THB
- [ ] `client/src/pages/Pricing.jsx` — renders from the API but tier
      bullet copy is hardcoded; check
- [ ] `client/src/pages/Landing.jsx` — landing tier-card bullets +
      hero subtitle
- [ ] `client/src/i18n/translations.js`:
      - `pricing.faq*` answers
      - `landing.faq*` answers
      - `landing.plan.*` keys (free / starter / pro / business)
- [ ] `server/src/lib/email.js` — `ONBOARDING_STRINGS.*.7.body` AND
      `ONBOARDING_STRINGS.*.14.body` mention plans + caps in EVERY
      locale (en / th / es / ja / de / fr / it / pt / zh / ko)
- [ ] `docs/skills/support-response.md` — the support-reply playbook
      cites prices

**Grep the codebase** for stale numbers when in doubt:
```bash
grep -rn "5 AI\|50 AI\|3 platforms\|6 platforms\|up to [0-9] business" \
  server/src client/src docs
```

---

## 2. GDPR completeness on schema additions

**Trigger:** any new column on a table that holds user-tied data.
Includes:
- `migrateAddColumn('users', ...)` 
- `migrateAddColumn('businesses', ...)`
- `migrateAddColumn('subscriptions', ...)`
- New table that references `user_id` or contains an email column

**Why this drifts:** `server/src/lib/gdpr/dataSubjectRights.js` selects
fields explicitly (not `SELECT *`) and the erasure logic enumerates
tables by name. A new column doesn't auto-flow into the export, and a
new table doesn't auto-flow into erasure. Result: GDPR right-of-access
returns incomplete data, or right-to-erasure leaves PII behind.

**Checklist:**

- [ ] If it's a new column on an existing table that the export already
      covers (`users`, `businesses`, `subscriptions`, `templates`), add
      the new column to the SELECT list in
      `dataSubjectRights.collectUserPersonalData()`.
- [ ] If it's a new TABLE with `user_id REFERENCES users(id) ON DELETE
      CASCADE`, the rows are auto-deleted on user deletion — but the
      export query needs an addition to surface them.
- [ ] If it's a new TABLE with `user_id REFERENCES users(id) ON DELETE
      SET NULL` (e.g. support_tickets), the user_id gets nulled but any
      identifying columns (email, message body, customer_name) DO NOT
      get touched. Add an UPDATE statement to
      `anonymizeUserContent()` and **make sure it runs BEFORE
      `erasePersonalData()`** — the cascade clears the FK before the
      anonymization runs otherwise, and your WHERE user_id = ? matches
      zero rows. (Real bug shipped during this session — caught and
      fixed in commit `ee64083`.)
- [ ] Add the new category to `erasureLog.data_categories.push(...)`
      so the compliance audit row is accurate.
- [ ] If the new column / table contains email or message text, also
      verify it doesn't end up in `audit_log` content where the
      "we never log the user's submitted email body" rule applies.

---

## 3. i18n coverage on new keys

**Trigger:** any new `t(...)` call in client code, any new email subject
or body in `server/src/lib/email.js`.

**Why this drifts:** `t('key', 'fallback')` works fine for the
EN-speaking developer testing locally, but renders the English fallback
to every user whose locale doesn't have the key. Spanish-speaking
paying customers hitting an English string mid-flow is small but real
trust erosion.

**Checklist:**

- [ ] Decide explicitly: is this string user-visible enough to translate?
      - **Critical-path** (auth, billing, payment, error states,
        onboarding emails): translate to all 10 langs immediately
      - **Polish** (settings labels, deep features, admin tools):
        EN + TH at minimum, fallback OK for others, file as decision
        item to translate later
      - **Internal** (dev tooling, admin-only): EN only, fine
- [ ] If translating: add the key to **each** of the 10 language
      sections in `client/src/i18n/translations.js`. Anchor by finding
      a key that already exists in all 10 sections (e.g.
      `forgot.title`) and inserting yours at consistent positions.
- [ ] For email subjects + bodies: `ONBOARDING_STRINGS` has 10 langs
      now; other email helpers (`sendVerificationEmail`,
      `sendPasswordResetEmail`, etc.) typically have EN/TH/ES/JA — if
      you add a new transactional email type, decide whether it's
      critical-path (translate all 10) or not.
- [ ] Run a coverage check:
      ```bash
      grep "your_new_key_name" client/src/i18n/translations.js | wc -l
      ```
      Should be 10 (if critical-path) or your declared minimum.

**Bulk-translate strings that EXIST but are EN+TH-only** is a separate
ongoing task (decision item) — don't try to fix everything in one ship.

---

## 4. Sitemap / robots / footer on new public pages

**Trigger:** adding a new public route in `client/src/App.jsx` (a
`<Route path="/foo" ...>` that doesn't require auth).

**Why this drifts:** SEO crawlers + footer navigation are both
out-of-band from the route definition. A new `/roadmap` page that
isn't in the sitemap won't get indexed; if it's not in the footer, no
user except direct-link followers ever finds it.

**Checklist:**

- [ ] `client/public/sitemap.xml` — add a `<url>` entry with
      appropriate `<lastmod>`, `<changefreq>`, `<priority>`
- [ ] `client/public/robots.txt` — only add an `Allow: /your-path`
      line if it's a sensitive surface (auth-token URLs, etc.); the
      default `Allow: /` covers most public pages
- [ ] `client/src/pages/Landing.jsx` — footer columns (Product /
      Support / Legal); add to whichever fits
- [ ] `client/src/components/MarketingNav.jsx` — only if the page
      should be in the top nav (most don't need to be)
- [ ] If the page is auth-required: add to `Disallow:` in robots.txt
      AND set `usePageTitle` + `useNoIndex()` in the component
- [ ] If the page is logged-out-only (e.g. /login): typically already
      handled by the SPA route protection but verify

---

## 5. Plan-gate `upgradeTo` correctness

**Trigger:** any new `requireFeature(...)` or hardcoded `403` plan
gate in a server route.

**Why this drifts:** the original `requireFeature` hardcoded
`upgradeTo: 'starter'` for every feature gate. Wrong for users
already at or above Starter clicking on a Pro-tier feature. Same
problem applies to platform-cap gates: a Pro user at the 6-platform
limit being told to "upgrade to Business" wastes their money because
Business has the same 6-platform cap.

**Checklist:**

- [ ] If using the central helper: `requireFeature(userId, 'feature_key')`
      is correct — it walks the plan ladder via `findUpgradeTier()`.
      Don't reinvent.
- [ ] If using a hardcoded gate (legacy pattern in
      `routes/apiKeys.js`, `routes/templates.js`,
      `routes/reviews.js` exports), include `upgradeTo: 'tier_id'` in
      the JSON response so the client can render a targeted CTA.
- [ ] For capacity gates (max platforms, max businesses), use
      `findHigherCapacityTier(currentPlan, capacityKey)` —
      returns `null` when there's no higher tier with strictly
      greater capacity. Render a "you're at our top tier, email us"
      message when null instead of a useless upgrade CTA.
- [ ] Status codes: 402 (Payment Required) is technically more
      semantic, but existing tests assert 403. Don't churn unless
      doing a deliberate API-level cleanup.

---

## When to update this file

Add a new section if you ship a feature and discover ANOTHER recurring
"we forgot to update X" pattern. Don't add a section pre-emptively —
the ones above earned their place by drifting at least twice during
the persona-grind sessions.

Remove a section if a check becomes structurally enforced (e.g. a
typed schema that prevents the drift from happening at all).

The file's job is to catch what the type system + tests don't.
