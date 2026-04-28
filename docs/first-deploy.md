# First Deploy — Step by Step

Read this from top to bottom. Do every step in order. Estimated time: **3-5 hours** the first time, spread across 2-3 services you have to sign up for.

You will personally need:
- A credit card (for ~$5-20/mo hosting + ~$0-20/mo SMTP)
- An email address for service signups
- A phone that can receive SMS (for 2FA on some services)
- A domain name if you want something better than `reviewhub-abc.railway.app` (~$10-15/year)

## Part 1 — Code in GitHub (20 minutes)

You need your code in GitHub before any hosting provider can deploy it.

1. Sign up at https://github.com (free)
2. Click **New repository** → name it `reviewhub` → set to **Private** → **Create repository**
3. In your Windows terminal:

```bash
cd C:\Users\Computer\Desktop\App
git init
git add -A
git commit -m "Initial import"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/reviewhub.git
git push -u origin main
```

4. Refresh the GitHub page. You should see all your files.

If anything goes wrong at this step — paste the error back here and I'll tell you how to fix it.

## Part 2 — Hosting: Railway (30 minutes)

**Why Railway over other options:** no Linux knowledge required, runs the Dockerfile you already have, has persistent disk for SQLite, ~$5/mo, SSL included, env vars in a UI. For a solo founder who's never deployed, this is the shortest path.

1. Sign up at https://railway.app using **Login with GitHub** (free tier; you'll add a credit card for beyond-trial usage)
2. Click **New Project** → **Deploy from GitHub repo** → select `reviewhub`
3. Railway will detect the Dockerfile at `server/Dockerfile` — in the service settings, set:
   - **Root Directory:** `server`
   - **Build Command:** (leave empty — uses Dockerfile)
   - **Start Command:** (leave empty — uses Dockerfile CMD)
4. **Add a Volume** (critical — SQLite data lives here):
   - In the service → **Settings** → **Volumes** → **New Volume**
   - Name: `rh-data`
   - Mount Path: `/app/data`
   - Size: 1 GB is plenty to start
5. Set the `DATABASE_PATH` environment variable to `/app/data/reviewhub.db` (see Part 3 for where)
6. Click **Deploy**. First build takes ~3-5 minutes.
7. Go to **Settings** → **Networking** → **Generate Domain**. You'll get `reviewhub-production-xxxx.up.railway.app` or similar. That's your temporary URL.

Browse to `https://<your-railway-url>/api/health`. If you see a JSON response with `"status":"ok"` or similar, the server is live.

The client (React app) is a separate service. In Railway:
1. In the same project, click **+ New** → **GitHub Repo** → same repo
2. Set **Root Directory:** `client`
3. Railway will detect it as a Node/Vite app. You need a separate Dockerfile for the client — use this, save as `client/Dockerfile`:

```dockerfile
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

Actually, easiest: skip separate client hosting and have the API serve the client's built assets. See Part 2.5 below.

### Part 2.5 — Simpler: serve client from API (skip if you prefer separate)

Open `server/src/app.js` and check if it already has a static middleware block. If yes, you just need to run `cd client && npm run build`, then ensure the built `client/dist/` is bundled into the Docker image. I can patch this in the next turn if you want — tell me "bundle client into server" and I'll wire it.

## Part 3 — Environment variables (30 minutes)

In Railway, on your `server` service → **Variables** tab → add these:

### Required — app will not start without these

```
NODE_ENV=production
PORT=3001
DATABASE_PATH=/app/data/reviewhub.db
JWT_SECRET=<generate this: see below>
CLIENT_URL=https://<your-railway-domain>
```

Generate a JWT secret (paste into your terminal):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Copy the output. Paste it as the `JWT_SECRET` value in Railway.

### Email — required for signup verification, password reset, weekly digest

Sign up at **Brevo** (formerly Sendinblue): https://www.brevo.com — free tier gives you 300 emails/day, enough for launch.

1. Complete signup + verify your email
2. Go to **SMTP & API** → **SMTP** → copy the credentials
3. Add to Railway:

```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<your Brevo smtp login>
SMTP_PASS=<your Brevo smtp password>
SMTP_FROM=ReviewHub <no-reply@yourdomain.com>
SMTP_SECURE=false
```

Note: Brevo and most providers require you to verify a sender domain (set SPF/DKIM DNS records). They'll walk you through it in their dashboard. Takes 10-30 minutes.

### AI drafts — optional, falls back to template pool if missing

1. Sign up at https://console.anthropic.com (credit card required, pay-as-you-go)
2. Add ~$20 credit to start
3. **API Keys** → **Create Key** → copy
4. Add to Railway:

```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

If you skip this, the product still works — it just uses the built-in template pool instead of Claude for draft responses. Fine for launch. Add Anthropic later.

### Billing — optional, skip for first 10 customers if you want

1. Sign up at https://www.lemonsqueezy.com (credit card required)
2. Create a store
3. Create 2 products: "ReviewHub Solo" ($14/month) and "ReviewHub Agency" ($59/month)
4. **Settings → Webhooks** → create a webhook → URL = `https://<your-domain>/api/billing/webhook` → copy the secret
5. **Settings → API** → create an API key → copy
6. Add to Railway:

