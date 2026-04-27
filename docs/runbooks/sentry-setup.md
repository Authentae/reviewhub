# Sentry setup runbook

> Copy-paste through. ~15 minutes start to finish. Free Sentry tier
> covers a solo founder for ~12 months.

The error reporter (`server/src/lib/errorReporter.js`) is already wired
to forward exceptions to Sentry when `SENTRY_DSN` is set. You just need
to: create a Sentry project, paste the DSN into Railway, and
(optionally) wire the frontend.

## Why bother now

Right now, when a user hits a server error in production, the stack
trace goes to Railway's stdout and disappears after 7 days. You won't
hear about bugs unless the user emails you. Most won't — they'll just
churn.

After this runbook:
- Server errors land in your inbox grouped by error type
- You see exactly which commit introduced a regression
- Bugs show up *before* customers complain

## Server-side (10 minutes, do this first)

### 1. Create the Sentry account

- Go to <https://sentry.io/signup/>
- Sign up with `theearth1659@gmail.com`
- When asked for "the type of project", pick **Node.js**
- Project name: `reviewhub-server`
- Team: leave default

### 2. Copy the DSN

- After project creation Sentry shows a "Configure Node.js" screen
- The DSN looks like: `https://abc123@o12345.ingest.sentry.io/67890`
- Copy it. You'll need it in step 4.

### 3. Adjust alert rules to something sane

Sentry's default alerts are noisy. Before you wire it:

- Settings → Alerts → "Send a notification for new issues" — disable
- Settings → Alerts → Create alert:
  - **When**: A new issue is created
  - **And**: The issue has happened more than 3 times in 5 minutes
  - **Then**: Send notification to your email

(Without this you'll get an email every time anyone hits a 500 — even
once. That's spam, not signal.)

### 4. Set the DSN on Railway

- Railway → ReviewHub service → Variables tab
- Click "+ New Variable"
- Name: `SENTRY_DSN`
- Value: the DSN from step 2
- Click "Add"
- Railway will auto-redeploy in ~90s

### 5. Verify it's working

After redeploy completes:

```bash
curl https://reviewhub.review/api/health
```

Then deliberately trigger an error to test:

```bash
# Hit a non-existent endpoint that throws — server will log + report
curl https://reviewhub.review/api/admin/stats
```

(That returns 401, not a server error. Better test: log in, hit
`/api/auth/me`, then forcibly kill your auth cookie mid-session and
navigate around. Or just wait — real errors will arrive within hours.)

Open Sentry → Issues. The first error appears within 30 seconds of
firing.

## Frontend-side (optional, 20 minutes)

The client doesn't have Sentry wired yet. Most server errors are
catchable via the existing global error middleware so server-side
alone gives you 80% of the value. Skip this section unless:

- You're seeing user-reported bugs that don't appear in server Sentry
- You want client-side breadcrumbs (clicks, route changes) in error reports

### 1. Create a second Sentry project

- Sentry → Projects → "+ Create Project"
- Type: **React**
- Project name: `reviewhub-client`
- Copy the new DSN

### 2. Install the Sentry SDK

```bash
cd client
npm install @sentry/react
```

### 3. Wire `Sentry.init` in `main.jsx`

Add at the very top of `client/src/main.jsx`, before the React import:

```jsx
import * as Sentry from '@sentry/react';

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: 'production',
    tracesSampleRate: 0.1,            // 10% of transactions sampled
    replaysSessionSampleRate: 0,      // no session replay (privacy + cost)
    replaysOnErrorSampleRate: 0.1,    // 10% replay only on errors
  });
}
```

### 4. Replace your ErrorBoundary with Sentry's

In `client/src/main.jsx`, change:

```jsx
import ErrorBoundary from './components/ErrorBoundary';
```

to:

```jsx
import * as Sentry from '@sentry/react';
import ErrorBoundary from './components/ErrorBoundary';
const SentryErrorBoundary = Sentry.withErrorBoundary(ErrorBoundary, {
  fallback: <div>Something went wrong. We've been notified.</div>,
});
```

(Or wrap the existing one — `Sentry.ErrorBoundary` composes cleanly.)

### 5. Add the env var to Vite

`.env.production` in `client/`:

```
VITE_SENTRY_DSN=https://abc123@o12345.ingest.sentry.io/67891
```

Don't commit `.env.production` (already gitignored). Set the same var
in Railway under the client service if you have one, or as a build-time
arg in the Dockerfile.

### 6. Update the server CSP allowlist

`server/src/app.js` — helmet's CSP currently restricts `connect-src`
to `'self'`. Sentry needs to send events to its own host:

```js
connectSrc: ["'self'", 'https://*.ingest.sentry.io'],
```

Without this, the browser blocks the outbound POST and Sentry never
receives anything (you'll see the error in console: "blocked by CSP").

## Cost forecast

- **Free tier**: 5,000 errors/month, 30-day retention
- **Realistic load** for a 0–100 user SaaS: ~50–500 errors/month
- **Threshold to upgrade ($26/mo)**: ~2,500 errors/month — you'll be
  on the paid plan only when you have a few thousand monthly active
  users. Worry about it then.

## How to actually use Sentry day-to-day

- **Mornings**: 30 second skim of "Issues" tab — anything new?
- **Before big releases**: check the "Releases" tab — does the prior
  release have any unresolved issues?
- **When a user reports a bug**: search Sentry for their `userId` —
  see exactly what error they hit and the stack trace
- **Don't read every error**. The alert rule (3+ in 5 min) is the
  signal. Everything below that is noise.

## When to skip Sentry entirely

If you're only ever going to have ≤10 paying customers and they all
have your phone number, skip it. Email-based bug reports + Railway's
stdout logs are sufficient at that scale.
