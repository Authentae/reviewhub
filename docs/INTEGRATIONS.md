# Integrations — what's wired, what you do next

A single index of every external service ReviewHub plugs into. Three columns:
- **Code shipped** — server/client integration code is in the repo
- **Setup needed** — exact steps you take (5–15 min each)
- **Status** — `ACTIVE` (working in production) · `READY` (code shipped, waiting on your env vars) · `RUNBOOK` (docs only, no code)

| Service | Code shipped | Setup needed | Status |
|---|---|---|---|
| **Anthropic Claude** | `server/src/lib/aiResponseGenerator.js` | Set `ANTHROPIC_API_KEY` on Railway | ✅ ACTIVE |
| **LemonSqueezy billing** | `server/src/lib/billing/lemonsqueezy.js` | Set `LEMONSQUEEZY_API_KEY` + 5 more env vars | ✅ ACTIVE |
| **Sentry (server)** | `server/src/lib/errorReporter.js` | Set `SENTRY_DSN` on Railway | ✅ ACTIVE |
| **Sentry (frontend)** | `client/src/main.jsx` | Set `VITE_SENTRY_DSN` at build time | 🟡 READY |
| **Plausible analytics** | `client/index.html` (auto-injects on prod hostname) | Sign up at plausible.io, register `reviewhub.review` | 🟡 READY |
| **LINE Messaging push** | `server/src/lib/notifications/line.js` | See [`line-setup.md`](runbooks/line-setup.md) | 🟡 READY |
| **Outbound webhooks** | `server/src/lib/webhookDelivery.js` + Settings UI | Already in product. Customers wire their own URLs. | ✅ ACTIVE |
| **Zapier / Make / n8n** | (uses outbound webhooks above) | See [`webhooks-zapier.md`](runbooks/webhooks-zapier.md) | 📖 RUNBOOK |
| **UptimeRobot monitoring** | `/api/health` endpoint | See [`uptime-monitoring.md`](runbooks/uptime-monitoring.md) | 📖 RUNBOOK |
| **Resend SMTP** | `server/src/lib/email.js` | Set `SMTP_*` env vars on Railway | ✅ ACTIVE |
| **Google OAuth** (review platform) | `server/src/lib/providers/google.js` | Set `GOOGLE_CLIENT_ID/SECRET` | ✅ ACTIVE |
| **Frill feedback widget** | `client/src/components/FrillWidget.jsx` | See [`frill-setup.md`](runbooks/frill-setup.md) | 🟡 READY |
| **PromptPay (TH instant pay)** | `server/src/lib/promptpay.js` + `/api/billing/promptpay` | See [`promptpay-setup.md`](runbooks/promptpay-setup.md) | 🟡 READY |
| **Locale platform registry** | `server/src/lib/platforms.js` + `client/src/lib/platforms.js` | None — auto-active per user locale | ✅ ACTIVE |
| **Email forwarding (auto-import)** | `server/src/routes/inbound.js` + `server/src/lib/inbound/parsers.js` | See [`mailgun-inbound.md`](runbooks/mailgun-inbound.md) | 🟡 READY |

## Quick activation list (in order of leverage)

If you do these 4 in the next hour, you're production-grade for launch:

### 1. Sentry frontend (5 min, biggest debugging win)
- Railway → Variables → `+ New Variable`
- Name: `VITE_SENTRY_DSN`
- Value: same as your existing `SENTRY_DSN`
- Save → Railway redeploys → frontend errors now flow to Sentry alongside server errors

### 2. Plausible (10 min, free, see your traffic)
- <https://plausible.io/sign-up>
- Add site: `reviewhub.review`
- That's it — the snippet auto-loads on the production hostname (already wired in `client/index.html`)
- Bookmark `https://plausible.io/reviewhub.review`

### 3. UptimeRobot (5 min, free, know about Railway downtime)
- Follow [`uptime-monitoring.md`](runbooks/uptime-monitoring.md)
- 1 monitor on `https://reviewhub.review/api/health` → email alerts on `theearth1659@gmail.com`

### 4. LINE notifications (10 min, free 200/mo)
- Follow [`line-setup.md`](runbooks/line-setup.md)
- Get pinged in LINE every time a review lands

## Skip-until-paying-customers list

Don't waste pre-launch time on these:

- **Wongnai partnership** — TH's #1 review site, but partner-only API. Approach after you have 50 paying TH SMBs as proof.
- **Booking.com / Agoda** — hotel reviews need partner agreement.
- **Naver Place / Dianping / Tabelog** — same partnership story per locale (KR / CN / JP).
- **LINE Login** — frictionless TH signup; security-sensitive surface. Defer until paying-customer scale, then build with proper PKCE + account linking.
- **Custom Zapier app** — outbound webhooks already cover the use case.
- **Stripe / Paddle** — backup billing providers. Only switch from LemonSqueezy if LS becomes a problem.

## How this list updates

Each new integration: ship the code, drop a runbook in `docs/runbooks/`, add the row to this table. One file as the entry point.
