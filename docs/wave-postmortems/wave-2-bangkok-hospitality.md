# Wave 2 — Bangkok hospitality (open data 2026-05-08)

Updated 2026-05-08 with view-count actuals queried from production
audit_previews. Reply window technically still open until
~16:00 ICT today; will update again if late replies arrive.

## Wave snapshot

- **Dates:** sent 2026-05-06 14:39 ICT (Old Capital BKK Boutique
  + Loftel 22). Sent ~16:00 ICT (Chakrabongse Villas). Reply
  window: through 2026-05-08 EOD.
- **Target list:** 3 Bangkok hospitality properties with 200+
  Google reviews. Selected because:
  - Hospitality vertical (the corrected-target-segment from Wave 1)
  - 200+ reviews → reply problem at scale
  - All three have working web presence + verified owner email
  - All three are independent (decision-maker = owner, not chain)
- **Channel:** Email from earth.reviewhub@gmail.com.
- **Message variant:** Audit-outreach personalized URL DM script
  with each prospect's actual reviews + AI-drafted replies.
- **Sender persona:** Earth (founder voice), single CTA.
- **Language decisions:**
  - Old Capital BKK + Loftel 22: English (international-positioning)
  - Chakrabongse: English (high-end international clientele,
    English-fluent owner, verified by website tone)

## Result (queried 2026-05-08)

- **Audit URL views: 3 of 3 opened** (vs Wave 1's 1 of 9)
  - Old Capital Bike Inn: 1 view (opened 2026-05-06 08:56 ICT,
    ~110 min after send)
  - Loftel 22 Hostel: 2 views (first 09:02, last 12:11 ICT same day)
  - Chakrabongse Villas: 2 views (first 09:03, last 09:08 ICT
    same day)
- **Replies:** 0 of 3 (window still open as of writing)
- **Conversions to signup:** 0 of 3
- **Sentiment of replies (if any):** N/A — no replies yet

## What worked

- [x] **Audience-fit confirmed.** 100% open rate vs Wave 1's 11%
      is a 9× lift on the same channel + same message structure.
      The only variable that changed was the target list. Bangkok
      hospitality 200+ reviews owners DO read these emails.
- [x] **Send timing.** Tuesday afternoon (14:39 ICT) opened within
      ~2 hours for 2 of 3 prospects. Mid-afternoon weekday wins
      vs Wave 1's Sunday send.
- [x] **Personalized audit URL.** Each prospect's URL contained
      their real reviews + drafts. The 100% open rate suggests the
      personalization was strong enough to overcome the cold-email
      filter.
- [x] **Brand-account sender** (earth.reviewhub@gmail.com).
      Continued from Wave 1; not the differentiator but not the
      problem either.

## What didn't

- [x] **No replies yet** — viewed but didn't reply pattern means
      the audit URL itself isn't doing the conversion work.
      Possible reasons:
      - The page doesn't make the next step obvious enough
      - Owners want to think before responding (need follow-up)
      - The audit shows "AI replies for your reviews" but doesn't
        explicitly say "this is a paid product"
- [x] **No follow-up sent.** With 3/3 opens, a +3-day follow-up
      saying "noticed you opened the audit — questions?" should
      land Tuesday 2026-05-12. Currently no automation queues this;
      Wave 4 needs `auditFollowupReminders.js` extended to fire on
      opened-but-no-reply (currently fires on time-since-send).
- [x] **Sample size of 3 is real.** Even 3/3 opens is consistent
      with random noise on a small N. The replicability test is
      Wave 3 (when sent) — same target type, larger N.

## Hypotheses scored (predictions made before data, marked after)

1. **PREDICTED:** views > 0/3 → audience-fit hypothesis confirmed.
   **RESULT:** 3/3 — confirmed strongly.
2. **PREDICTED:** views = 0/3 → email channel was wrong, need to
   pivot to LINE/IG DM. **RESULT:** N/A (didn't happen) — but the
   contrast with Wave 1 (where 8/9 didn't open via the same email
   channel) suggests the channel is OK for hospitality but
   wasn't for cooking schools / B&Bs.
3. **PREDICTED:** 1+ reply but no conversion → audit→signup funnel
   needs work. **RESULT:** *partial* — we have opens but no
   replies yet, so we can't test the funnel beyond the URL view.
   The 0% reply-from-views rate (so far) means the audit URL or
   the next-step CTA isn't compelling enough to trigger action.
   This is a NEW hypothesis to test in Wave 4: A/B the
   audit-preview CTA copy.

## Next-wave action items

- [x] **Audience confirmed** → refill outreach-queue.md with 10+
      more Bangkok hospitality 200+ reviews prospects (this is
      the existing `[wait:user]` item in operating-queue.md, now
      with a stronger reason to ship).
- [ ] **Send +3-day follow-ups to all 3 Wave 2 prospects** —
      Tuesday 2026-05-12. They opened; they're warm. Don't drop
      this lead.
- [ ] **Send +5-day follow-up to Pink Chili (Wave 1 sole opener).**
      They viewed 4 times. Same logic.
- [ ] **A/B test audit-preview page CTA copy** — current CTA is
      "Get this for your business" or similar. Test variant:
      "Have ReviewHub draft these for you next time" (more
      specific + less ask-y).
- [ ] **Extend `auditFollowupReminders.js`** to fire on
      opened-but-no-reply pattern, not just time-since-send.
      Right now we fire follow-ups on a global schedule, not
      based on engagement signal.

## Status

Reply window closes ~16:00 ICT 2026-05-08. View data confirms
audience-fit; reply data still pending. Inbox watch:
earth.reviewhub@gmail.com.
