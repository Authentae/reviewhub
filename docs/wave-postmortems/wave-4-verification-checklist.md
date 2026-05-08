# Wave 4 verification checklist — Tuesday morning prep

One-screen workflow Earth runs Tuesday + Wednesday morning before
firing the 12 Wave 4 sends. Designed to fit on the laptop screen
without scrolling.

**Time budget per row:** ~3 minutes. 12 rows = ~36 min total. Don't
do all 12 in one sitting — do 6 Tuesday morning, 6 Wednesday morning
(also matches the 10/day Gmail cap).

**Source files:**
- Candidates research: `docs/wave-postmortems/wave-4-candidates.md`
- Email drafts: `docs/wave-postmortems/wave-4-drafts.md`

---

## Per-row workflow (run for each prospect)

```
[ ] 1. Open Google Maps for the property
[ ] 2. COUNT owner-reply ratio in last 10 reviews:
       0-3/10  → keep going
       4+/10   → DISQUALIFY this prospect, mark "skip"
       <200 reviews total → DISQUALIFY (audience-fit segment)
[ ] 3. Confirm {N} = total unanswered count from your /audit-previews
       dashboard for this prospect
[ ] 4. Scan the visible reviews for ONE specific {PAIN}:
       - a 1-star from last 30 days
       - a question asked in a review but never answered
       - a recurring complaint (cleanliness, breakfast, AC, noise)
       - a guest's name praised
       Write it as ONE clause, e.g.:
         "1-star จากเมื่อสัปดาห์ก่อนเรื่อง AC"
         "a 2-star from last week mentioning the breakfast"
         "two questions about parking that haven't been answered"
[ ] 5. Generate audit URL via /outbound-audits dashboard. Verify the URL
       returns HTTP 200 (paste in browser, see audit page render).
[ ] 6. Copy the email body from wave-4-drafts.md, replace {N}, {PAIN},
       {AUDIT_URL}. Verify language call (TH default, flip if Maps
       reveals 80%+ EN reviews).
[ ] 7. Compose new in Gmail (earth.reviewhub@gmail.com). Subject from
       drafts file. Schedule send for 9-11am ICT Tue or Wed.
[ ] 8. Mark this row as "scheduled" in the table below.
```

---

## Tracker — fill in as you go

Review counts confirmed via Maps 2026-05-08. Reply ratio still your call.

| # | Property | Reviews | Email | Lang | Reply ratio | {N} | Status |
|---|---|---|---|---|---|---|---|
| 1 | Methavalai Residence | 716 | NEEDS BROWSER LOOKUP | TH | _ /10 | _ | [ ] |
| 2 | Lilit Bang Lamphu | 606 | res@lilithotel.com | TH | _ /10 | _ | [ ] |
| 3 | Raweekanlaya Wellness | 686 | info@raweekanlaya.com | TH | _ /10 | _ | [ ] |
| 4 | Lamphu Tree House | 926 | hotel@lamphutreehotel.com | TH | _ /10 | _ | [ ] |
| 5 | Lamphu House | 1,263 | info@lamphuhousebangkok.com | TH | _ /10 | _ | [ ] |
| ~~6~~ | ~~Baan 2459~~ | **120** | — | — | — | — | **[DQ <200]** |
| 7 | Nouvo City Hotel | 3,918 | info@nouvocityhotel.com | EN/TH? | _ /10 | _ | [ ] |
| 8 | Public House Hotel | 855 | info@publichouse-hotels.com | EN | _ /10 | _ | [ ] |
| 9 | Volve Hotel | 527 | hello@volvehotel.com | TH | _ /10 | _ | [ ] |
| 10 | IR-ON Hotel | 317 | info@ir-onhotel.com | TH | _ /10 | _ | [ ] |
| ~~11~~ | ~~Bangkok Voyage~~ | **120** | — | — | — | — | **[DQ <200]** |
| ~~12~~ | ~~Baan Vajra~~ | **163** | — | — | — | — | **[DQ <200]** |

**Status legend:**
- `[ ]` — not started
- `[scheduled]` — composed in Gmail, send-later set, ready to fire
- `[skip]` — disqualified (≥4/10 reply ratio or <200 reviews)
- `[hold]` — needs follow-up research before sending

---

## Suggested send schedule (REVISED 2026-05-08 after Maps DQ pre-filter)

