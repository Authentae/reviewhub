# Importing Naver Place reviews into ReviewHub (manual CSV)

Naver Place doesn't expose an API to third-party tools. Korean SMB owners get review notifications by email and have a partial export inside the **Naver Smart Place** owner dashboard, but it's buried and date-bound.

This is the manual workflow for Naver Place. ~5 minutes per property per week. Email-forward parser is on our roadmap.

## Step 1 — Open Naver Smart Place

1. Go to [smartplace.naver.com](https://smartplace.naver.com/) and sign in to the **Naver business account** that owns your listing (스마트플레이스).
2. Pick your business from the dropdown (left sidebar) if you have multiple.
3. Click **리뷰 관리 (Review Management)** in the left navigation.

## Step 2 — Filter by date

Set the date range to "지난 7일" (Past 7 days) — or whatever cadence matches your last sync to ReviewHub.

## Step 3 — Export

Click **다운로드 (Download)** in the top-right of the review-list view. Naver gives you an Excel file (`.xlsx`) — open in Excel / Numbers / Google Sheets and save-as CSV.

## Step 4 — Map to ReviewHub's CSV columns

| ReviewHub CSV column | Naver export column |
|---|---|
| `platform` | Always `naver` |
| `reviewer_name` | 작성자 (Author) |
| `rating` | 평점 (Rating, 1-5) |
| `review_text` | 리뷰 내용 (Review content) |
| `external_id` | 리뷰 고유번호 (Review unique ID) — Naver column is named differently across export versions, look for the longest numeric column |
| `created_at` | 작성일 (Date written) |

## Step 5 — Upload to ReviewHub

Dashboard → **Import** → drag the CSV in. Dedupe runs on `(platform, external_id)` — re-uploading the same week's CSV is safe.

## Step 6 — Reply

Naver Place doesn't accept third-party reply posting either. Once you've drafted your reply in ReviewHub, copy it and paste back into Naver Smart Place's owner-response field. We'll remind you in the dashboard.

## Why this is manual

Naver's API is closed to small tools (you need a Korean business registration + an enterprise partnership process to get keys). Until that changes — or until we ship our email-forward parser — this is the workflow.

If you want the email-forward parser sooner, vote at /support — we move fastest on what paying customers ask for.
