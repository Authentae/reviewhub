# How to read the audit-preview CTA A/B (control vs Variant E)

Ship date: 2026-05-14 (commit `29b9780`).
Variants live: `control` (existing copy) and `E` ("permission-asking").

## When to read

**Minimum N:** 20 audits sent (~10 per arm assuming the token-hash split
holds even). Wave 4 contributed 7 yesterday; Wave 5 (~8-12 sends) should
push the cohort past 20 by ~5/24.

**Don't read sooner.** Below 10 viewers per arm, click-rate deltas are
noise. If you check Plausible at 5 audits and see 1 control click vs 0
variant clicks, that's not signal — it's coin-flip.

## Where to read

Plausible dashboard → Goals (or Events) panel. Two custom events to watch:

- **`AuditRegisterClick`** — control arm clicks
- **`AuditRegisterClick_PermissionV`** — Variant E arm clicks

Pageviews for `/audit-preview/*` are the denominators (one per audit
view; bot-filtered).

## The actual calculation

For each arm:

```
click_rate = (event count) / (audit-preview pageviews assigned to this arm)
```

You can't get the per-arm denominator directly from Plausible without
adding more event-props, so do this approximation:

```
total audit-preview views = (sum of /audit-preview/* pageviews from May 13 onwards)
assume 50/50 split → per-arm views ≈ total / 2
control_rate ≈ AuditRegisterClick / (total/2)
variant_rate ≈ AuditRegisterClick_PermissionV / (total/2)
```

The 50/50 assumption is fine because the assignment function is
deterministic on token (and tokens are uniformly distributed by their
hex encoding). If you want to verify, run:

```bash
node -e "
const tokens = [/* paste actual share_tokens from server/data/reviews.db */];
function assign(t){let h=0;for(let i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))|0;return Math.abs(h)%2===0?'control':'E'}
const counts = tokens.reduce((a,t)=>{a[assign(t)]=(a[assign(t)]||0)+1;return a},{});
console.log(counts);
"
```

## Reading the result

After 20+ audits sent (≥10 per arm):

| Result | Interpretation | Next action |
|---|---|---|
| **Both arms ≥ 5% click rate, delta < 2%** | CTA copy doesn't matter much. Email body is doing the work, audit-preview is doing its job. | Keep control (simpler). Move focus to scaling outreach volume. |
| **Variant E ≥ 5% higher than control** | Hypothesis confirmed. Permission-asking framing converts better. | Ship Variant E to 100%. Steal "drafts above stay yours" wording for cold-email body too. |
| **Control ≥ 5% higher than Variant E** | Imperative buy verb beats softer framing. Surprising; investigate via 1 cust-dev call ("which CTA did you click?") | Keep control. Re-test once you have more N. |
| **Both arms at 0% click rate** | CTA isn't the bottleneck. Email body is overpromising or audience is wrong. | Drop CTA work. Rewrite cold-email body, or pivot audience. The `2026-05-13-deliverability-confirmed.md` doc pre-registers branches for this. |
| **Both arms 1-3% (mixed weak signal)** | Real but weak demand. Right shape, wrong call-to-action. | Test Variant B (autopilot framing) or Variant C (time-saved framing) next. Don't kill the channel yet. |

## Anti-patterns to avoid

- **Reading at N < 10 per arm.** Noise, not signal. Resist the urge.
- **Stopping the test early because one arm "looks better."** Stop only at the pre-registered N (20).
- **Adding a third variant before reading the first A/B.** Pick one fight at a time. If you're tempted, write the third variant to disk but don't ship it.
- **Re-deriving variant assignment.** The function in `AuditPreview.jsx`
  (`assignCtaVariant`) is the source of truth. Don't change the hash
  algorithm mid-test or you invalidate the assignment of prospects who
  already saw a variant.

## When to ship the winning variant 100%

Once you have ≥10 per arm AND a ≥5% delta AND statistical confidence
that's not just "this run":

1. Hardcode the winning copy as the only CTA in `AuditPreview.jsx`
2. Remove `assignCtaVariant` and the variant branches
3. Keep only one Plausible event name
4. Update `docs/audit-preview-cta-variants.md` to mark the winner

If the winning CTA copy hints at a winning *cold-email* body shape, also
update `docs/skills/audit-outreach.md` and re-test on Wave 6.

## Edge cases worth knowing

- **Mobile vs desktop differences.** Plausible can segment by device.
  If Variant E wins on mobile but not desktop (or vice versa), that's
  a real signal — most prospects open from phones, so weight mobile.
- **TH vs EN audiences.** Cold-email language was 4 TH / 3 EN in Wave 4.
  If you can tag the audit-preview pageview with the prospect's likely
  language (a request that would need code change), the read-out gets
  sharper.
- **Same prospect, multiple views.** Plausible deduplicates by IP+UA,
  so 14 Chakrabongse views from the same browser only count as ~1
  unique view (correct behavior for this analysis).

## Related

- `docs/audit-preview-cta-variants.md` — original 4-variant spec
- `docs/wave-postmortems/wave-1-2-3-combined-diagnostic.md` — the 0-reply data this experiment was designed to interrogate
- `docs/wave-postmortems/2026-05-13-deliverability-confirmed.md` — why CTA, not deliverability, is the question
- `client/src/pages/AuditPreview.jsx` — `assignCtaVariant()` is the source of truth for the split
