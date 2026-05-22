# Wave 5 muay thai prospects — IG / FB DM scripts (4 bounced email)

**Trigger:** Wave 5 sent to 5 muay thai gyms; 4 emails bounced
(addresses don't exist). Email is the wrong channel for this
vertical — gym owners don't publish or check email-on-website. They
DO live on Instagram and Facebook Messenger.

This doc gives paste-ready DM scripts for the 4 bounced prospects.
Earth needs to:
1. Open Instagram or Facebook in his normal Chrome
2. Sign in if not (Chrome MCP is blocked on social platforms — safety
   rule, social-account credential entry is prohibited for the agent)
3. Navigate to each prospect's IG / FB page (URLs below)
4. Click "Message" / "Send Message"
5. Paste the body
6. Send 1 → wait for response → send next

**Don't blast all 4 in 10 minutes.** Looks like a bot. Space at
~30-60 min apart, or do 1-2 per day.

---

## Pre-DM preparation (~30 sec per prospect)

Before opening the message box, visit the prospect's IG/FB and
check the most recent 3-5 posts. Reference ONE specific thing in
the DM (a fighter named, a clinic location mentioned, a recent event
post). Generic openers get deleted; specific opens get replies.

---

## 1. Chuwattana Boxing Gym

**Source:** Facebook (no IG handle in research notes)
- **FB URL:** https://facebook.com/Chuwatthana-Boxing-Gym-261658753853598
- **Original email (bounced):** chuwatthanaboxinggym@gmail.com
- **Phone (alternative):** 084-023-3600

**DM body:**
```
Hi team,

Sent an email last week about ReviewHub but it bounced (the gmail
address doesn't work — heads up if you didn't know).

Quick context: I drafted reply suggestions for your 10 most recent
Google reviews, focused on the trial-class reviews from
international fighters who came back for a second week — that's
the warmest pattern in your feed and the one that deserves a
named-trainer reply, not a generic "thanks for the review."

Free to look, no signup, no card:

→ {AUDIT_URL}?variant=L

If the drafts feel right for the gym (or wrong), a one-line reply
either way would help me understand what works for muay thai
specifically. No pressure either way.

Cheers
ReviewHub · reviewhub.review
```

**Note:** Chuwattana's FB page name may auto-fill as "Chuwatthana
Boxing Gym" — variants of the name are normal. Confirm you're on
the right page by checking the address (Bangkok independent gym,
foreigner-friendly per expatden directory).

---

## 2. Eminent Air Boxing Gym

**Source:** Instagram (best) + Website
- **IG handle:** @eminentairboxinggym
- **IG URL:** https://instagram.com/eminentairboxinggym
- **Website:** eminentgym.com (might have a contact form as backup)
- **Original email (bounced):** eminentairboxinggym@hotmail.com
- **Phone (alternative):** 087-901-1255

**DM body:**
```
Hi team at Eminent Air,

Sent an email last week but the hotmail address bounced — heads up
in case you didn't know.

I drafted reply suggestions for your 10 most recent Google reviews
focused on the named-coach thanks pattern your five-stars use.
Most spa/gym reply tools generate generic "thanks for the review"
templates; the drafts here name the coach the reviewer named.

Free to look, no signup, no card:

→ {AUDIT_URL}?variant=L

If the drafts capture the gym's voice (or don't), one line back
either way is genuinely useful — silence is the one signal I can't
decode. No follow-up either way.

Cheers
ReviewHub · reviewhub.review
```

---

## 3. Rithirit Gym Academy

**Source:** Facebook
- **FB URL:** https://facebook.com/RithiritGymAcademy
- **Original email (bounced):** rithiritgym@gmail.com
- **Phone (alternative):** 095-534-5980

**DM body:**
```
Hi team,

Sent an email last week but the gmail bounced — figured I'd reach
out here instead.

Quick context: I drafted reply suggestions for your 10 most recent
Google reviews focused on the Master-Jitti-by-name pattern in your
five-stars — those reviews deserve a thank-you that mirrors back
the trainer the fighter named, not a generic gym auto-reply.

Free to look, no signup, no card:

→ {AUDIT_URL}?variant=L

If the drafts feel right for a 23-year master-trainer reputation
(or don't), a one-line reply either way would help. Not a fit
right now? No follow-up.

Cheers
ReviewHub · reviewhub.review
```

---

## 4. Master Toddy Muay Thai Academy

**Source:** Instagram (best) + Website
- **IG handle:** @mastertoddy_bangkok
- **IG URL:** https://instagram.com/mastertoddy_bangkok
- **Website:** mastertoddy.com (likely has a contact form)
- **Original email (bounced):** mastertoddy@gmail.com
- **Phone (alternative):** 084-325-8822

**DM body:**
```
Hi team at Master Toddy,

Quick note — sent an email last week about ReviewHub but the gmail
address bounced. Figured I'd reach out via IG instead.

I drafted reply suggestions for your 10 most recent Google reviews
focused on the long-term-stay fighter reviews where reviewers
mention specific trainers' clinch technique by name. Those deserve
a reply that names the trainer back, not a generic gym thank-you.

Free to look, no signup, no card:

→ {AUDIT_URL}?variant=L

If the drafts capture the academy's voice (or don't), a one-line
reply either way would be genuinely useful. Not a fit? No
follow-up either way.

Cheers
ReviewHub · reviewhub.review
```

---

## Pre-send for each DM

Before pasting, generate the prospect's audit-preview URL:
1. Open `/admin` → audit-preview generator (or whatever the admin
   UI route is)
2. Paste the prospect's Google Maps URL OR paste 5-10 of their
   most recent Google reviews
3. Wait for the audit to generate → copy the share URL
4. Append `?variant=L` to the URL
5. `curl -I <url>` to confirm 200
6. ONE verification click in your browser (single, deliberate)
7. Paste into the DM body in place of `{AUDIT_URL}?variant=L`
8. Send

---

## Post-DM tracking

If they reply on IG/FB, the conversation lives in your IG/FB inbox.
Move it to a tracker (or keep in your head — 4 prospects is small
enough). Record:
- Date DM sent
- Date they viewed (IG shows "Seen at X" once they open)
- Date they replied OR "no reply after 7 days"

If they viewed but didn't reply within 5 days: don't follow up on
IG. The "DM read receipt" is a stronger signal than email, and a
follow-up DM reads more invasive than a follow-up email. Move on.

---

## What this is NOT for

- Cold DMs to NEW muay thai prospects — this is for the 4 Wave 5
  bounces specifically. A new outreach wave needs new prospect
  research.
- Spamming multiple gyms simultaneously — paced sends only (1-2/day).
- Replacing the email channel for verticals where email works —
  dental + spa stay on email per Wave 6.

---

## Backup channel if IG/FB don't yield response

If 0 of 4 reply within 7 days after the DM:

1. **Phone call** — Earth's `about_me_observed.md` says no calls, but
   for these 4 specifically, a 60-second voice call ("hi, I sent
   you an IG message about drafting Google review replies — got a
   sec?") would either land or kill it cleanly. NOT a sales call,
   a 60-second qualification.

2. **Walk-in** — Chuwattana / Eminent Air / Rithirit / Master Toddy
   are all Bangkok-based. Earth lives in Bangkok. A 30-min walk-in
   per gym (Sat/Sun afternoon) is 2 hours total. Shows up in person
   with a printed reply-draft sheet. Either lands as memorable or
   reveals that the entire category isn't a fit.

3. **Drop muay thai as a vertical.** Wave 5's failure (4/5 emails
   bounced + non-response to IG) might be telling us this isn't
   our segment. Confirm by spending 30 min reading muay thai gym
   reviews — do owners RESPOND to reviews now? If not, they probably
   don't see review-reply tools as a felt need.

The last option is the most strategically important. Document
the answer in `docs/strategy/post-wave-5-synthesis.md` either way.
