# Wave 6 send sheet — paste-ready Gmail bodies

**Send window:** Tue 2026-05-26 OR Wed 2026-05-27, 9-11 AM ICT/SGT.
Earlier is better. After 11 AM Bangkok = past proven open window.

**Sender:** `earth.reviewhub@gmail.com` (brand account).

**Pre-send checklist for EACH prospect:**

1. Generate audit-preview for the prospect (via admin tool or `/audit-preview-generate` if extant) — paste their Google Maps URL or paste their last 10 reviews into the generator. Get the `share_token` back.
2. Construct the audit URL: `https://reviewhub.review/audit-preview/<share_token>?variant=L`
3. `curl -I <url>` → must return 200. If not, regenerate.
4. ONE verification click in your browser (so the audit_previews row has 1 view at send time — anything beyond that is the real prospect).
5. Paste the body below into a NEW Gmail compose (fresh thread, not reply).
6. Subject from the per-prospect line below.
7. To: from the per-prospect line.
8. Send.
9. Mark in your tracker: timestamp + subject variant + audit URL.

**Subject-line A/B/C variants (rotate across prospects of same vertical for testing):**

| Variant | Subject template | Hypothesis |
|---|---|---|
| **A — Observation** | `Noticed your {detail} — drafted some reply ideas` | Curiosity hook, specific |
| **B — Direct benefit** | `Reply drafts for {business_name}'s last 10 reviews` | Specific + benefit-led |
| **C — Question framing** | `Quick question about your Google review replies` | Lower-pressure |

**Per-vertical body templates** are below; per-prospect specifics
(hooks, observations, voice anchors) are inlined.

---

## DENTAL — Singapore

### D-SG-1 — TP Dental — `contact@tpdental.com.sg`

**Subject (Variant A):**
```
Noticed your 53-year history at Ngee Ann City — drafted some review replies
```

**Body:**
```
Hi TP Dental team,

53 years at Ngee Ann City Tower B is rare — your reviews repeatedly mention specific names (Dr Tham, Dr Wong, the after-hours availability) which is the kind of detail most replies miss.

I drafted reply suggestions for your 10 most recent Google reviews — kept the tone matched to how an established Orchard clinic would actually respond, not generic "thanks for the kind words." Free, no signup, just a link:

→ {AUDIT_URL}?variant=L

If the drafts feel right (or wrong), a one-line reply either way would genuinely help me understand what works for Singapore dental. No follow-up either way.

Thanks for the time.
ReviewHub · reviewhub.review
```

---

### D-SG-2 — Pacific Dental Group — `fd@pacificdental.com.sg`

**Subject (Variant B):**
```
Reply drafts for Pacific Dental's last 10 reviews
```

**Body:**
```
Hi Pacific Dental team,

Scrolling your Google reviews, the Scotts Medical Centre location consistently gets named-doctor reviews — patients specifically thanking the specialist they saw. Those deserve a reply that mirrors the named-thanks pattern, not a generic acknowledgment.

I drafted reply suggestions for your 10 most recent reviews in that voice — free, no signup, just a preview link:

→ {AUDIT_URL}?variant=L

If the drafts capture the practice's tone (or don't), one line back would be useful. If "not a fit right now," that's a fine answer too — no follow-up either way.

Thanks for the time.
ReviewHub · reviewhub.review
```

---

### D-SG-3 — Dentalis — `hello@dentalis.clinic`

**Subject (Variant C):**
```
Quick question about Dentalis's review replies
```

**Body:**
```
Hi Dentalis team,

25 years and 10,000+ patients is the kind of background where a generic "thanks for choosing us" reply undersells the work. Dr Liu's name shows up in your reviews repeatedly — those deserve a personal back-thanks that matches the boutique positioning.

I drafted reply suggestions for your 10 most recent Google reviews in that voice — free, no signup, just a preview:

→ {AUDIT_URL}?variant=L

If the tone feels right (or off), a one-line reply either way would help me calibrate. Not a fit? That's a perfectly valid answer too — no follow-up.

Thanks for the time.
ReviewHub · reviewhub.review
```

---

### D-SG-4 — An Dental — `contact@andental.sg`

**Subject (Variant A):**
```
Noticed An Dental's Eastern + Western positioning — drafted some review replies
```

**Body:**
```
Hi An Dental team,

The "Eastern healing + Western dental tech" positioning is rare — and the reviews lean into it (patients mention the calm room atmosphere as much as the clinical work). Replies that acknowledge BOTH dimensions feel right for the brand, not just "thanks for the kind words."

I drafted reply suggestions for your 10 most recent Google reviews in that voice — free, no signup, just a preview:

→ {AUDIT_URL}?variant=L

If the drafts capture the practice's tone (or don't), one line back either way would be genuinely useful. Not interested? No follow-up.

Thanks for the time.
ReviewHub · reviewhub.review
```

---

## DENTAL — Bangkok

### D-BKK-1 — Smile Signature (Sukhumvit) — `contact@smilesignature.com`

**Subject (Variant B):**
```
Reply drafts for Smile Signature's last 10 reviews
```

