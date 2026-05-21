# Wave 5 result-harvest — 2026-05-24 Earth checklist

Read this on **Sunday 2026-05-24 around 9-10 AM Bangkok.** 15-min task.
You don't need to think — just follow the steps. The thinking is
pre-committed in `docs/wave-postmortems/wave-5-outcomes-tree.md`.

---

## Step 1 — Pull the data (3 min)

Open Chrome (signed in to reviewhub.review as admin), navigate to:

```
https://reviewhub.review/api/admin/outreach-stats
```

Right-click → Save As → `tmp/outreach-stats-2026-05-24.json` inside
the App folder. (Or just View Source → Ctrl+A → Ctrl+C → paste into a
new file.)

---

## Step 2 — Confirm Wave 5 manifest matches reality (2 min)

Open `docs/outreach/wave-5-manifest.json`. The two dental rows are
TBD placeholders — replace `"TBD — verified Dental #1"` and `"TBD —
verified Dental #2"` with the actual business names you sent to.

Save the file. (If you didn't send to any dental prospects, delete
those two rows AND change `expected_total` from 14 to 12.)

---

## Step 3 — Run the diagnostic (10 sec)

In the App folder terminal:

```bash
node scripts/wave-diagnostic.mjs --wave=5 --stats=tmp/outreach-stats-2026-05-24.json
```

You'll see a markdown report. The bottom of the report has a
**"Recommended action"** section keyed to the result shape.

The report is also archived to `tmp/wave-diagnostic/wave-5-<timestamp>.md`.

---

## Step 4 — Match the result to the outcome branch (1 min)

Open `docs/wave-postmortems/wave-5-outcomes-tree.md` and find the
matching outcome:

| If the report shows… | Go to outcome… |
|---|---|
| Replied count ≥ 1 (any vertical) | **A** — first-customer playbook |
| ≥40% opens, 0 replies (any vertical with sends) | **B** — followups + audit-preview rewrite |
| <30% opens in 2+ verticals | **C** — deliverability check |
| 1 reply but it's "not interested" | **D** — multiple-choice followup |
| 1 reply asking for a call | **E** — schedule within 24h |
| 0 prospects matched (diagnostic shows 14 unsent) | **F** — manifest mismatch, fix and rerun |

---

## Step 5 — Execute the branch's "What to do" list (10-30 min)

The outcome doc has specific steps per branch. Don't deviate without a
reason. The point of pre-committing branches is to remove decision
fatigue at harvest time.

For Outcome B (most likely, given 5 prior waves of opens-no-reply):

1. Open `docs/wave-postmortems/wave-5-followup-template.md`
2. For each "Followup candidate" in the diagnostic output:
   - Pick the matching vertical's template
   - Reply to the original thread in Gmail
   - Send Tue 2026-05-26 9-11 AM or Wed 5-27 9-11 AM
3. Mark each follow-up sent in `docs/wave-postmortems/wave-5-follow-up-log.md`
   (create if not exists)

---

## Step 6 — Update the wiki (3 min)

In `docs/reviewhub-wiki.md`, append a dated line under "Outreach waves":

```
- 2026-05-24: Wave 5 result-harvested. {sent}/{14} reached prospects.
  {opens}/{sent} opened audit URL ({open_rate}%). {replies}/{sent}
  replied ({reply_rate}%). Outcome branch: {A/B/C/D/E/F}.
  Per-vertical winner: {vertical or "no clear signal"}.
```

This becomes the input for Wave 6 prep.

---

## Step 7 — Don't immediately ship Wave 6 (mental note)

Wave 6 prep is NOT part of this checklist. After completing the
outcome branch:

- If Outcome A/E → run first-customer playbook, don't prep Wave 6 yet
- If Outcome B → ship audit-preview CTA A/B variants first, THEN Wave 6
- If Outcome C → fix deliverability first, THEN Wave 6
- If Outcome D → record the objection, may still ship Wave 6 with the
  objection-addressed copy

Default if uncertain: **wait 5 more days** to see if any late replies
arrive. Wave 6 cost is the same whether sent Mon or Fri; the data
from Wave 5 stays fresh.

---

## What if nothing in this checklist matches what I see?

Open Claude session, paste the diagnostic output, ask:

> *"Wave 5 result-harvest. Diagnostic output above. Outcomes tree says X
> but the actual shape is Y. What's the right move?"*

The framework's "Stop and ask" exists for ambiguous shapes. Don't
force a branch that doesn't fit — the wrong branch costs more than a
fresh think.

---

## Files this checklist references

- `docs/outreach/wave-5-manifest.json` — the 14-prospect roster
- `scripts/wave-diagnostic.mjs` — the diagnostic CLI
- `docs/wave-postmortems/wave-5-outcomes-tree.md` — pre-committed
  branches
- `docs/wave-postmortems/wave-5-followup-template.md` — vertical-specific
  +7-day follow-up templates
- `docs/skills/first-customer-playbook.md` — if it exists, run on
  Outcome A; otherwise the agent has an inline first-customer playbook
  embedded in wave-5-outcomes-tree.md Outcome A.

---

## What this checklist is NOT

- **Not a substitute for reading the actual replies.** If a prospect
  replies with anything other than the canned shapes above, READ what
  they wrote and respond as a human. The checklist handles the silence
  case; replies need attention.
- **Not exhaustive.** Edge cases will appear. Default: pause, paste
  into Claude, ask.
