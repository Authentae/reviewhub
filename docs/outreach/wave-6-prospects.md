# Wave 6 prospect roster — researched 2026-05-21/22 overnight

**Research protocol:** every email below was verified on the prospect's
OWN website. NO pattern-guessed `<biz>@gmail.com` addresses (the
Wave 5 failure mode: 4 of 5 muay thai sends bounced because of
pattern-guess emails). Sources visited via WebFetch + Puppeteer
(`scripts/research-prospect.mjs` decodes Cloudflare cfemail
obfuscation). If an email isn't listed below, it means the site
doesn't publish one and we'd be guessing — skip in this wave.

**Final Phase-1 tally: 13 prospects** across 2 cities × 2 verticals
(dental + spa). Honest target was 30; researched the broader list
but only verified-on-site emails kept. Coffee + Manila + KL skipped
after diminishing returns (coffee shops largely don't publish emails
on their websites — different buyer model; KL/Manila dental and spa
need their own research round which would push past the overnight
budget).

**Why this wave is different from Wave 5:**
- Wave 5 = 14 Bangkok-only prospects, 4 bounced (entire muay thai
  cohort, pattern-guessed `<biz>@gmail.com`), 0 confirmed real opens
  (all "views" were Earth's URL-verification batches, not prospect
  engagement — verification-batch fingerprint at 5/16 21:51 and 5/18
  09:41 timestamps).
- Wave 6 = 13 verified emails, two cities (Bangkok continued for
  proven channel + Singapore as a geography test), drops muay thai
  entirely (Wave 5 proved email is the wrong channel for gyms).
- Wave 6 enforces email-verification AT RESEARCH TIME (not at send
  time, which was already too late for Wave 5).

---

## Dental — 7 verified

### Singapore — 4 prospects

| # | Clinic | Email | Website | Notes |
|---|---|---|---|---|
| D-SG-1 | **TP Dental** | `contact@tpdental.com.sg` | tpdental.com.sg | Established 53+ years, Ngee Ann City Tower B Orchard, single location, open 363 days/yr, English-default, "after-hours emergency" positioning |
| D-SG-2 | **Pacific Dental Group** | `fd@pacificdental.com.sg` | pacificdental.com.sg | Scotts Road #10-07 Scotts Medical Centre @ Pacific Plaza, single location, English-default |
| D-SG-3 | **Dentalis** | `hello@dentalis.clinic` | dentalis.clinic | Founder Dr Jonathan Liu (25+ yrs, 10,000+ patients), 52 Craig Rd Tanjong Pagar, single location, boutique-positioned, founder-voice angle works here |
| D-SG-4 | **An Dental** | `contact@andental.sg` | andental.sg | 360 Orchard Rd #03-06/07 International Bldg (next to Lido), 9 dentists spanning periodontics + general + cosmetic, single location, "Eastern + Western dentistry" positioning |

**Singapore dental positioning angle:** premium / specialist /
boutique, English-fluent owners, expat patient mix. Wave 6 hypothesis:
S$14 USD ≈ ~S$19 SGD — accessible price for clinics charging $100-300
per appointment.

### Bangkok — 3 prospects (NEW — Wave 5 already used Asok Montri + IDENT)

| # | Clinic | Email | Website | Notes |
|---|---|---|---|---|
| D-BKK-1 | **Smile Signature (Sukhumvit)** | `contact@smilesignature.com` | smilesignature.com | Dhammalert Bldg Level 2 between Soi 13/15, BTS Asoke or Nana, English-default, "international patients flagship clinic" |
| D-BKK-2 | **SmileBox Dental Clinic** | `contact@smileboxclinic.com` | smileboxclinic.com | Thonglor-Ekamai + Riverside (2 small locations, 3 chairs each), opened 2021, English-default, boutique scale, recent enough to still be founder-led |
| D-BKK-3 | **Keishikai International Dental** | `contact@keishikaidentalclinic.com` | keishikaidentalclinic.com | Sukhumvit 26 Nihonmachi 115, near Emporium / BTS Phrom Phong, 3 dentists (Dr Udom Anurugvongsri, Dr Torsak Thanawuth, Dr Malinee Jaikamwang), English+Japanese-default, Japanese expat focus + Thai market |

