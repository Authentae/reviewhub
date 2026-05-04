# Outreach queue — pre-sourced prospects ready to send

A rolling queue of verified prospects ready for outbound audit sends.
Refilled as the day's batch is sent. Each entry contains everything
needed to execute end-to-end without research time:

- **Business name** — exactly as on Google
- **Email** — verified on the business's CURRENT live website (not
  pulled from old web search results, which have ~30% bounce rate)
- **Vertical** — for matching to email template (cooking-school,
  hotel/B&B, restaurant, etc.)
- **Email language** — based on review-language plurality + audience
- **Review-response status** — UNAWARE (0%) / AWARE-LAZY (1-60%) /
  DISQUALIFIED (60%+); only the first two are worth sending
- **Notes** — anything specific worth referencing in the email
  (instructor name, signature dish, recurring complaint, etc.)

## Workflow

For each entry below:

1. Run `./scripts/prod-smoke.sh` — fail-fast if prod is broken
2. Open the business's Google profile, copy 3 reviews into the
   audit-generator at `/outbound-audits`
3. Hit Generate, copy the share URL
4. Compose the email per the audit-outreach playbook (UNAWARE template
   if 0% reply rate, AWARE-LAZY template otherwise)
5. Send from earth.reviewhub@gmail.com
6. Strike through the entry below or move to "Sent"
7. Stay under Gmail's 10/day cap on a fresh account

After each entry is sent, the open-tracking + 48h follow-up reminder
hooks take over automatically.

## Ready to send

```
1. Chakrabongse Villas
   - Email: reservation@chakrabongse.com
   - Vertical: boutique heritage hotel (riverfront, owner-run since 1998)
   - Email language: English (international guests)
   - Notes: Owned by Narisa Chakrabongse, granddaughter of HRH Prince
     Chakrabongse. Verify response rate before sending. If 60%+ → skip.
   - Source: https://www.chakrabongsevillas.com

2. Old Capital Bike Inn
   - Email: info@oldcapitalbkk.com
   - Vertical: family-run heritage B&B near Old City temples
   - Email language: English (tourist-facing)
   - Notes: Family-run, charm-focused. Reviews likely mention specific
     staff or family member by name — pull that into the email.
   - Source: https://www.oldcapitalbkk.com/contact-us.html

3. Loftel 22 Hostel
   - Email: loftel22bangkok@gmail.com
   - Vertical: small independent hostel
   - Email language: English (backpacker audience)
   - Notes: Hostel scene is highly review-driven (Hostelworld + Google
     ranking). High-leverage if owner is unaware.
   - Source: https://www.facebook.com/loftel22/
```

## How to add more entries

Goal: 7+ verified prospects in the queue at all times so each morning
has zero research overhead.

Per prospect:

1. Search Google: `"{vertical}" Bangkok contact email`
2. **Verify email is on the business's CURRENT live website** —
   never trust an email scraped from a third-party listing alone
   (Travelfish, old TripAdvisor entries, etc. — those have stale
   addresses that bounce, as we learned with Baan Sukhumvit)
3. Quick-check Google review response rate:
   - Open `https://www.google.com/maps/place/?q={business}`
   - Click Reviews tab
   - Count "Response from the owner" across the visible reviews
   - 0/N → UNAWARE (best target, use education-hook template)
   - 1-3/10 → AWARE-LAZY (good, skip the education line)
   - 4+/10 → DISQUALIFY (don't burn the channel)
4. Add to "Ready to send" with all the fields above

## Verticals to keep mining

Highest yield observed so far:
- Small B&Bs / homestays / boutique hotels with own website + 100+ reviews
- Cooking schools (vegetarian, pastry, niche cuisines tend to be
  lower-response than mainstream Thai)
- Tour operators with own website (not pure-Klook listings)
- Massage spas with own website

Lower yield:
- Cafes (rarely have email; better via IG DM)
- Chain restaurants > 3 locations (have marketing teams, already
  responding)
- 4-star+ hotels (have SaaS already, often)

## Sent today (2026-05-04 — for reference)

1. Pink Chili Thai Cooking School — TH email — sent
2. House of Taste Thai Cooking School — TH email — sent (with new
   education hook template)
3. White Ivory Bed and Breakfast — EN email — sent
4. Vera Nidhra Bed and Breakfast — EN email — sent
5. Aim House Bangkok Hotel — EN email — sent
6. Better Moon Guesthouse & cafe — TH email — sent
7. May Kaidee Tanao Vegetarian — EN email — sent
8. Tingly Thai Cooking School — EN email — sent
9. Sweets Cottage Academy — TH email — sent

(9/10 daily safe cap. Tomorrow's window opens with the next 10 from
the queue above.)
