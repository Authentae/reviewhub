# Outreach queue — pre-sourced prospects ready to send

A rolling queue of verified prospects ready for outbound audit sends.
Refilled as the day's batch is sent. Each entry contains everything
needed to execute end-to-end without research time:

- **Business name** — exactly as on Google
- **Email** — verified on the business's CURRENT live website (not
  pulled from old web search results, which have ~30% bounce rate)
- **Vertical** — for matching to email template (cooking-school,
  hotel/B&B, restaurant, etc.)
- **Email language** — see decision tree below; this field is a
  recommendation not a commandment.
- **Review-response status** — UNAWARE (0%) / AWARE-LAZY (1-60%) /
  DISQUALIFIED (60%+); only the first two are worth sending
- **Notes** — anything specific worth referencing in the email
  (instructor name, signature dish, recurring complaint, etc.)

### Email language decision tree

The owner being Thai doesn't mean Thai email always wins. The
owner serving English-speaking guests doesn't mean English email
always wins. Decide based on **the owner's likely first inbox-
language preference**, not the guest audience's language.

**Default to Thai when:**
- Property is family-run / small / Thai-feeling brand name
- Owner has not been quoted in English-language press
- Property positioning is local-tourist or domestic-market
- Reviews are mixed Thai/English (signals owner replies in Thai too)

**Default to English when:**
- Owner is publicly quoted in English-language press / has English
  bio / runs a property positioned for international clientele
- Property name is English / international-brand-styled
- Owner replies to existing reviews in English consistently
- Property is clearly upmarket/internationally-positioned (Chakrabongse,
  Mandarin Oriental tier)

**When in doubt: send Thai.** A Thai owner getting an English cold
email from a Bangkok-based founder reads as "this person doesn't
know my market." A Thai owner getting Thai email reads as "this
person lives here, like me." Cost of misjudging Thai → English
(slight register mismatch) is much smaller than cost of misjudging
English → Thai (alienation).

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
1. ~~Chakrabongse Villas~~ — **[wait:user] DISQUALIFIED for stock cold-outreach**
   - Email: reservation@chakrabongse.com
   - 2026-05-06: research showed ~46% Google response rate overall,
     ~60% on recent reviews. Owner Narisa responds personally, signs
     with her name. Sending the stock "you have unanswered reviews"
     pitch would land tone-deaf — she's not unaware, she's selective.
     Different pitch needed (e.g. "you reply beautifully — would you
     like to scale that voice in 5 languages via AI?"). Founder call.

2. ~~Old Capital Bike Inn~~ — **DRAFT QUEUED 2026-05-06**
   - Email: info@oldcapitalbkk.com
   - Status: 0% response rate confirmed (UNAWARE). Audit URL generated
     at /audit-preview/eb9b38c20d1921abfae1cf571bd89d120c946a51624d34fd
     with 3 of their 5★ reviews. Gmail draft created (id r8475...).
     Founder needs to review + click Send.
   - Specific observation pulled: owner "Jason" is named in reviews
     leading the night bike tour; breakfast praised in nearly every
     review.
   - Source: https://www.oldcapitalbkk.com/contact-us.html

3. ~~Loftel 22 Hostel~~ — **DRAFT QUEUED 2026-05-06**
   - Email: loftel22bangkok@gmail.com
   - Status: 0% response rate (UNAWARE). Two unanswered 1-star reviews
     (one EN, one TH brutal one) sitting open — high-value prospect.
     Audit URL at /audit-preview/5413ee40f24edbe66a9766e7cfaea91382be83e59cefedc2.
     Gmail draft created (id r3562...). Founder needs to review + Send.
   - Source: https://www.facebook.com/loftel22/
```

## Research targets for tomorrow's batch

These are surfaced from the May 4 lead-finding research. Verified to
have own websites; need to (a) extract email from contact page and
(b) check Google review response rate before adding to "Ready":

```
4. Niras Bankoc Cultural Hostel — 2-star hostel, family-run, near
   Grand Palace. Phone +66 2 282 7500. Need to find email.
5. Buddy Lodge — Khaosan area, mid-size. Need to find website +
   email.
6. Bhuthorn Bed and Breakfast — 27 Google reviews, 4.7★, owner-run
   century-old shophouse. Website thebhuthorn.com (was timing out
   on May 4; retry). info@oldcapitalbkk.com pattern suggests info@
   thebhuthorn.com is worth trying via blind send.
7. Vera Nidhra (already sent May 4) — DO NOT re-send.
8. Aim House (already sent May 4) — DO NOT re-send.
9. Better Moon (already sent May 4) — DO NOT re-send.
10. Sweets Cottage Academy (already sent May 4) — DO NOT re-send.
11. Tingly Thai Cooking School (already sent May 4) — DO NOT re-send.
12. May Kaidee Tanao (already sent May 4) — DO NOT re-send.
```

Verticals to mine fresh tomorrow (highest expected yield based on
May 4 results — see lead-finding.md for the field-update notes):

- More small B&Bs / homestays / pousadas with own websites in the
  Banglamphu / Old Town district (Niras, Bhuthorn area)
- Specialty cooking schools beyond the big-brand Thai-cuisine ones
  — vegetarian, raw food, dessert, Northeastern cuisine
- Independent dental clinics outside the BIDC / Thantakit family
  (skip the multi-location chains)
- Independent yoga / pilates / Muay Thai studios with English-
  speaking expat audiences
- Small wedding photographers with public Google profiles (not
  Instagram-only)

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