> **The original split was wrong.** Maps verification 2026-05-08
> confirmed Baan 2459 (120 reviews), Bangkok Voyage (120), and Baan
> Vajra (163) are below the 200-review threshold. The "smallest owner-
> run / voice-matters" cohort the original schedule fronted on Tuesday
> mostly DOESN'T qualify — they're small *because* they're small, which
> is exactly why they have fewer reviews. Wave 4 effective batch is
> **9 of 12.**

**Tuesday 5/12 (9-11 AM ICT) — 5 sends:**

The smaller mid-tier where review counts are healthy but not enormous,
and Thai-named ownership preserves the voice-matters hook:

1. #10 IR-ON Hotel (317 reviews, Thai design, TH)
2. #9 Volve Hotel (527 reviews, Khun Um Thai owner-curator, TH)
3. #2 Lilit Bang Lamphu (606 reviews, Banglamphu boutique, TH)
4. #3 Raweekanlaya Wellness (686 reviews, wellness-positioned, TH)
5. #4 Lamphu Tree (926 reviews, owner-decorated antique-teak, TH)

**Wednesday 5/13 (9-11 AM ICT) — 4 sends:**

The largest properties + Methavalai (still needs email surfaced):

6. #1 Methavalai Residence (716 reviews, Pranakorn) — **IF** Earth surfaces email via browser
7. #8 Public House Bangkok (855 reviews, 5★ Design Hotels member, EN, Sachdev family)
8. #5 Lamphu House Bangkok (1,263 reviews, Khao San, TH; verify website `lamphuhousebangkok.com`)
9. #7 Nouvo City Hotel (3,918 reviews, halal-certified, Thai-script branding suggests bilingual or flip TH from original EN call)

**DISQUALIFIED — DO NOT SEND:**

- #6 Baan 2459 (120 reviews, below 200 threshold)
- #11 Bangkok Voyage (120 reviews)
- #12 Baan Vajra (163 reviews)

**Why this revised order:** front-load the smaller-but-qualifying TH
prospects Tuesday for fast read on whether Wave 4 replicates Wave 2's
100% open. Save Methavalai for Wednesday since email is still pending,
and put the very-large properties (Lamphu House 1,263, Nouvo 3,918)
later because they're more institutional — Wave 2's winning pattern was
small Old Town historic (Old Capital Bike Inn). Mid-size + Thai-named
+ owner-engaged is where the audience-fit signal landed strongest.

---

## After sending — instrumentation

The audit URLs auto-track view counts in the `audit_previews` table.

**Fast-read CLI (added 2026-05-08):**

```bash
# Run against production DB via Railway:
railway run node server/scripts/audit-views.js

# Filter to a specific prospect (case-insensitive substring match):
railway run node server/scripts/audit-views.js Methavalai
railway run node server/scripts/audit-views.js bang   # all "Bangkok*" properties
```

Output: per-prospect status (cold/OPENED/REPLIED ✓), view count, hours
since send, hours since last view, and the audit URL. Plus a "recently
active in last 48h" section if anyone re-opened.

Faster than loading the dashboard, especially for checking 12 prospects
at once Tuesday/Wednesday.

**Or via the dashboard:** open `/audit-previews` (signed-in) — view
counts visible per audit.

**Reply window:** 5 days after send for Wave 4. So Tue 5/12 sends → check
inbox through Sun 5/17. Wed 5/13 sends → check through Mon 5/18.

**If 1+ replies arrive:** STOP everything else. Run
`docs/skills/first-customer-playbook.md` Hour 0 ack. Don't drop the lead.

---

## Edge cases

- **Methavalai email still not surfaced** after Earth opens the website?
  - Try `mr@methavalairesidence.com`, `info@methavalai-residence.com`,
    `reservations@methavalairesidence.com`
  - If none work, skip and move Methavalai to Wave 5
- **Property has < 200 reviews on actual count?** DISQUALIFY. The
  segment hypothesis is "owners who already feel the volume problem."
  < 200 = doesn't feel it.
- **Property reply ratio is 4-6/10?** Borderline. Consider dropping the
  education-paragraph variant (use AWARE-LAZY default in drafts). They
  reply sometimes; they know reviews matter; they just need activation.
- **Property reply ratio is 7+/10?** DISQUALIFY hard. They're already
  doing it; the demo is unimpressive. Don't burn the channel.
