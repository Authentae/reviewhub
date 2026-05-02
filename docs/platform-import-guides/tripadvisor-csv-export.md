# Importing TripAdvisor reviews into ReviewHub (manual CSV)

TripAdvisor doesn't expose an API or a "Download all reviews as CSV" button to property owners — their export tooling is buried and changes a few times a year. This is a manual workflow that takes about 5 minutes per property per week.

Until we ship the email-forward parser (planned), this is the path.

## Step 1 — Get to your reviews list

1. Go to [tripadvisor.com](https://www.tripadvisor.com/) and sign in to the **Owners section** (`Management Center` after login).
2. Pick the property in question.
3. Click **Reviews** in the left sidebar → **All reviews**.

## Step 2 — Filter to "since last import"

Set the date filter to "Past week" (or whatever cadence matches your last sync to ReviewHub). This avoids re-importing reviews you already have.

## Step 3 — Copy each review's fields into our CSV template

Download the ReviewHub CSV template: [reviewhub.review/template/reviews.csv](https://reviewhub.review/template/reviews.csv).

For each TripAdvisor review on the page, paste:

| CSV column | Where to find it on TripAdvisor |
|---|---|
| `platform` | Always `tripadvisor` |
| `reviewer_name` | The blue username link above the review |
| `rating` | Number of green circles (1–5) |
| `review_text` | The body of the review (after the title — TripAdvisor's title and body together is fine) |
| `external_id` | The URL fragment after `Review-...` (TripAdvisor's review ID — paste the whole URL is fine, we extract the ID) |
| `created_at` | The date shown above the review (e.g. "Reviewed 23 April 2026") |

## Step 4 — Upload

Dashboard → **Import** → drag the CSV in. We dedupe on `(platform, external_id)` so re-uploading the same review twice is safe; we won't double-count it.

## Step 5 — Reply

Reviews appear in the dashboard within a few seconds. Use AI Draft on each one. **TripAdvisor doesn't accept replies via API either** — once you've drafted a reply in ReviewHub, copy it and paste into TripAdvisor's owner-response field. We remind you to do this.

## Why this is annoying and what we're doing about it

It is annoying. Three reasons:

1. **TripAdvisor's API is closed.** They don't grant API keys to small tools.
2. **Their CSV export is hidden.** Some accounts have it under "Data Export"; some don't.
3. **Their reply tooling is also closed** so even if we read the reviews, we can't post your reply for you.

The plan: ship an **email-forward parser**. TripAdvisor sends an email to the owner when a new review is posted; if you set up a mail filter to forward those emails to `tripadvisor@reviewhub.review` (a magic address per business), we'd parse and ingest automatically. No API, no manual CSV. Estimated next quarter — vote at /support if you want it sooner.

In the meantime, this 5-minutes-a-week workflow is what we have. Sorry it's manual; not pretending otherwise.