**Body:**
```
Hi Smile Signature team,

The Sukhumvit location's reviews from international patients consistently name specific dentists — and those are the reviews that bring repeat visitors (and word-of-mouth). They deserve a reply that names the dentist back, not a generic clinic acknowledgment.

I drafted reply suggestions for your 10 most recent Google reviews in that voice — free, no signup, just a preview link:

→ {AUDIT_URL}?variant=L

If the drafts feel right for an international-patient flagship (or don't), one line back would help me calibrate. Not a fit? No follow-up either way.

Thanks for the time.
ReviewHub · reviewhub.review
```

---

### D-BKK-2 — SmileBox Dental Clinic — `contact@smileboxclinic.com`

**Subject (Variant C):**
```
Quick question about SmileBox's review replies
```

**Body:**
```
Hi SmileBox team,

3 chairs per location and a 2021 opening means each review carries more weight than at a 20-chair clinic — your reviewers seem to know that, leaving longer specific reviews about the personal feel. Replies that match that personal scale (vs corporate auto-reply) compound the boutique signal.

I drafted reply suggestions for your 10 most recent Google reviews — free, no signup, just a preview:

→ {AUDIT_URL}?variant=L

If the tone fits a Thonglor boutique (or doesn't), one line back either way would help. Not interested? That's a fine answer too — no follow-up.

Thanks for the time.
ReviewHub · reviewhub.review
```

---

### D-BKK-3 — Keishikai International Dental — `contact@keishikaidentalclinic.com`

**Subject (Variant A):**
```
Noticed Keishikai's Phrom Phong expat reviews — drafted some replies
```

**Body:**
```
Hi Keishikai team,

The Phrom Phong location's review mix — Japanese expat patients, Thai locals, named dentists (Dr Udom, Dr Torsak, Dr Malinee) — is harder to reply to in one voice than most clinics. The generic "thanks for choosing us" misses the named-dentist warmth those reviews actually deserve.

I drafted reply suggestions for your 10 most recent Google reviews, calibrated to the Japanese-expat-meets-Thai positioning — free, no signup, just a preview:

→ {AUDIT_URL}?variant=L

If the drafts feel right (or off), one line back would help me calibrate. Not a fit right now? No follow-up either way.

Thanks for the time.
ReviewHub · reviewhub.review
```

---

## SPA — Singapore

### S-SG-1 — Serena Spa (Orchard) — `orchard@serenaspa.com`

**Subject (Variant B):**
```
Reply drafts for Serena Spa Orchard's last 10 reviews
```

**Body:**
```
Hi Serena Spa team,

Marriott Tang Plaza's reviewers leave the kind of named-therapist 5-stars where a generic "thanks for the kind words" undersells. The reviews that name the therapist (and the specific treatment) deserve a reply that mirrors back — that's repeat-visit fuel.

I drafted reply suggestions for your 10 most recent Google reviews — free, no signup, just a preview link:

→ {AUDIT_URL}?variant=L

If the tone fits a hotel-attached spa (or doesn't), one line back either way would be useful. Not interested? No follow-up.

Thanks for the time.
ReviewHub · reviewhub.review
```

---

### S-SG-2 — La Source Spa — `info@lasource.com.sg`

**Subject (Variant C):**
```
Quick question about La Source's review replies
```

**Body:**
```
Hi La Source team,

The Voco Orchard reviews lean holistic — guests writing about ritual and intention, not just "great massage." Replies that match the holistic positioning (vs generic transactional thank-you) feel like the only fit.

I drafted reply suggestions for your 10 most recent Google reviews in that voice — free, no signup, just a preview:

→ {AUDIT_URL}?variant=L

If the drafts capture La Source's tone (or don't), one line back would help me calibrate. Not a fit? Perfectly fine — no follow-up.

Thanks for the time.
ReviewHub · reviewhub.review
```

---

### S-SG-3 — Privilège Boutique — `contact@theprivilegeboutique.com`

**Subject (Variant A):**
```
Noticed Privilège's mixed EN/ZH reviews — drafted some replies
```

**Body:**
```
Hi Privilège Boutique team,

Your Orchard reviews are split EN + ZH, which most reply tools handle by defaulting to English and losing the Mandarin reviewers' warmth. Auto-detecting and matching the reviewer's language is a small thing that compounds — and for a Mandarin-friendly Orchard boutique, it matters.

I drafted reply suggestions for your 10 most recent Google reviews matching each reviewer's language — free, no signup, just a preview link:

→ {AUDIT_URL}?variant=L

If the language-matching feels right (or off), one line back would help. Not interested? No follow-up either way.

Thanks for the time.
ReviewHub · reviewhub.review
```

---

## SPA — Bangkok

### S-BKK-1 — Loft Thai Spa & Massage — `contact@loft-thai.com`

**Subject (Variant B):**
```
Reply drafts for Loft Thai's last 10 reviews
```

