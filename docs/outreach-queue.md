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
1. ~~Chakrabongse Villas~~ — **SENT 2026-05-06 ~16:00 ICT** (custom-pitch, Wave 2.1)
   - Email: reservation@chakrabongse.com
   - 48h reply window: by 2026-05-08 ~16:00
   - Audit URL 9326cf61…4340 (corrected — initial send had typo'd token,
     follow-up apology + correct link sent 5 min later. Lesson logged
     to feedback_never_transcribe_urls_from_screenshots.md.)
   - Subject: "A small thought after reading your replies on Google"
   - Pitch angle (NOT stock cold-outreach): acknowledged Narisa's
     existing reply quality (Khun honorific, personal sign-off, brief
     grace), framed ReviewHub as voice-scaling not voice-replacing.
     5 audit drafts include 1 critical (Ankana 4★ mosquitoes/policy)
     to demo nuance handling. English (per language decision tree —
     internationally-positioned, English-fluent owner).
   - Founder choice: chose B (custom pitch) over A (skip per 60%+ rule).

2. ~~Old Capital Bike Inn~~ — **SENT 2026-05-06 14:39 ICT** (Wave 2)
   - Email: info@oldcapitalbkk.com
   - 48h reply window: by 2026-05-08 14:39
   - Audit URL eb9b38c2…34fd
   - Hook: owner Jason + night bike tour mentioned in many reviews

3. ~~Loftel 22 Hostel~~ — **SENT 2026-05-06 14:39 ICT** (Wave 2)
   - Email: loftel22bangkok@gmail.com
   - 48h reply window: by 2026-05-08 14:39
   - Audit URL 5413ee40…edc2
   - Hook: 2 unanswered 1-stars (EN + TH brutal) sitting open
```

## Wave 3 strategy (locked 2026-05-06 evening, post-deliverability test)

**Mail-tester scored 8.2/10 — deliverability is fine.** Wave 1's 0/7
opens was an audience problem, not spam folder. Wave 3 must hit the
right targets.

**Wave 3 target profile (LOCK):**
- Bangkok hospitality (hotels, B&Bs, hostels)
- 200+ Google reviews (high enough volume to feel reputation pressure)
- Owner reply rate 0-30% (UNAWARE or AWARE-LAZY segment per audit-outreach.md)
- Has live website with contact email (NOT third-party listing email)
- Thai-named ownership (lets us use Thai email — opened 4x better than English)

**SKIP for Wave 3:**
- Cooking schools, classes-only businesses (Wave 1 0/7 opens proved wrong fit)
- &lt;100-review businesses (not enough hooks)
- 60%+ response rate (Chakrabongse-tier — disqualified per playbook)
- International chains (less likely to need a $14/mo SMB tool)

**Candidate list — Banglamphu / Old Town district (preliminary):**

```
WAVE 3 CANDIDATES (need verification):

A. Cherie Bangkok Boutique Hotel — 4.7★ (54 reviews) — TOO LOW VOLUME, skip
B. CHERN Hostel — 4.4★ (1,357 reviews) — high volume, hostel target, verify
C. Methavalai Residence Hotel — 4.4★ (716 reviews) — strong target
D. Lilit Bang Lumphu Hotel — 4.6★ (606 reviews) — good fit
E. The Raweekanlaya Bangkok Wellness — 4.4★ (686 reviews) — wellness/hotel hybrid
```

**Next session research checklist (per prospect):**
1. Open Google Maps profile
2. Click Reviews tab → count owner-reply ratio across recent 10 reviews
3. Click website link → find contact / about / footer for email
4. Verify email is on the live page (NOT scraped from third-party listing)
5. Note one specific recent review for personalization hook
6. Generate audit URL via /outbound-audits dashboard (5 real reviews)
7. Draft personalized cold email (Thai if Thai-named ownership)
8. Queue for Earth's send approval

Time per prospect: ~10-15 min. Goal: 5 verified prospects per Wave 3 batch.

## Research targets from earlier (May 4) — pruned

These are surfaced from the May 4 lead-finding research. Verified to
have own websites; need to (a) extract email from contact page and
(b) check Google review response rate before adding to "Ready":

```
4. Niras Bankoc Cultural Hostel — 2-star hostel, family-run, near
   Grand Palace. Phone +66 2 282 7500. Need to find email.

**Wave 1 bounces (2026-05-06):**
- baansukhumvit@yahoo.com — address not found, message returned.
  Yahoo address from third-party listing was stale. Lesson reinforced:
  rule #2 above (only verified live-website emails) prevented other
  bounces; this one slipped because email pre-dated rule.
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