**Bangkok dental positioning angle:** Wave 5 sent 2 BKK dental
(Asok Montri + IDENT), both got the email and opened the audit (100%
on tiny N=2 BUT views may have been Earth's verification clicks — see
verification-batch caveat). This wave expands BKK dental to N=3 new
prospects to test whether the open-rate signal generalises with a
clean (no verification-batch contamination) data point.

---

## Spa — 6 verified

### Singapore — 3 prospects

| # | Spa | Email | Website | Notes |
|---|---|---|---|---|
| S-SG-1 | **Serena Spa (Orchard)** | `orchard@serenaspa.com` | serenaspa.com/orchard | 320 Orchard Road, Marriott Tang Plaza Hotel #04-01. Hotel-attached — buyer is spa manager, not owner; slightly different decision-maker. Premium positioning. |
| S-SG-2 | **La Source Spa** | `info@lasource.com.sg` | lasource.com.sg | Voco Orchard Singapore #02-17/18, holistic positioning, independent brand, hotel-collocated. Single-brand single-location. |
| S-SG-3 | **Privilège Boutique** | `contact@theprivilegeboutique.com` | theprivilegeboutique.com | Orchard Road, "luxury spa with advanced skin analysis tech," independent boutique, EN + ZH content (so the AI-draft language matching is a real value-prop here — they DO get Chinese-language reviews). |

**Singapore spa positioning angle:** premium / luxury / Orchard-based
foreign-clientele heavy. Multilingual review-reply capability is a
specific differentiator for the Mandarin/English-mixed Singapore
context.

### Bangkok — 3 prospects (NEW — Wave 5 already used CORAN, Dahra, Infinity, Preme, Treasure)

