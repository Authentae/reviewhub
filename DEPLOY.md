# Deploy to Railway — Easy English Guide

Goal: your app online 24/7. Your PC can be off. Cost: ~$5–10/month.

---

## Step 1 — Sign up (5 minutes)

1. Go to **https://railway.app**
2. Click **"Login"** → **"Login with GitHub"**
3. Allow Railway to see your GitHub account

That's it. Account ready.

---

## Step 2 — Push your code to GitHub (if not already)

Skip this if your code is already on GitHub.

If not, ask Claude: "push my app to a new GitHub repo called reviewhub."

---

## Step 3 — Create the project on Railway

1. On Railway, click **"New Project"**
2. Click **"Deploy from GitHub repo"**
3. Pick your **reviewhub** repo
4. Railway will read the `Dockerfile` and `railway.json` and start building

You don't have to do anything during the build. Wait 3–5 minutes.

---

## Step 4 — Add a Volume (so your database survives restarts)

⚠️ **Important.** Without this, your database disappears every time Railway restarts your app.

1. In your Railway project, click your service (the box that says "reviewhub")
2. Go to the **"Settings"** tab → scroll down to **"Volumes"**
3. Click **"+ New Volume"**
4. Mount path: `/app/data`
5. Click create
6. Repeat for backups: mount path `/app/backups`

Now your database + backups live on Railway's disk, not inside the throwaway container.

---

## Step 5 — Set environment variables (the secrets)

Click **"Variables"** tab. Add these one by one:

### Required

| Name | Value | Why |
|---|---|---|
| `NODE_ENV` | `production` | Tells the app to use prod settings |
| `JWT_SECRET` | (any long random string, 32+ chars) | Signs login tokens |
| `SESSION_SECRET` | (different long random string) | Signs session cookies |
| `APP_URL` | `https://your-app.up.railway.app` | Used in emails (fill in after step 6) |

**Tip for secrets:** open https://www.random.org/strings/ and generate 32-character strings.

### Strongly recommended

| Name | Value | Why |
|---|---|---|
| `ADMIN_EMAIL` | your email | Lets you access `/admin` page |
| `SMTP_HOST` | (e.g. `smtp.resend.com`) | Send emails (signup, reset, etc.) |
| `SMTP_PORT` | `465` | |
| `SMTP_USER` | your SMTP user | |
| `SMTP_PASS` | your SMTP password | |
| `SMTP_FROM` | `noreply@yourdomain.com` | |
| `SENTRY_DSN` | from sentry.io | Error monitoring → emails you on crash |

Don't have email yet? You can skip SMTP for now — the app will log emails to console instead. Add real SMTP later.

### Optional (Google reviews integration)

If you want real Google review sync, add the Google OAuth keys you already have. Skip if not ready.

---

## Step 6 — Get your URL

1. Settings tab → **"Networking"** → **"Generate Domain"**
2. Railway gives you a URL like `reviewhub-production.up.railway.app`
3. Copy that URL → paste it into the `APP_URL` variable from Step 5
4. Click **"Redeploy"** (top right, three dots)

---

## Step 7 — Visit your live app

Open the URL. You should see the landing page. 🎉

Sign up to create your first real user (use a real email).

---

## How to check things later

### "Is my app alive?"
Open `https://your-url/api/health` → should show `{"ok": true}`

### "How do I see what users are doing?"
- Go to `https://your-url/admin` (only works for the email in `ADMIN_EMAIL`)
- Or open the Railway dashboard → your service → **"Logs"** tab → see live activity

### "Something broke. How do I fix it?"
1. Open Railway → your service → **"Logs"** — copy the error
2. Open a chat with Claude, paste the error
3. Claude tells you exactly what to do

### "How do I update the code?"
Push to GitHub → Railway sees the change → auto-deploys. No clicking needed.

### "How do I roll back a bad deploy?"
Railway → **"Deployments"** tab → find the last good one → click **"Redeploy"**.

### "Where are my backups?"
Inside the `/app/backups` volume on Railway. The app makes one every 24 hours.
To download: Railway → your service → **"Volumes"** → mount it on your machine, OR ask Claude to add S3 upload.

---

## Cost expectations

- Hobby plan: **$5/mo** flat (you'll likely fit under this for the first 100+ users)
- Volume storage: **~$0.25/GB/mo** (your DB will be tiny — under 100 MB for a long time)
- Egress: included in plan

Total realistic month-1 cost: **~$5–7/month**.

---

## Things you do NOT need to do

- ❌ Buy a server
- ❌ Configure nginx
- ❌ Set up SSL certificates (Railway does it)
- ❌ Configure backups (the app does it)
- ❌ Configure auto-restart (Railway does it)
- ❌ Manage Linux users / firewall / ssh keys

---

## What happens if Railway goes down?

Railway has 99.9% uptime. Outages are rare and usually under 10 minutes. Your data is safe on the volume.

If you ever want to leave Railway: your app is just a Dockerfile. It runs on Render, Fly.io, AWS, your own VPS — anywhere. You're not locked in.
