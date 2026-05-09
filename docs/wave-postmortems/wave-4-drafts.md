# Wave 4 — email drafts (per-prospect)

Drafted 2026-05-08 evening by agent. Each email is **fresh-per-prospect**
per the audit-outreach playbook (not copy-paste-template). Length and
hook matched to what we actually know about each property.

> **2026-05-08 (afternoon update — Maps verification by agent):** Three
> prospects DISQUALIFIED at the 200-review-threshold pre-filter and
> their drafts below should NOT be sent:
>
> - **#6 Baan 2459 — 120 reviews ✗** (was: "check")
> - **#11 Bangkok Voyage — 120 reviews ✗** (was: unspecified)
> - **#12 Baan Vajra Silom — 163 reviews ✗** (was: unspecified)
>
> Wave 4 effective send count: **9 of 12.** The "small owner-run /
> voice matters strongly" cohort (which the verification checklist's
> Tuesday split prioritized) has fewer reviews precisely *because*
> they're small — the 200+ criterion fights the voice-matters criterion.
> Lesson for Wave 5+: pre-filter by review count BEFORE doing per-
> prospect research.
>
> Other corrections from Maps verification:
>
> - **#5 Lamphu House** — website is `lamphuhousebangkok.com`,
>   NOT `lamphuhouse.com` as drafted. Fix the email's TO field.
> - **#7 Nouvo City** — Thai-script branding "โรงแรมนูโว ซิตี" plus
>   3,918 reviews suggests the audience may skew more bilingual than
>   the original "halal-international = EN" framing. Earth's call:
>   keep EN, or send TH version, or send both languages in one body.
> - **#10 IR-ON** — 317 reviews (smallest of the 9 qualifying), 22
>   rooms, Thai-design-positioned. Hook angle still solid.
> - **#9 Volve** — 527 reviews. Owner is Thai per WebFetch ("Khun Um").
>   TH default holds.
> - **#4 Lamphu Tree** — 926 reviews, 4.5★. Owner-decorated property
>   hook still solid; smallest-of-the-mid-tier.
>
> Ratings on the qualifying 9 range 4.2 (Lamphu House) to 4.8 (Public
> House) — all healthy. Owner-reply ratio still needs Earth's eyeball
> pass per prospect; that's editorial judgment Chrome MCP can't reliably
> do at scale.
>
> **2026-05-09 — partial reply-ratio pass via Chrome MCP (agent):**
>
> - **#10 IR-ON Hotel — DQ added.** Reply ratio: 7 of 8 visible Google
>   reviews have owner responses (~88%). Per audit-outreach playbook,
>   60%+ response rate disqualifies (they're already doing the work;
>   demo unimpressive; ROI math fails). Drop. Wave 4 effective batch:
>   8 of 12.
> - **#9 Volve Hotel — KEEP, UNAWARE segment.** Reply ratio: 0 of 6
>   visible Google reviews have owner responses. Strong UNAWARE-segment
>   fit — use the education-line-opener variant in the TH draft below
>   (the version that mentions "ลูกค้าใหม่ส่วนใหญ่อ่านรีวิวก่อนจอง และที่
>   หลายคนไม่รู้คือเขาดู 'การตอบกลับของร้าน' ด้วย"). 4.7★, 527 reviews,
>   mostly 5-stars — {PAIN} hook will be hardest here; lean on a
>   specific 4-star or recent guest's name.
> - Remaining 7 (Lilit, Raweekanlaya, Lamphu Tree, Methavalai,
>   Public House, Lamphu House, Nouvo): reply-ratio pass deferred to
>   Earth's browser session — Chrome MCP layout variations made
>   per-prospect data extraction unreliable past 2 prospects.

## Earth's pre-send checklist (per email)

For each draft below, before clicking Send:

1. **Open Google Maps for the property** — count owner-reply ratio
   in last 10 reviews. **DISQUALIFY if ≥ 4/10.** Skip that draft.
2. **Confirm `{N}`** — replace with actual unanswered count from your
   audit dashboard.
3. **Replace `{PAIN}`** — pick ONE specific observation from their
   reviews (a recurring complaint, a guest's name praised, a 1-star
   from last week, a question asked but never answered). The whole
   email rises or falls on this line.
4. **Generate audit URL** via `/outbound-audits` dashboard. Replace
   `{AUDIT_URL}` with the **actual URL string** (verify HTTP 200 via
   `curl -I` if pasting from a screenshot — Chakrabongse typo lesson).
5. **Confirm language call** — TH default is from contextual research
   (Thai-named ownership, Thai operator patterns). Flip to EN if Maps
   reveals 80%+ English reviews. The English variant for each is
   provided as fallback.
6. **Confirm sender:** `earth.reviewhub@gmail.com` (NOT personal Gmail).
   Schedule send for **Tue 5/12 or Wed 5/13, 9-11am ICT**.

**Send rate:** max 10 sends per day from earth.reviewhub@gmail.com per
the audit-outreach skill. 12 prospects = 2 days minimum. Tue + Wed.

**Don't batch all subjects identically** — each subject below is
already varied. Don't normalize them.

---

## #1 — Methavalai Residence Hotel

- **To:** `[OPEN methavalairesidence.com IN BROWSER — TLS cert mismatch blocks WebFetch; email NOT surfaced]`
- **Probable email shapes to look for on contact page:** `info@methavalairesidence.com`, `reservations@methavalairesidence.com`, `mr@methavalairesidence.com`
- **Phone fallback:** +66 2 621 0606
- **Language:** TH (Pranakorn, Thai-positioning, 716 reviews)
- **Hook angle:** 716 reviews × likely-low-reply ratio = high-volume backlog

**Subject (TH):** `Methavalai Residence — รีวิว Google ที่ยังไม่ได้ตอบ`

**Body (TH, AWARE-BUT-LAZY default):**

```
สวัสดีครับ

ผม Earth ทำเครื่องมือชื่อ ReviewHub ครับ ช่วยเจ้าของร้านตอบรีวิว Google ให้เร็วขึ้น

แวะดู Google ของ Methavalai Residence เมื่อกี้ เห็นว่ามีรีวิวเยอะมาก (700+ อัน) แต่ที่ยังไม่ได้ตอบยังมี {N} อัน รวมถึง {PAIN}

เลยลองให้ AI ของเราร่างคำตอบให้ดูครับ พยายามเขียนในโทนที่น่าจะใกล้กับสไตล์ของโรงแรม ลองเปิดดูได้เลย ไม่ต้องสมัครอะไร

→ {AUDIT_URL}

ระบบตอบเป็นภาษาเดียวกับรีวิวอัตโนมัติด้วยครับ รีวิวญี่ปุ่น/เกาหลี/จีน/อังกฤษ ก็ตอบเป็นภาษานั้น เครื่องมืออื่นส่วนใหญ่ทำได้แค่อังกฤษ

อีกอย่างคือ ระบบส่งแจ้งเตือนรีวิวใหม่เข้า LINE ด้วยครับ ไม่ต้องเปิด Google ทุกวันก็รู้ว่ามีรีวิวเข้ามา

คำตอบที่ร่างให้เอาไปใช้ได้เลยฟรีครับ ถ้าอยากให้ระบบทำแบบนี้ทุกครั้งที่มีรีวิวใหม่ มีแพ็กเกจเริ่มต้น $14 (~฿480)/เดือน

ส่งให้ดูเผื่อมีประโยชน์เฉย ๆ ครับ ขอบคุณที่อ่านครับ

— Earth
ReviewHub · reviewhub.review
Bangkok
```

**EN fallback (if Maps reveals predominantly English reviews):**

```
Hi,

Was looking through Methavalai Residence's Google profile and noticed
that out of 700+ reviews, {N} are still unanswered — including {PAIN}.

I drafted reply suggestions for all of them — AI-drafted, but in a
tone that sounded like how you might reply yourself. Take a look (no
signup, just a preview link):

→ {AUDIT_URL}

The drafts auto-detect the reviewer's language too — so the Japanese,
Korean, and Chinese reviews get replies in those languages, not
English. Most review-reply tools only do English.

New reviews also ping you on LINE — no need to check Google daily
to know one came in.

Use any of those drafts directly if you like, on the house. If you
want this running on autopilot every time a new review lands, the
entry plan is $14/mo.

— Earth
ReviewHub · reviewhub.review
Bangkok
```

---

## #2 — Lilit Bang Lamphu Hotel

- **To:** `res@lilithotel.com` (reservations dept; if a contact page reveals a "manager@" or "owner@" address, prefer that)
- **Language:** TH (Banglamphu boutique, Thai owner pattern; flip to EN if 80%+ EN reviews)
- **Hook angle:** 606 reviews + 4.6★ = engaged audience that talks about specific things

**Subject (TH):** `Lilit Bang Lamphu — ลองร่างคำตอบให้ดูครับ`

**Body (TH):**

```
สวัสดีครับ

ผม Earth ทำเครื่องมือชื่อ ReviewHub ครับ ช่วยเจ้าของโรงแรมตอบรีวิว Google ให้เร็วขึ้น

แวะดู Google ของ Lilit Bang Lamphu เมื่อกี้ เห็นว่ายังมีรีวิว {N} อันที่ยังไม่ได้ตอบ รวมถึง {PAIN}

เลยลองให้ AI ของเราร่างคำตอบให้ดูครับ พยายามเขียนในโทนที่น่าจะใกล้กับสไตล์ของโรงแรม ลองเปิดดูได้เลย ไม่ต้องสมัครอะไร

→ {AUDIT_URL}

ระบบตอบเป็นภาษาเดียวกับรีวิวอัตโนมัติด้วยครับ รีวิวญี่ปุ่น/เกาหลี/จีน/อังกฤษ ก็ตอบเป็นภาษานั้น

อีกอย่างคือ ระบบส่งแจ้งเตือนรีวิวใหม่เข้า LINE ด้วยครับ ไม่ต้องเปิด Google ทุกวันก็รู้ว่ามีรีวิวเข้ามา

คำตอบที่ร่างเอาไปใช้ได้เลยฟรีครับ ถ้าอยากให้ระบบทำแบบนี้ทุกครั้งที่มีรีวิวใหม่ มีแพ็กเกจเริ่มต้น $14 (~฿480)/เดือน

ส่งให้ดูเผื่อมีประโยชน์เฉย ๆ ครับ ขอบคุณที่อ่านครับ

— Earth
ReviewHub · reviewhub.review
Bangkok
```

**EN fallback:**

```
Hi,

Was looking through Lilit Bang Lamphu's Google profile and noticed
{N} reviews are unanswered, including {PAIN}.

I drafted reply suggestions for all of them — in a tone that sounded
like how you might reply yourself. Take a look (no signup):

→ {AUDIT_URL}

The drafts auto-detect the reviewer's language too — Japanese, Korean,
Chinese reviews get replies in those languages.

New reviews also ping you on LINE — no need to check Google daily.

Use any of the drafts directly. If you'd like this running on autopilot
when new reviews land, the entry plan is $14/mo.

— Earth
ReviewHub · reviewhub.review
Bangkok
```

---

## #3 — The Raweekanlaya Bangkok Wellness

- **To:** `info@raweekanlaya.com` (preferred over `rsvn@` for owner-routing)
- **Language:** TH (Thai wellness brand, Bangkok-rooted)
- **Hook angle:** Wellness-positioned property — owner cares about brand voice; "in your tone" pitch lands strong here

**Subject (TH):** `Raweekanlaya — ลองร่างคำตอบรีวิวให้ดูครับ`

**Body (TH):**

```
สวัสดีครับ

ผม Earth ทำเครื่องมือชื่อ ReviewHub ครับ ช่วยเจ้าของโรงแรมตอบรีวิว Google ให้เร็วขึ้น

แวะดู Google ของ The Raweekanlaya Wellness เมื่อกี้ เห็นว่ายังมีรีวิว {N} อันที่ยังไม่ได้ตอบ รวมถึง {PAIN}

โดยเฉพาะแบรนด์ที่เน้น wellness/voice แบบนี้ คำตอบรีวิวเป็นจุดที่ลูกค้าใหม่ดูเพื่อเช็คว่าเจ้าของใส่ใจจริงรึเปล่า เลยลองให้ AI ของเราร่างคำตอบให้ดูครับ พยายามเขียนในโทนที่น่าจะใกล้กับสไตล์ของ Raweekanlaya ลองเปิดดูได้เลย ไม่ต้องสมัครอะไร

→ {AUDIT_URL}

ระบบตอบเป็นภาษาเดียวกับรีวิวอัตโนมัติด้วยครับ

อีกอย่างคือ ระบบส่งแจ้งเตือนรีวิวใหม่เข้า LINE ด้วยครับ ไม่ต้องเปิด Google ทุกวันก็รู้ว่ามีรีวิวเข้ามา

คำตอบที่ร่างเอาไปใช้ได้เลยฟรีครับ ถ้าอยากให้ระบบทำแบบนี้ทุกครั้งที่มีรีวิวใหม่ มีแพ็กเกจเริ่มต้น $14 (~฿480)/เดือน

ส่งให้ดูเผื่อมีประโยชน์เฉย ๆ ครับ ขอบคุณที่อ่านครับ

— Earth
ReviewHub · reviewhub.review
Bangkok
```

---

## #4 — Lamphu Tree House

- **To:** `hotel@lamphutreehotel.com`
- **Language:** TH (canal-side antique-teak, Thai owner-decorator pattern)
- **Hook angle:** Owner-decorated property → owner cares about voice. Mention the antique-teak detail in personalization (after Earth confirms reviewers reference it)

**Subject (TH):** `Lamphu Tree House — รีวิว Google ที่ยังไม่ได้ตอบ`

**Body (TH):**

```
สวัสดีครับ

ผม Earth ทำเครื่องมือชื่อ ReviewHub ครับ ช่วยเจ้าของโรงแรมตอบรีวิว Google ให้เร็วขึ้น

แวะดู Google ของ Lamphu Tree House เมื่อกี้ เห็นว่ายังมีรีวิว {N} อันที่ยังไม่ได้ตอบ รวมถึง {PAIN}

ที่พักที่เจ้าของลงรายละเอียดเองแบบนี้ คำตอบรีวิวมีน้ำหนักมากกว่าโรงแรมเชน ลูกค้าใหม่ดูออกเลยว่าใครเป็นคนตอบ เลยลองให้ AI ของเราร่างคำตอบให้ดูครับ พยายามเขียนในโทนที่น่าจะใกล้กับสไตล์ของ Lamphu Tree House ลองเปิดดูได้เลย ไม่ต้องสมัครอะไร

→ {AUDIT_URL}

ระบบตอบเป็นภาษาเดียวกับรีวิวอัตโนมัติด้วยครับ รีวิวญี่ปุ่น/เกาหลี/จีน/อังกฤษ ก็ตอบเป็นภาษานั้น

อีกอย่างคือ ระบบส่งแจ้งเตือนรีวิวใหม่เข้า LINE ด้วยครับ ไม่ต้องเปิด Google ทุกวันก็รู้ว่ามีรีวิวเข้ามา

คำตอบที่ร่างเอาไปใช้ได้เลยฟรีครับ ถ้าอยากให้ระบบทำแบบนี้ทุกครั้งที่มีรีวิวใหม่ มีแพ็กเกจเริ่มต้น $14 (~฿480)/เดือน

ส่งให้ดูเผื่อมีประโยชน์เฉย ๆ ครับ ขอบคุณที่อ่านครับ

— Earth
ReviewHub · reviewhub.review
Bangkok
```

---

## #5 — Lamphu House Bangkok

- **To:** `info@lamphuhousebangkok.com` (corrected from `lamphuhouse.com` — verified 2026-05-08 via Maps that real domain is `lamphuhousebangkok.com`)
- **Language:** TH (Khao San boutique, Thai-script-native owner likely)
- **Hook angle:** Khao San area boutique, smaller property than #4

**Subject (TH):** `Lamphu House — ลองร่างคำตอบรีวิวให้ดูครับ`

**Body (TH):**

```
สวัสดีครับ

ผม Earth ทำเครื่องมือชื่อ ReviewHub ครับ ช่วยเจ้าของโรงแรมตอบรีวิว Google ให้เร็วขึ้น

แวะดู Google ของ Lamphu House เมื่อกี้ เห็นว่ายังมีรีวิว {N} อันที่ยังไม่ได้ตอบ รวมถึง {PAIN}

เลยลองให้ AI ของเราร่างคำตอบให้ดูครับ พยายามเขียนในโทนที่น่าจะใกล้กับสไตล์ของบ้าน ลองเปิดดูได้เลย ไม่ต้องสมัครอะไร

→ {AUDIT_URL}

ระบบตอบเป็นภาษาเดียวกับรีวิวอัตโนมัติด้วยครับ ลูกค้าต่างชาติเขียนภาษาไหน ก็ตอบเป็นภาษานั้น

อีกอย่างคือ ระบบส่งแจ้งเตือนรีวิวใหม่เข้า LINE ด้วยครับ ไม่ต้องเปิด Google ทุกวันก็รู้ว่ามีรีวิวเข้ามา

คำตอบที่ร่างเอาไปใช้ได้เลยฟรีครับ ถ้าอยากให้ระบบทำแบบนี้ทุกครั้งที่มีรีวิวใหม่ มีแพ็กเกจเริ่มต้น $14 (~฿480)/เดือน

ส่งให้ดูเผื่อมีประโยชน์เฉย ๆ ครับ ขอบคุณที่อ่านครับ

— Earth
ReviewHub · reviewhub.review
Bangkok
```

---

## #6 — Baan 2459

- **To:** `baan2459@gmail.com` (Gmail = solo owner-operator signal)
- **Language:** TH (4 rooms, Old Town, solo operator)
- **Hook angle:** Strongest "owner cares about voice" hook. 4 rooms = the owner reads every review. Match Wave 2 Old Capital Bike Inn pattern (small Old Town historic) which opened 1/1.

**Subject (TH):** `Baan 2459 — ลองร่างคำตอบให้ดูครับ`

**Body (TH):**

```
สวัสดีครับ

ผม Earth ทำเครื่องมือชื่อ ReviewHub ครับ ช่วยเจ้าของที่พักตอบรีวิว Google ให้เร็วขึ้น

แวะดู Google ของ Baan 2459 เมื่อกี้ เห็นว่ายังมีรีวิว {N} อันที่ยังไม่ได้ตอบ รวมถึง {PAIN}

ที่พักเล็ก ๆ ที่เจ้าของดูแลเอง คำตอบรีวิวมีน้ำหนักจริง ลูกค้าใหม่ดูออกว่าใครเป็นคนตอบ เลยลองให้ AI ของเราร่างคำตอบให้ดูครับ พยายามเขียนในโทนที่ใกล้กับเจ้าของบ้าน ไม่ใช่โทนโรงแรมเชน ลองเปิดดูได้เลย ไม่ต้องสมัครอะไร

→ {AUDIT_URL}

ระบบตอบเป็นภาษาเดียวกับรีวิวอัตโนมัติด้วยครับ รีวิวญี่ปุ่น/เกาหลี/จีน/อังกฤษ ก็ตอบเป็นภาษานั้น

คำตอบที่ร่างเอาไปใช้ได้เลยฟรีครับ ถ้าอยากให้ระบบทำแบบนี้ทุกครั้งที่มีรีวิวใหม่ มีแพ็กเกจเริ่มต้น $14 (~฿480)/เดือน

ส่งให้ดูเผื่อมีประโยชน์เฉย ๆ ครับ ขอบคุณที่อ่านครับ

— Earth
ReviewHub · reviewhub.review
Bangkok
```

---

## #7 — Nouvo City Hotel

- **To:** `info@nouvocityhotel.com`
- **Language:** EN (halal-certified positioning = international Muslim-traveler audience; reviews likely majority English/Arabic/Indian languages)
- **Hook angle:** Halal/Indian-restaurant niche → reviews come from a defined international audience. Multilingual reply pitch is uniquely strong here.

**Subject (EN):** `Nouvo City Hotel — reply drafts for your unanswered reviews`

**Body (EN):**

```
Hi,

Was looking through Nouvo City Hotel's Google profile and noticed
{N} reviews are unanswered, including {PAIN}.

I drafted reply suggestions for all of them — AI-drafted, but in a
tone that sounded like how you might reply yourself. Take a look (no
signup, just a preview link):

→ {AUDIT_URL}

One thing that might be relevant for Nouvo specifically — given the
halal-certified positioning, your reviews probably come in 5+
languages. The drafts auto-detect the reviewer's language, so the
Arabic, Hindi, Urdu reviews get replies in those languages. Most
review-reply tools only do English.

New reviews also ping you on LINE — no need to check Google daily
to know one came in.

Use any of the drafts directly. If you want this running on autopilot
every time a new review lands, the entry plan is $14/mo.

— Earth
ReviewHub · reviewhub.review
Bangkok
```

---

## #8 — Public House Hotel Sukhumvit

- **To:** `info@publichouse-hotels.com`
- **Owner:** Paul + Angie Sachdev (family-owned)
- **Language:** EN (Sachdev family — international owners, design-hotel member, English-positioning)
- **Hook angle:** Owner-as-face property; voice matters; 78 rooms is mid-size for boutique

**Subject (EN):** `Public House — quick observation on your Google reviews`

**Body (EN):**

```
Hi Paul,

Was looking through Public House's Google profile and noticed {N}
reviews are unanswered, including {PAIN}.

I drafted reply suggestions for all of them — AI-drafted, but in a
tone that tries to match how a design-hotel owner would actually
reply, not the corporate template most chains use. Take a look (no
signup, just a preview link):

→ {AUDIT_URL}

The drafts also auto-detect the reviewer's language — Japanese,
Korean, Chinese reviews get replies in those languages, not English.

New reviews also ping you on LINE — no need to check Google daily
to know one came in.

Use any directly if useful. If you want this running on autopilot
every time a new review lands, the entry plan is $14/mo.

— Earth
ReviewHub · reviewhub.review
Bangkok
```

**Note for Earth:** if you're not sure Paul is the right addressee (vs Angie or a hotel manager), drop the name and use just "Hi,". Wrong name beats no name.

---

## #9 — Volve Hotel Bangkok

- **To:** `hello@volvehotel.com`
- **Owner:** Thai owner referenced as "Khun Um" in press (per WebFetch 2026-05-08); previous note saying Pitiphat Chongsomchit was owner was wrong — he's the interior designer.
- **Language:** TH (Thai owner-curator)
- **Hook angle:** "Neighbourhood design hotel" — owner-curator framing in their press → voice matters strongly

**Subject (TH):** `Volve Hotel — ลองร่างคำตอบให้ดูครับ`

**Body (TH):**

```
สวัสดีครับ

ผม Earth ทำเครื่องมือชื่อ ReviewHub ครับ ช่วยเจ้าของโรงแรมตอบรีวิว Google ให้เร็วขึ้น

แวะดู Google ของ Volve Hotel เมื่อกี้ เห็นว่ายังมีรีวิว {N} อันที่ยังไม่ได้ตอบ รวมถึง {PAIN}

โรงแรมแบบ neighbourhood design hotel ที่เจ้าของลงทุนกับตัวตนของแบรนด์แบบนี้ คำตอบรีวิวเป็นจุดที่ลูกค้าใหม่ดูเพื่อเช็คโทนของโรงแรม เลยลองให้ AI ของเราร่างคำตอบให้ดูครับ พยายามเขียนในโทนที่น่าจะใกล้กับสไตล์ของ Volve ไม่ใช่โทนโรงแรมเชน ลองเปิดดูได้เลย ไม่ต้องสมัครอะไร

→ {AUDIT_URL}

ระบบตอบเป็นภาษาเดียวกับรีวิวอัตโนมัติด้วยครับ รีวิวญี่ปุ่น/เกาหลี/จีน/อังกฤษ ก็ตอบเป็นภาษานั้น

อีกอย่างคือ ระบบส่งแจ้งเตือนรีวิวใหม่เข้า LINE ด้วยครับ ไม่ต้องเปิด Google ทุกวันก็รู้ว่ามีรีวิวเข้ามา

คำตอบที่ร่างเอาไปใช้ได้เลยฟรีครับ ถ้าอยากให้ระบบทำแบบนี้ทุกครั้งที่มีรีวิวใหม่ มีแพ็กเกจเริ่มต้น $14 (~฿480)/เดือน

ส่งให้ดูเผื่อมีประโยชน์เฉย ๆ ครับ ขอบคุณที่อ่านครับ

— Earth
ReviewHub · reviewhub.review
Bangkok
```

---

## #10 — IR-ON Hotel Sukhumvit

- **To:** `info@ir-onhotel.com` (surfaced via WebFetch 2026-05-08)
- **Language:** TH (Thai steel-industry family background per existing note; 22 rooms)
- **Hook angle:** Industrial-design hotel ("IR-ON" = iron-themed); Thai family business

**Subject (TH):** `IR-ON Hotel — ลองร่างคำตอบรีวิวให้ดูครับ`

**Body (TH):**

```
สวัสดีครับ

ผม Earth ทำเครื่องมือชื่อ ReviewHub ครับ ช่วยเจ้าของโรงแรมตอบรีวิว Google ให้เร็วขึ้น

แวะดู Google ของ IR-ON Hotel เมื่อกี้ เห็นว่ายังมีรีวิว {N} อันที่ยังไม่ได้ตอบ รวมถึง {PAIN}

โรงแรมที่ดีไซน์มีตัวตนชัดแบบนี้ คำตอบรีวิวเป็นส่วนที่ลูกค้าใหม่ดูเพื่อเช็คว่าเจ้าของใส่ใจจริงรึเปล่า เลยลองให้ AI ของเราร่างคำตอบให้ดูครับ พยายามเขียนในโทนที่น่าจะใกล้กับสไตล์ของ IR-ON ไม่ใช่โทนโรงแรมเชน ลองเปิดดูได้เลย ไม่ต้องสมัครอะไร

→ {AUDIT_URL}

ระบบตอบเป็นภาษาเดียวกับรีวิวอัตโนมัติด้วยครับ

คำตอบที่ร่างเอาไปใช้ได้เลยฟรีครับ ถ้าอยากให้ระบบทำแบบนี้ทุกครั้งที่มีรีวิวใหม่ มีแพ็กเกจเริ่มต้น $14 (~฿480)/เดือน

ส่งให้ดูเผื่อมีประโยชน์เฉย ๆ ครับ ขอบคุณที่อ่านครับ

— Earth
ReviewHub · reviewhub.review
Bangkok
```

---

## #11 — Bangkok Voyage Boutique

- **To:** `Voyagearthostel@gmail.com` (preserve capitalization as documented)
- **Language:** TH (Ari residential area — Thai-local-leaning audience; smallest at 7 rooms)
- **Hook angle:** Smallest of the cohort; Ari = local Thai neighborhood, not tourist zone

**Subject (TH):** `Bangkok Voyage — ลองร่างคำตอบรีวิวให้ดูครับ`

**Body (TH):**

```
สวัสดีครับ

ผม Earth ทำเครื่องมือชื่อ ReviewHub ครับ ช่วยเจ้าของที่พักตอบรีวิว Google ให้เร็วขึ้น

แวะดู Google ของ Bangkok Voyage Boutique เมื่อกี้ เห็นว่ายังมีรีวิว {N} อันที่ยังไม่ได้ตอบ รวมถึง {PAIN}

ที่พักเล็กในย่านอารีย์ที่เจ้าของดูแลเอง คำตอบรีวิวมีน้ำหนักจริง ลูกค้าใหม่อ่านออกว่าใครเป็นคนตอบ เลยลองให้ AI ของเราร่างคำตอบให้ดูครับ พยายามเขียนในโทนที่ใกล้กับเจ้าของบ้าน ลองเปิดดูได้เลย ไม่ต้องสมัครอะไร

→ {AUDIT_URL}

ระบบตอบเป็นภาษาเดียวกับรีวิวอัตโนมัติด้วยครับ

คำตอบที่ร่างเอาไปใช้ได้เลยฟรีครับ ถ้าอยากให้ระบบทำแบบนี้ทุกครั้งที่มีรีวิวใหม่ มีแพ็กเกจเริ่มต้น $14 (~฿480)/เดือน

ส่งให้ดูเผื่อมีประโยชน์เฉย ๆ ครับ ขอบคุณที่อ่านครับ

— Earth
ReviewHub · reviewhub.review
Bangkok
```

---

## #12 — Baan Vajra Silom

- **To:** `baanvajra@gmail.com` (Gmail = solo owner-operator)
- **Language:** TH (default; flip to EN if Silom business-traveler reviews skew English ≥ 80%)
- **Hook angle:** Silom area = mixed Thai-business + international travelers. Gmail address signals solo owner-run.

**Subject (TH):** `Baan Vajra Silom — รีวิว Google ที่ยังไม่ได้ตอบ`

**Body (TH):**

```
สวัสดีครับ

ผม Earth ทำเครื่องมือชื่อ ReviewHub ครับ ช่วยเจ้าของที่พักตอบรีวิว Google ให้เร็วขึ้น

แวะดู Google ของ Baan Vajra Silom เมื่อกี้ เห็นว่ายังมีรีวิว {N} อันที่ยังไม่ได้ตอบ รวมถึง {PAIN}

ที่พักเล็ก ๆ ที่เจ้าของดูแลเอง คำตอบรีวิวมีน้ำหนักจริง ลูกค้าใหม่ดูออกว่าใครเป็นคนตอบ เลยลองให้ AI ของเราร่างคำตอบให้ดูครับ พยายามเขียนในโทนที่ใกล้กับเจ้าของบ้าน ไม่ใช่โทนโรงแรมเชน ลองเปิดดูได้เลย ไม่ต้องสมัครอะไร

→ {AUDIT_URL}

ระบบตอบเป็นภาษาเดียวกับรีวิวอัตโนมัติด้วยครับ รีวิวญี่ปุ่น/เกาหลี/จีน/อังกฤษ ก็ตอบเป็นภาษานั้น

คำตอบที่ร่างเอาไปใช้ได้เลยฟรีครับ ถ้าอยากให้ระบบทำแบบนี้ทุกครั้งที่มีรีวิวใหม่ มีแพ็กเกจเริ่มต้น $14 (~฿480)/เดือน

ส่งให้ดูเผื่อมีประโยชน์เฉย ๆ ครับ ขอบคุณที่อ่านครับ

— Earth
ReviewHub · reviewhub.review
Bangkok
```

**EN fallback (if Silom prospect reviews skew English):**

```
Hi,

Was looking through Baan Vajra Silom's Google profile and noticed
{N} reviews are unanswered, including {PAIN}.

Drafted reply suggestions for all of them — AI-drafted, in a tone
that sounded like how an owner-run small property would actually
reply, not corporate-chain copy. Take a look (no signup):

→ {AUDIT_URL}

The drafts auto-detect the reviewer's language too — so non-English
reviews get replies in their own language.

Use any directly if useful. If you'd like this running on autopilot
when new reviews land, the entry plan is $14/mo.

— Earth
ReviewHub · reviewhub.review
Bangkok
```

---

## Summary — at-a-glance

| # | Property | Email | Lang | Send day |
|---|---|---|---|---|
| 1 | Methavalai Residence | **needs browser lookup** | TH | Tue 5/12 or Wed 5/13 |
| 2 | Lilit Bang Lamphu | res@lilithotel.com | TH | Tue 5/12 |
| 3 | Raweekanlaya Wellness | info@raweekanlaya.com | TH | Tue 5/12 |
| 4 | Lamphu Tree House | hotel@lamphutreehotel.com | TH | Tue 5/12 |
| 5 | Lamphu House | info@lamphuhouse.com | TH | Tue 5/12 |
| 6 | Baan 2459 | baan2459@gmail.com | TH | Tue 5/12 |
| 7 | Nouvo City Hotel | info@nouvocityhotel.com | EN | Wed 5/13 |
| 8 | Public House Hotel | info@publichouse-hotels.com | EN | Wed 5/13 |
| 9 | Volve Hotel | hello@volvehotel.com | TH | Wed 5/13 |
| 10 | IR-ON Hotel | info@ir-onhotel.com | TH | Wed 5/13 |
| 11 | Bangkok Voyage | Voyagearthostel@gmail.com | TH | Wed 5/13 |
| 12 | Baan Vajra Silom | baanvajra@gmail.com | TH | Wed 5/13 |

**Tue:** 6 sends (within 10/day Gmail cap). **Wed:** 6 sends. Aim 9–11am ICT both days.

If any of the 12 disqualify on Earth's Maps eyeball pass (≥4/10 owner-reply ratio), drop them and the wave is smaller — that's fine. Better 7 high-fit prospects than 12 mixed.
