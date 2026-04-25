# ReviewHub — Setup Guide

## Prerequisites

1. **Install Node.js** (v18 or higher): https://nodejs.org/
   - Download the LTS version and run the installer
   - Restart your terminal after installation

## Quick Start

Open a terminal in `C:\Users\Computer\Desktop\App` and run:

```bash
# 1. Install all dependencies
npm run install:all

# 2. Start both server and client together
npm run dev
```

Then open http://localhost:5173 in your browser.

## Demo Account

Email: `demo@reviewmanager.app`
Password: `demo123`

The demo account has 12 sample reviews pre-loaded across Google, Yelp, and Facebook. It is pre-flagged as email-verified so you won't see the verification banner on login.

## Manual Start (if concurrently fails)

Open **two** terminals:

**Terminal 1 — Backend:**
```bash
cd C:\Users\Computer\Desktop\App\server
npm install
npm run dev
# Server runs on http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd C:\Users\Computer\Desktop\App\client
npm install
npm run dev
# App runs on http://localhost:5173
```

## Running Tests

From the repo root:
```bash
npm test
```

Runs both suites: server (49 tests, node:test + supertest) and client (45 tests, Vitest + React Testing Library). Total 94 tests covering auth flows, reviews CRUD, platform sync pipeline, data export, digest job, audit log, token hashing; plus frontend i18n, theme context, auth helpers, and component-level contracts for Login, ForgotPassword, PasswordStrength, and ReviewCard.

Individual suites:
```bash
npm run test:server   # 49 backend tests, no external deps (tmp SQLite, console email)
npm run test:client   # 45 frontend tests, jsdom + axios mocked
```

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Backend HTTP port |
| `JWT_SECRET` | **required in prod** | HS256 signing secret (≥32 chars) |
| `CLIENT_URL` | `http://localhost:5173` | Used in email links + CORS |
| `DATABASE_PATH` | `server/data/reviews.db` | SQLite file location |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | unset → console fallback | Outbound email |
| `SYNC_INTERVAL_MS` | `900000` (15 min) | Review sync poll cadence. Set `0` to disable. |
| `DIGEST_INTERVAL_MS` | `604800000` (7 d) | Weekly digest cadence. Set `0` to disable. |
| `ENABLE_MOCK_PROVIDER` | unset | **Prod only**: opt-in to MockProvider when real creds are missing. Without this flag, prod syncs against unconfigured providers fail with a "not configured" error (surfaced in `last_sync_error`) rather than silently inserting fake reviews. Dev defaults to mock fallback. |
| `DISABLE_MOCK_PROVIDER` | unset | Force real providers only everywhere; ignored if `ENABLE_MOCK_PROVIDER` is set (legacy; prefer the new flag). |
| `ANTHROPIC_API_KEY` | unset | Activates real AI-drafted review replies via the Anthropic API. Without it, the `/api/reviews/:id/draft` endpoint returns a template from the built-in pool (indicated by `source: "template"` in the response). With it, `source: "ai"`. |
| `ANTHROPIC_MODEL` | `claude-opus-4-7` | Override the model. Common alternatives: `claude-sonnet-4-6` (cheaper, slightly less capable), `claude-haiku-4-5` (cheapest, fastest). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | unset | Activates Google Business Profile provider (stub — needs impl) |
| `YELP_API_KEY` | unset | Activates Yelp provider (stub — needs impl) |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | unset | Activates Facebook provider (stub — needs impl) |

## Features Currently Wired

