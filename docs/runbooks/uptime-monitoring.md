# Uptime monitoring runbook

> 5-minute setup. Free for up to 50 monitors. You'll know about Railway downtime before any customer does.

## Why bother

`/api/health` returns:
- `200 OK` with `ok: true` when DB / SMTP / AI / billing are all up
- `503` when any load-bearing component is down (DB unreachable)

UptimeRobot pings that endpoint every 5 minutes from 8 global locations. Any non-200 response → email/SMS/Slack alert in <5 minutes.

## Setup (5 minutes)

### 1. Create account
- <https://uptimerobot.com/signUp>
- Free tier: 50 monitors, 5-minute interval. More than enough.

### 2. Add a monitor — production health
- Click **+ New Monitor**
- Type: `HTTP(s)`
- Friendly name: `ReviewHub production health`
- URL: `https://reviewhub.review/api/health`
- Monitoring interval: `5 minutes`
- Click **Create Monitor**

### 3. Add an alert contact
- Settings → Alert Contacts → **+ Add alert contact**
- Type: `Email`
- Email: `theearth1659@gmail.com`
- Save

Optional: add `LINE Notify` (deprecated 2025), `Slack`, or `SMS` (paid) as additional contact types.

### 4. (Optional) Public status page
- Click **Status Pages** → **+ Add a Status Page**
- Display name: `ReviewHub status`
- URL slug: `reviewhub`
- Add monitor: `ReviewHub production health`
- Public URL: `https://stats.uptimerobot.com/<slug>`

A public status page is a trust signal — link it in your footer once you have customers.

## What to watch for

- **5+ minutes downtime** → check Railway dashboard. Usually a redeploy in progress; wait.
- **Recurring downtime same time of day** → look at Railway resource usage. Probably hitting memory cap during a batch job.
- **`ai: "template-fallback"` reported in `/api/health`** → Anthropic credit ran out. Top up at <https://console.anthropic.com/settings/billing>.
- **`billing: "free-only"`** → LemonSqueezy creds dropped. Recheck Railway env vars (`LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`).

UptimeRobot's free tier alerts on response status, not body content. To alert on a degraded component (e.g., `ai: "template-fallback"`), upgrade to **Keyword Monitoring** ($7/mo for the first 50 monitors) and set the keyword to `"ok":true`. Then any response not matching `"ok":true` triggers an alert — even when HTTP is 200.

## When to skip this

If you have <10 customers and check the site daily, the alert is more annoying than useful. Add it after launch when paying customers exist and the cost of an undetected outage > the cost of one false alarm.