| # | Spa | Email | Website | Notes |
|---|---|---|---|---|
| S-BKK-1 | **Loft Thai Spa & Massage** | `contact@loft-thai.com` | loft-thai.com | Sukhumvit 71 (Phra Khanong) + 38 + 24, "World Champion Therapists" award-positioning, franchise originator (single original location but franchise model exists — flag as semi-chain). English-default. |
| S-BKK-2 | **Su Esthetic** | `suesthetic@gmail.com` | suesthetic.com | Sukhumvit 26 (near Phrom Phong), since 2004, Korean-spa positioning, "intimate setting only 6 guests per session," boutique. Email is gmail-on-business (real, verified on site). |
| S-BKK-3 | **ZENVANA Wellness Spa** | `zenvanawellness@gmail.com` | zenvanawellness.com | Ratchapruek Rd, Talingchan (NOT Sukhumvit — west Bangkok, different customer base than Wave 5's Sukhumvit-heavy cohort), wellness positioning. Single location. |

**Bangkok spa positioning angle:** Wave 5 sent 5 Sukhumvit/Silom
spas, 0 confirmed real opens (verification-batch contamination). This
wave keeps Sukhumvit (Loft Thai, Su Esthetic) AND diversifies west
(ZENVANA) — geography-within-Bangkok signal.

---

## Coffee — 0 verified (vertical paused for this wave)

Researched 7 candidate coffee shops (Bangkok + Singapore) including
Phil Coffee, PAGA Microroastery, Five Oars, Roots, Upside Down,
Maison Ysaè (also spa). **None publish a public email address on
their websites.** Specialty coffee operates a different buyer model
— walk-in trade, no inbound-email expectation. Roots had a
`wholesale@rootsbkk.com` (5-location chain, not independent).

Coffee will need a different research method (LinkedIn, IG DMs, or
walk-in handshake) — NOT email outreach. Documented as a finding;
not blocking Wave 6 launch.

---

## What's NOT in this wave (and why)

| Vertical | Reason |
|---|---|
| Muay Thai gyms | Wave 5 bounced 4/5 emails. Email is the wrong channel for this vertical (gym owners use FB/IG, not email-on-website). Would need separate IG-DM wave. |
| Specialty coffee shops | 0/7 published email addresses on websites. Different buyer model. Use IG DM if pursued later. |
| Hotels (full hotel brands) | Buyer chain too long; spa contact = manager, not owner |
| Multi-location chains (3+ locations) | Per Earth's criteria: independent only; chains have agency relationships already |
| KL / Manila prospects | Pushed to a future wave — research time-budget exhausted this overnight session at 13 prospects across 2 cities |

---

## Geographic + vertical split

| Vertical \ City | Bangkok | Singapore | Total |
|---|:---:|:---:|:---:|
| Dental | 3 | 4 | **7** |
| Spa | 3 | 3 | **6** |
| Coffee | 0 | 0 | 0 |
| **Total** | **6** | **7** | **13** |

Singapore-heavy distribution lets us compare geographies cleanly
(Wave 5 was Bangkok-only). If Singapore opens significantly better
than Bangkok at the same vertical, that's a real signal that the
buyer profile / cold-email norm differs by city.

---

## Related files (Phase 2 outputs — separate commits)

- `docs/wave-postmortems/wave-6-outcomes-tree.md` — pre-committed
  decision branches (Phase 2)
- `docs/outreach/wave-6-send-sheet.md` — paste-ready Gmail bodies
  per prospect (Phase 2)
- `docs/strategy/post-wave-5-synthesis.md` — what Wave 1-5
  collectively tell us, where Wave 6 hypothesis-tests (Phase 4)
- `scripts/research-prospect.mjs` — the research tool used to verify
  each email (already committed; reusable for future waves)

---

## Send-day operational rules (locked in advance — read at send time, don't re-derive)

1. **Send window:** Tue or Wed 9-11 AM Bangkok / Singapore (UTC+7/+8).
   Proven open window across Waves 2-4.
2. **Sender:** `earth.reviewhub@gmail.com` (brand account, NOT
   `theearth1659@gmail.com` personal).
3. **Verify EACH audit-preview URL with `curl -I` before sending.**
   Don't repeat the Wave 1 typo'd-URL incident.
4. **Mark sent timestamps in a separate column for diagnostic
   matching.** Don't rely on `audit_previews.created_at` as a proxy
   (Wave 5 lesson — Earth's URL-verification clicks contaminated the
   view counts because audits were created days BEFORE the actual
   sends).
5. **Mark verification-clicks deliberately.** Before sending, open
   each audit URL once from Earth's browser (to confirm it works).
   That single-view count for each audit IS Earth's verification —
   any view count > 1 from that prospect IS a real open.
6. **Wait 5-7 days before any harvest claim.** Don't celebrate "X%
   open rate" until the verification-batch fingerprint problem has
   been ruled out (cluster check on first_viewed_at timestamps).
7. **Use `?variant=L` URL parameter on ALL audit-preview share
   URLs in this wave** to align with the L-variant hypothesis from
   commit `de75c0f` (low-friction lead, async-ask primary, paid
   demoted).

---

## Honest caveats

1. **N=13 is small.** Even with 100% deliverability, max signal is 13
   opens / 13 replies. Statistical power is limited.
2. **Some prospects are border-line independent.** An Dental (9
   dentists, single location — could still be founder-led). Loft Thai
   (franchise originator — but the original Phra Khanong location is
   still founder-run). Flag if a reply happens; understand the buyer.
3. **No coffee, no muay thai, no KL/Manila.** This wave doesn't test
   those segments. Earth should decide whether to research them in a
   future wave OR pivot the strategy if Wave 6 produces signal.

---

**Document status:** FINAL for Phase 1 of overnight session 2026-05-21
→ 2026-05-22. Phases 2-4 follow in separate commits.