- **Auth**: register, login, **httpOnly-cookie session** (`rh_session`, `HttpOnly; SameSite=Lax; Secure in prod; Path=/`, 7-day TTL), CSRF protection via required `X-Requested-With: XMLHttpRequest` header on cookie-authed state-changing requests (browsers can't set it cross-origin without a CORS preflight, and CORS only allows `CLIENT_URL`). Legacy `Authorization: Bearer <jwt>` still accepted for non-browser clients (curl, mobile, CI) and during client rollout. `POST /auth/logout` clears the cookie. Password change, email verification, password reset, 2FA-via-email, and a GDPR data export round out the auth surface.
- **Email verification**: token sent on register, 24 h expiry, soft banner if unverified
- **Password reset**: forgot-password → email with 1 h token → set new password
- **Two-factor auth (email OTP)**: optional per-user. When enabled, login returns a 10-minute `mfaPendingToken` instead of a full JWT; user submits a 6-digit code emailed to them (or one of 10 one-time recovery codes generated at enablement) to complete sign-in. Codes and recovery codes are stored as SHA-256 hashes. Recovery codes use a safe alphabet (no 0/1/O/I) and are marked `used_at` on consumption
- **Reviews**: CRUD, filter (platform/sentiment/rating/responded/search), sort, paginate, CSV export with user-filter state preserved, per-review private notes
- **AI draft replies**: real Anthropic API integration via `lib/aiDrafts.js` when `ANTHROPIC_API_KEY` is set, with automatic fallback to a curated template pool when the key is missing or the API errors. The response's `source` field tells callers which path ran (`"ai"` vs `"template"`).
- **Response templates**: per-user library, limit 10
- **Platform sync**: `platform_connections` table per provider; mock provider generates 3–5 synthetic reviews on first sync, 30% chance of 1 new per tick thereafter; real Google/Yelp/Facebook providers are stubs (gated on env vars)
- **Weekly email digest**: job runs on configurable interval, per-user opt-in, silent on zero activity
- **GDPR data export**: `GET /api/auth/me/export` returns full JSON dump (account, reviews, templates, connections, audit log), no token secrets
- **Account deletion**: cascades through all user-owned rows in a single transaction
- **Audit log**: records register, login, login_failed (without attempted email), password_changed, email_verified, password_reset, account deletion
- **Structured error reporting**: JSON to stderr in prod, human-readable in dev; `src/lib/errorReporter.js` — one-line swap for Sentry/Datadog
- **Health check**: `/api/health` reports DB + SMTP component status, returns 503 when any critical dep is down
- **i18n**: 9 languages; legal-page body text is authoritative-English with explicit fallback documented in `client/src/i18n/translations.js`

## Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Set these environment variables in Vercel dashboard:
- `JWT_SECRET` — long random string (≥32 chars)
- `CLIENT_URL` — your Vercel deployment URL
- SMTP config if you want real email (otherwise links are logged to stdout)

## Project Structure

```
App/
├── .github/workflows/test.yml    # CI: runs server tests + client build + i18n check
├── client/                       # React + Vite + Tailwind frontend
│   └── src/
│       ├── pages/                # Landing, Login, Register, Dashboard, Settings,
│       │                         # Pricing, VerifyEmail, ForgotPassword, ResetPassword,
│       │                         # Terms, Privacy, NotFound
│       ├── components/           # ReviewCard, Navbar, Toast, ErrorBoundary,
│       │                         # SessionExpiryBanner, EmailVerifyBanner, etc.
│       ├── context/              # I18nContext, ThemeContext
│       ├── hooks/                # usePageTitle, useUnrespondedCount
│       ├── i18n/translations.js  # All 9 languages
│       └── lib/                  # api.js (axios), auth.js (JWT helpers)
├── server/                       # Express + better-sqlite3 backend
│   ├── src/
│   │   ├── app.js                # Express factory (importable by tests)
│   │   ├── index.js              # Boot: getDb → createDemoUser → listen + schedulers
│   │   ├── routes/
│   │   │   ├── auth.js           # register, login, /me, verify/resend, forgot/reset,
│   │   │   │                     # password change, notifications, data export, delete
│   │   │   ├── reviews.js        # list/filter/CRUD, draft, respond, note, export
│   │   │   ├── businesses.js     # profile + platform ID mirror → platform_connections
│   │   │   ├── templates.js      # per-user response template CRUD
│   │   │   └── platforms.js      # list connections, manual sync
│   │   ├── jobs/
│   │   │   ├── syncReviews.js    # sync worker + scheduler
│   │   │   └── weeklyDigest.js   # digest worker + scheduler
│   │   ├── lib/
│   │   │   ├── email.js          # SMTP + console fallback; all transactional emails
│   │   │   ├── tokens.js         # generate/hash/verify email + reset tokens
│   │   │   ├── audit.js          # audit-log writer
│   │   │   ├── errorReporter.js  # structured error capture
│   │   │   └── providers/        # platform abstraction (base, mock, google, yelp, facebook)
│   │   ├── middleware/auth.js    # JWT verify (HS256-pinned)
│   │   └── db/
│   │       ├── schema.js         # better-sqlite3 init + idempotent migrations
│   │       └── seed.js           # demo user + review seed
│   ├── tests/                    # node:test + supertest (49 tests)
│   │   ├── tokens.test.js
│   │   ├── auth.test.js
│   │   ├── reviews.test.js
│   │   ├── platforms.test.js
│   │   └── export-digest.test.js
│   └── data/reviews.db           # SQLite file (WAL mode)
└── vercel.json                   # Deployment config
```

## What's Missing (for real production)

- **Real platform API calls** — Google/Yelp/Facebook providers are stubs. Fill in the `fetchReviews()` method in each to hit the real API; OAuth flow for Google/Facebook is not yet implemented.
- **Billing** — subscription rows exist but aren't wired to Stripe. Add `/billing/*` routes and `stripe_customer_id`/`stripe_subscription_id` columns when ready.
- **Real platform-review content for AI drafts** — `ANTHROPIC_API_KEY` activates real AI drafts, but they're only as good as the review data, which today is manually-entered or mock-synthesized. Real platform sync plus real AI drafts is the full product.
- **Multi-location** — one business per user is enforced by `UNIQUE(user_id)` on `businesses`; this is a dealbreaker for the target market (local chains). Plan a schema revision.
- **Team / RBAC** — no concept of invited collaborators yet.
- **Frontend XSS → token theft** is now mitigated — the session cookie is `HttpOnly`, so `document.cookie` can't read it. The legacy localStorage token write is still present for migration compat; it becomes dead code once every client has reloaded on the new build and can be removed (delete `LEGACY_TOKEN_KEY` from `client/src/lib/auth.js`).
- **Authenticator-app TOTP (in addition to email OTP)** — email OTP is implemented; true TOTP via Google Authenticator / 1Password / etc. would need `otplib` or equivalent, a QR-code display on enablement, and a 30-second window comparison. Design is ready: the provider pattern in `lib/mfa.js` abstracts the code-hash comparison; the routes check `user.mfa_enabled` as a boolean, not a method, so a second method can be added without changing the challenge flow.