```
LEMONSQUEEZY_API_KEY=<the API key>
LEMONSQUEEZY_WEBHOOK_SECRET=<the webhook secret>
LEMONSQUEEZY_STORE_ID=<store ID from dashboard>
```

**For first 10 customers:** you can skip this entirely and just let people sign up on Free. When someone says "I'd pay," you either do LemonSqueezy right then or take payment manually (bank transfer, PayPal) and manually set `subscriptions.plan='solo'` in the DB. Early customers don't care about polish; they care about talking to a human founder.

### Google OAuth — optional, needed for real Google Reviews sync

Skip for launch. Your Free users can import via CSV. Only set this up after 3+ paying customers ask for real-time Google sync.

## Part 4 — Domain name (optional, ~20 minutes)

Your app works perfectly on `reviewhub-xxx.up.railway.app`. If you want a real domain:

1. Buy one at **Namecheap** or **Cloudflare** — search for `.com`, `.app`, `.co`. ~$10-15/year.
2. In Railway, Service → Settings → Networking → **Custom Domain** → enter `reviewhub.review` (or whatever you bought)
3. Railway gives you a CNAME value. Go to your domain registrar's DNS settings → add a CNAME record pointing to Railway's value.
4. Wait 5-30 minutes for DNS to propagate. Railway auto-issues the SSL cert.
5. Update `CLIENT_URL` in Railway env vars to `https://yourdomain.com`. Redeploy.

## Part 5 — Smoke test (15 minutes)

After everything is deployed:

1. Open `https://<your-domain>/` in a fresh incognito window
2. Click **Register** → create a test account with a throwaway email
3. Check your inbox for the verification email (if it doesn't arrive, SMTP is misconfigured — check Brevo dashboard for bounces)
4. Click the verification link → you should land on Dashboard
5. See the onboarding checklist at 25% → add a business name → click "Try demo data" → reviews should load
6. Click Reply on any review → textarea opens → click ✨ AI Draft → either get a real Claude draft or a template-pool draft (depending on whether you set `ANTHROPIC_API_KEY`)
7. Close the tab. Open again in another incognito. Log in again. Everything should persist.

If any step breaks, paste the Railway service logs and the browser console errors — I'll help you debug.

## Part 6 — Set up the safety net (30 minutes)

Before you start DMing Thai café owners, do these so you don't wake up to a dead service:

### Backup
Railway's volumes are persistent but not magical — back up the SQLite file externally.

1. Sign up at https://www.backblaze.com/b2 (free tier: 10GB, plenty)
2. Create a bucket called `reviewhub-backups`
3. Get Application Keys → copy keyID + applicationKey
4. In Railway → add a **Cron Job** service (Railway's native cron feature):
   - Schedule: `0 */6 * * *` (every 6 hours)
   - Command: use a short bash script that copies the DB to B2 (I'll write you the exact script if you get here — paste "write backup cron" and I'll ship it)

### Uptime monitoring
1. Sign up at https://uptimerobot.com (free)
2. Add monitor: URL = `https://<your-domain>/api/health`, type = HTTP(s), interval = 5 minutes
3. Add alert contact: your email + your phone number for SMS

### Error reporting
Optional for launch. Sign up at https://sentry.io (free tier: 5K errors/month). Add `SENTRY_DSN` env var.

---

## Summary — what YOU actually do, in order

1. [ ] Create GitHub repo, push code (20 min)
2. [ ] Sign up Railway, connect repo, add volume, deploy (30 min)
3. [ ] Sign up Brevo for SMTP, verify sender domain (30 min)
4. [ ] Generate JWT secret, fill in env vars in Railway (15 min)
5. [ ] Redeploy after env vars are set (5 min wait)
6. [ ] Smoke-test signup flow end-to-end (15 min)
7. [ ] (Optional) Buy domain, point DNS, re-test (20 min)
8. [ ] (Optional) Sign up Anthropic for $20 credit + API key (15 min)
9. [ ] (Skip for now) LemonSqueezy — do once you have a paying customer
10. [ ] UptimeRobot monitor (5 min)
11. [ ] Backblaze backup cron (30 min — ask me for script)

**Total: ~3 hours if everything goes smoothly, ~5 hours with typical issues.**

Do this over a weekend morning with coffee. Not in the middle of a workday when you'll be distracted.

## Where I can keep helping

Any time something doesn't work — error in the logs, env var confusion, SSL not issuing, a Brevo bounce — paste the exact error message into chat. I'll read the output and tell you the exact fix.

Things I can do in code immediately if you want:

- **Bundle client into server container** so you only deploy one service instead of two (simpler + cheaper on Railway)
- **Write the backup cron script** for Backblaze B2
- **Pre-fill every env var** into a `.env.production.example` file with comments explaining each one
- **Write a `/api/health` check** if it doesn't already exist, to make UptimeRobot work

Tell me which of those you want first, and do it while you're in between steps above.
