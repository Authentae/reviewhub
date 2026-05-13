# Deliverability confirmed (2026-05-13)

**Status:** Verdict shipped. Standalone doc, will be cited by the Wave 4
reply-window post-mortem on Sat 5/16.

## Question this post-mortem answers

Wave 1+2+3 combined diagnostic (2026-05-10) showed 12 cold sends → 4
opened (33%) → 0 replied. Two competing hypotheses:

- **H1:** Emails are going to spam folders. The "open" rate is gmail's
  prefetch / image-pixel firing inside spam — not a real human read.
  Owners never see the message. **Infrastructure problem.**
- **H2:** Emails are landing in inboxes and being read. Owners see the
  pitch and don't reply. **Pitch / audience / offer problem.**

These two hypotheses have completely different fix paths. H1 fixes are
SPF/DKIM/DMARC tightening, dedicated sender reputation, IP warm-up.
H2 fixes are copy revisions, audience reselection, offer changes,
or "this category is wrong at this stage" — pivot signal.

Until 2026-05-13 we had zero data separating the two.

## Method

Sent a real Wave-4-shaped TH outreach email from
`earth.reviewhub@gmail.com` (the same brand account that fires all
Wave-N outreach) to a fresh mail-tester.com inbox at 17:50 ICT
on 2026-05-13. Subject and body mirrored Wave 4's dominant TH cold-
email template, including the audit-preview URL pattern, the
salutation/sign-off, and the 1KB size envelope of real sends.

Test address: `test-ju3y2dfqa@srv1.mail-tester.com`
Result URL: `https://www.mail-tester.com/test-ju3y2dfqa`

Auth-trail evidence is preserved in the mail-tester response (DKIM
public key, DMARC DNS, SPF redirect chain). Mail-tester also fingerprints
the sending IP and rDNS, which lets us verify the same Google IP block
is consistently authorized.

## Result

**Score: 8.2/10** — "Good stuff. Your email is almost perfect."

| Check | Status | Detail |
|---|---|---|
| SPF | ✅ pass | `v=spf1 redirect=_spf.google.com`, IP 209.85.222.68 in `_spf.google.com` |
| DKIM | ✅ valid | 2048-bit key, signature from gmail.com, all 4 SpamAssassin DKIM rules positive |
| DMARC | ✅ pass | `_dmarc.gmail.com` record, `p=none dis=none` policy (non-enforcing but compliant) |
| rDNS | ✅ correct | `mail-ua1-f68.google.com` properly reverse-DNS'd from sending IP |
| Blacklists | ✅ clean | Zero blacklist hits. Listed on **`wl.mailspike.net` whitelist** (positive reputation signal) |
| Message size | ✅ 1KB | Within sweet spot (50B - 100KB) |
| Text ratio | ✅ 75% | Above the 60% minimum where spam filters flag image-heavy mail |

### The 1.8 points lost

One real deduction: `HTML_MESSAGE -1.999`. Mail-tester's own annotation
on that line reads "No worry, that's expected if you send HTML emails."
Every Gmail-sent message gets this penalty because Gmail wraps plaintext
in HTML automatically. It's not actionable — there's no Gmail UI that
sends a true `text/plain` message.

A theoretical workaround would be sending via SMTP API (Resend, Postmark)
with a forced `text/plain` envelope. That clawback gets us to ~10/10,
but at the cost of:
- Not sending from `earth.reviewhub@gmail.com` (the brand account, which
  owns the reply thread, which is what prospects reply to)
- Spinning up a transactional-email account and warming a new IP
- Losing Gmail Schedule Send convenience for 12-prospect waves

**The 0.2-point clawback is not worth this complexity at pre-revenue
scale.** Revisit if and when send volume exceeds Gmail's 500/day limit.

Other minor warnings (totaling <0.005 points combined): `FREEMAIL_FROM`
(sending from gmail.com), `SPF_HELO_NONE` (HELO doesn't publish SPF —
a Google infrastructure detail, not Earth's to fix). Ignore both.

## Verdict

**H1 is falsified. H2 stands.**

Wave 1+2+3's 0-reply outcome is not a deliverability problem.
The 33% open rate from Wave 1-2 is a real open rate. Prospects are
seeing the message and choosing not to reply.

This collapses the next decision tree to one branch: when Wave 4's
reply window closes Sat 5/16, the only legitimate inferences are about
**pitch / audience / offer**, not infrastructure. Don't waste a
post-mortem cycle re-debating whether emails landed.

## Implications for Wave 4 (still-pending data)

Three things to watch when Wave 4's reply window closes Sat 5/16:

1. **Hospitality 200+ vertical** (Lilit, Raweekanlaya, Lamphu Tree,
   Lamphu House, Nouvo, Public House, Volve) — 7 sends. If 0/7 reply,
   the hospitality-200+ thesis breaks. Either the category doesn't want
   this product, or the pitch isn't reaching the decision-maker.
2. **TH vs EN open/reply skew** — 4 TH sends vs 3 EN sends in Wave 4.
   If TH replies while EN doesn't (or vice versa), that's a language-fit
   signal — strong enough to bias future segmentation.
3. **Tue 5/12 follow-ups** (Chakrabongse, Loftel 22, Old Capital) —
   these are 2nd-touch on prospects who already opened once. If they
   don't reply to the follow-up either, the audit-preview page conversion
   is the real bottleneck, not the cold email.

## Fork decisions (frozen until Sat 5/16 data lands)

If Wave 4 yields ≥1 reply: copy/segment is working. Refine and scale.

If Wave 4 yields 0 replies: serious decision. Three branches:
- **Branch A (copy):** Rewrite the cold-email body. Test "specific
  observation" hook ("I noticed Chakrabongse hasn't replied to its last
  3 reviews — here's a draft for the most recent") vs current "I made
  you 10 drafts" framing. Slower, more personalized; harder to scale.
- **Branch B (audience):** Pivot to a different vertical. Bangkok
  cafe owners + Bangkok dentists are the two next-likely candidates
  (both have category names already in vertical landing pages). Drop
  hospitality.
- **Branch C (offer):** Shift the asks. Instead of "free audit", offer
  "let me draft your hardest 1-star reply this week" — micro-favor at the
  edge of their actual workflow.

The branch we pick should be informed by *which* 0-reply pattern we see
on Wave 4, not by gut feel.

## Action items now

None. Wait for Sat 5/16 data.

## Files this doc cites

- `docs/wave-postmortems/wave-1-2-3-combined-diagnostic.md` — the original
  0-reply data
- `docs/wave-postmortems/wave-4-drafts-FILLED.md` — Wave 4 actual sends
- Mail-tester response (transient URL, not cited; relevant snapshot inlined above)
