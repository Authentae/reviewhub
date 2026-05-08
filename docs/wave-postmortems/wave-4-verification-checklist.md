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

| # | Property | Email | Lang | Reply ratio | {N} | Status | Audit URL |
|---|---|---|---|---|---|---|---|
| 1 | Methavalai Residence | __NEEDS LOOKUP__ | TH | _ /10 | _ | [ ] | _ |
| 2 | Lilit Bang Lamphu | res@lilithotel.com | TH | _ /10 | _ | [ ] | _ |
| 3 | Raweekanlaya Wellness | info@raweekanlaya.com | TH | _ /10 | _ | [ ] | _ |
| 4 | Lamphu Tree House | hotel@lamphutreehotel.com | TH | _ /10 | _ | [ ] | _ |
| 5 | Lamphu House | info@lamphuhouse.com | TH | _ /10 | _ | [ ] | _ |
| 6 | Baan 2459 | baan2459@gmail.com | TH | _ /10 | _ | [ ] | _ |
| 7 | Nouvo City Hotel | info@nouvocityhotel.com | EN | _ /10 | _ | [ ] | _ |
| 8 | Public House Hotel | info@publichouse-hotels.com | EN | _ /10 | _ | [ ] | _ |
| 9 | Volve Hotel | hello@volvehotel.com | TH | _ /10 | _ | [ ] | _ |
| 10 | IR-ON Hotel | info@ir-onhotel.com | TH | _ /10 | _ | [ ] | _ |
| 11 | Bangkok Voyage | Voyagearthostel@gmail.com | TH | _ /10 | _ | [ ] | _ |
| 12 | Baan Vajra Silom | baanvajra@gmail.com | TH | _ /10 | _ | [ ] | _ |

**Status legend:**
- `[ ]` — not started
- `[scheduled]` — composed in Gmail, send-later set, ready to fire
- `[skip]` — disqualified (≥4/10 reply ratio or <200 reviews)
- `[hold]` — needs follow-up research before sending

---

## Suggested send schedule

**Tuesday 5/12 (9-11 AM ICT):**

The 6 highest-fit prospects (smallest, most owner-run, "voice matters"
hook strongest):

1. #6 Baan 2459 (4 rooms, gmail address)
2. #11 Bangkok Voyage (7 rooms, gmail address)
3. #12 Baan Vajra Silom (gmail address)
4. #4 Lamphu Tree House (owner-decorated)
5. #9 Volve Hotel (owner-curator, design hotel)
6. #3 Raweekanlaya Wellness (wellness-positioned, voice-matters)

**Wednesday 5/13 (9-11 AM ICT):**

The 6 mid-tier (larger, more institutional, but still independent):

7. #1 Methavalai Residence (716 reviews, large backlog) — IF email surfaced
8. #2 Lilit Bang Lamphu (606 reviews, 4.6★)
9. #5 Lamphu House (Khao San boutique)
10. #10 IR-ON Hotel (industrial design, family business)
11. #7 Nouvo City Hotel (halal niche, EN)
12. #8 Public House Hotel (design hotel, family-owned, EN)

**Why this order:** the smallest owner-run properties have the highest
"owner cares about voice" hook, AND match the Wave 2 winning pattern
(Old Capital Bike Inn = small Old Town historic, opened 1/1). Front-load
the highest-likelihood-to-open prospects on Tuesday so we get a fast
read on whether Wave 4 replicates Wave 2's 100%.

---

## After sending — instrumentation

You don't need to do anything special; the audit URLs auto-track view
counts in the `audit_previews` table. To check progress later:

```bash
# Open the dashboard at /audit-previews — view counts visible there
```

Or via the existing diagnostic hook in the wave-2 post-mortem doc.

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
