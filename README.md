# ReviewHub

The review dashboard for local businesses. Aggregate Google, Yelp, Facebook,
TripAdvisor, Trustpilot, and Wongnai reviews in one feed; reply with
AI-drafted responses; track sentiment and ratings over time.

## Stack

- **Server** — Node.js (CommonJS) · Express · better-sqlite3 · bcryptjs ·
  jsonwebtoken · nodemailer · LemonSqueezy billing · Anthropic SDK for AI
  drafts · helmet · express-rate-limit
- **Client** — React 18 · Vite · Tailwind CSS · react-router-dom · axios · vitest
- **Tests** — 557+ server (`node:test` + supertest) + 169+ client
  (vitest + Testing Library) — green on every push via GitHub Actions.
  Counts grow with new features; run `npm test` (server) and
  `npx vitest run` (client) for the current totals.

## Running locally

```bash
# server (port 3001)
cd server
npm install
node src/index.js

# client (port 5173, proxies /api → 3001)
cd client
npm install
npx vite
```

Visit <http://localhost:5173> and sign in with the seeded demo account:
`demo@reviewmanager.app` / `demo123`.

## Test

```bash
cd server && npm test       # node:test + supertest
cd client && npx vitest run # vitest + RTL
```

## Production deployment

The repo ships Dockerfiles and a `docker-compose.yml` for self-hosted
deployment. Create `server/.env` with the required secrets (see
[`docker-compose.yml`](./docker-compose.yml) header for the full list):

```env
JWT_SECRET=<48+ random bytes base64url>  # required, ≥32 chars in prod
CLIENT_URL=https://your-domain.com       # required, used by CORS + email links
SMTP_HOST=...                            # email delivery
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="ReviewHub <noreply@your-domain.com>"

# Optional:
GOOGLE_CLIENT_ID=...                     # Google OAuth for review sync
GOOGLE_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://your-domain.com/api/platforms/google/oauth/callback
ANTHROPIC_API_KEY=...                    # AI draft replies (falls back to templates if unset)
LEMONSQUEEZY_API_KEY=...                 # billing (falls back to no-billing if unset)
LEMONSQUEEZY_WEBHOOK_SECRET=...
LS_VARIANT_STARTER_MONTHLY=...           # variant IDs per plan × cycle
# ...
ADMIN_EMAIL=you@your-domain.com          # gates /api/admin/* to this user
SENTRY_DSN=https://...                   # error forwarding (no SDK dep)
```

Then:

```bash
docker compose up -d --build
```

API → `localhost:3001`, client → `localhost:8080`. Put them behind a reverse
proxy with TLS in production.

### Backup

SQLite file lives on the `rh-data` volume. The repo ships an online-backup
script:

```bash
# ad-hoc
docker compose exec api node scripts/backup-db.js

# cron on the host (inside the container's /app/backups via the volume)
0 3 * * *  docker compose exec -T api node scripts/backup-db.js
```

### Admin

`GET /api/admin/stats`, `/api/admin/audit`, `/api/admin/users` are open to
the user whose email matches `ADMIN_EMAIL`. Non-admins see 404 (not 403 —
avoid enumerating the admin surface). Read-only by design; for data writes
use SQL directly against the DB file.

## Architecture highlights

- **Auth** — JWT in an httpOnly cookie (`rh_session`, SameSite=Lax, 7d TTL).
  Bearer fallback accepted during migration. CSRF protection via custom
  `X-Requested-With` header; cookie-authed POSTs without it → 403.
- **CSP** — helmet default-src `'self'` in API responses; `client/nginx.conf`
  ships a stricter CSP with an allowlisted `sha256-...` for the inline
  theme-flash script in `index.html`. If that script's bytes change,
  recompute the hash in **both** places.
- **i18n** — 10 languages (en/es/fr/de/pt/it/th/ja/zh/ko). Non-legal body
  keys must exist in all 10; legal bodies are EN-only (`t()` falls back).
  Source of truth: `client/src/i18n/translations.js`.
- **Billing** — LemonSqueezy (Merchant of Record). Webhook at
  `/api/billing/webhook` uses raw body + HMAC-SHA256 verification. Rate-limited
  60/min/IP. Plan catalogue lives in `server/src/lib/billing/plans.js` — edit
  there to change pricing/features; the client renders from `/api/plans`.
- **Providers** — `server/src/lib/providers/`. Google is real (with
  refresh-token rotation + Business Profile API v4 for reviews, requires
  Google allowlist for the reviews endpoint). Yelp/Facebook/TripAdvisor/
  Trustpilot/Wongnai are stubs — structure is in place, operator needs to
  fill in the API calls when credentials are available.
- **Rate limiting** — per-route limits on mutations (see individual route
  files). `/api/billing/webhook` and `/api/admin/*` are also limited.
  `trust proxy` is set in production so real client IPs flow through the
  reverse proxy into the limiter.
- **Audit log** — `audit_log` table captures security-sensitive events
  (register, login/login_failed, password_changed, mfa_enabled/disabled,
  terms_accepted, billing.*). GDPR export includes up to the last 1000
  entries for the user. Operator sees aggregate data via
  `/api/admin/audit`.

## Repo layout

```
.
├── server/              # Express API
│   ├── src/
│   │   ├── app.js       # Express factory (used by index.js + tests)
│   │   ├── index.js     # Bootstrap (listen + schedulers)
│   │   ├── db/schema.js # Migrations + helpers
│   │   ├── routes/      # One file per feature
│   │   ├── lib/         # billing, providers, aiDrafts, mfa, …
│   │   └── jobs/        # Sync worker + weekly digest scheduler
│   ├── scripts/         # backup-db.js
│   └── tests/           # node:test + supertest
├── client/              # React SPA
│   ├── src/
│   │   ├── App.jsx      # Routes + Suspense boundaries
│   │   ├── main.jsx
│   │   ├── pages/       # Landing, Dashboard, Settings, auth, legal, …
│   │   ├── components/  # ReviewCard, Navbar, MfaSection, AuthSideArt, …
│   │   ├── context/     # I18n + Theme
│   │   ├── hooks/       # usePageTitle, useUnrespondedCount
│   │   ├── lib/         # api.js, auth.js
│   │   └── i18n/        # 10-language translations
│   └── src/__tests__/   # vitest + Testing Library
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Design system

- Brand gradient: `bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900`
  with a radial overlay for depth (Landing hero + `AuthSideArt` share this).
- Icons are inline SVGs (`currentColor` strokes) — not emoji — for cross-OS
  consistency.
- Tailwind tokens: `.card`, `.input`, `.btn-primary`, `.btn-secondary` in
  `client/src/index.css`.
- `prefers-reduced-motion: reduce` kills all transitions. Also ships an inline
  theme-flash-prevention script in `index.html` (allowlisted in CSP).

## License

Proprietary — © 2026 ReviewHub. All rights reserved.