**Body:**
```
Hi Loft Thai team,

The "World Champion Therapists" positioning is a real differentiator — and the reviews lean into it (named-therapist 5-stars, specific technique mentions). Those deserve a reply that names the therapist back AND the specific treatment, not a generic spa thank-you.

I drafted reply suggestions for your 10 most recent Google reviews in that voice — free, no signup, just a preview:

→ {AUDIT_URL}?variant=L

If the drafts feel right for the Phra Khanong location (or don't), one line back would help me calibrate. Not a fit? No follow-up.

Thanks for the time.
ReviewHub · reviewhub.review
```

---

### S-BKK-2 — Su Esthetic — `suesthetic@gmail.com`

**Subject (Variant C):**
```
Quick question about Su Esthetic's review replies
```

**Body:**
```
Hi Su Esthetic team,

Korean-spa positioning since 2004 in Bangkok is rare — and "6 guests per session" means each review is from someone who got real attention. Replies that match that intimate scale (vs corporate auto-reply) compound the boutique signal you've built.

I drafted reply suggestions for your 10 most recent Google reviews in that voice — free, no signup, just a preview:

→ {AUDIT_URL}?variant=L

If the tone fits a Sukhumvit 26 boutique (or doesn't), one line back either way would be useful. Not interested? That's a fine answer too — no follow-up.

Thanks for the time.
ReviewHub · reviewhub.review
```

---

### S-BKK-3 — ZENVANA Wellness Spa — `zenvanawellness@gmail.com`

**Subject (Variant A):**
```
Noticed ZENVANA's Talingchan wellness positioning — drafted some replies
```

**Body:**
```
Hi ZENVANA team,

A west-Bangkok wellness spa is positioned differently from the Sukhumvit cluster — your reviewers seem to mention the calm + holistic angle more than treatment-specifics. Replies that match the wellness-not-pampering tone matter for repeat visits.

I drafted reply suggestions for your 10 most recent Google reviews in that voice — free, no signup, just a preview:

→ {AUDIT_URL}?variant=L

If the drafts feel right for a Talingchan wellness brand (or don't), one line back would help. Not a fit? Perfectly fine — no follow-up.

Thanks for the time.
ReviewHub · reviewhub.review
```

---

## Send-day quick checklist (re-print and tick off as you send)

```
[ ] D-SG-1 TP Dental         contact@tpdental.com.sg              Variant A   __:__
[ ] D-SG-2 Pacific Dental    fd@pacificdental.com.sg              Variant B   __:__
[ ] D-SG-3 Dentalis          hello@dentalis.clinic                Variant C   __:__
[ ] D-SG-4 An Dental         contact@andental.sg                  Variant A   __:__
[ ] D-BKK-1 Smile Signature  contact@smilesignature.com           Variant B   __:__
[ ] D-BKK-2 SmileBox         contact@smileboxclinic.com           Variant C   __:__
[ ] D-BKK-3 Keishikai        contact@keishikaidentalclinic.com    Variant A   __:__
[ ] S-SG-1 Serena Spa        orchard@serenaspa.com                Variant B   __:__
[ ] S-SG-2 La Source         info@lasource.com.sg                 Variant C   __:__
[ ] S-SG-3 Privilège         contact@theprivilegeboutique.com     Variant A   __:__
[ ] S-BKK-1 Loft Thai        contact@loft-thai.com                Variant B   __:__
[ ] S-BKK-2 Su Esthetic      suesthetic@gmail.com                 Variant C   __:__
[ ] S-BKK-3 ZENVANA          zenvanawellness@gmail.com            Variant A   __:__
```

**Subject variant distribution check:**
- Variant A (observation): 5 prospects (D-SG-1, D-SG-4, D-BKK-3, S-SG-3, S-BKK-3)
- Variant B (direct benefit): 4 prospects (D-SG-2, D-BKK-1, S-SG-1, S-BKK-1)
- Variant C (question): 4 prospects (D-SG-3, D-BKK-2, S-SG-2, S-BKK-2)

Cross-vertical + cross-city distribution lets us read which variant
opens better, independent of vertical-or-city confounds.

---

## After sending — diagnostic timeline

| Day | Action |
|---|---|
| Day 0 (send day) | Mark each send with timestamp in tracker |
| Day 1-2 | Watch for bounces in `mailer-daemon` inbox folder. Any bounce = email was wrong; mark prospect as "channel-failed" |
| Day 3-5 | First real opens land if they're going to. Check `/api/admin/outreach-stats` — but APPLY THE VERIFICATION-CLUSTER CHECK (timestamps should be spread organically, not clustered at one send-day verification minute) |
| Day 5-7 | Reply window. Most replies arrive in this window if at all |
| Day 7 | Run `wave-diagnostic.mjs --wave=6`, read against `wave-6-outcomes-tree.md`, execute the matching branch |
| Day 8+ | Followup window (one followup, vertical-specific template from `wave-5-followup-template.md`) for any opened-no-reply prospects |

**Don't celebrate any number before Day 7.** Wave 5's verification-
batch contamination produced "64% open rate" that was actually ~7%.
The diagnostic CLI is the only way to read the data honestly.
