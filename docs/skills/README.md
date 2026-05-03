# Skills — playbook docs for non-code work

Reference docs for the non-engineering work that comes with running
ReviewHub: support replies, cold outreach, onboarding emails. Each file
is a self-contained playbook.

## How to use these

1. **Pick the playbook** for what you're trying to do (support reply?
   cold outreach? welcome email?)
2. **Open Claude** (any surface — the chat at claude.ai, Claude Code,
   Cowork, whatever)
3. **Paste the entire playbook file** as your first message
4. **Then ask** the specific thing — e.g. "draft a reply to this email:
   [paste customer email]" or "draft a LINE intro for a cafe in Chiang Mai"

Claude reads the playbook, internalizes the voice + product facts +
rules, and produces output that sounds like ReviewHub instead of generic
SaaS copy.

## Files

| File | When to use |
|---|---|
| [`onboarding-email.md`](onboarding-email.md) | Drafting any of the post-signup nudge emails |
| [`support-response.md`](support-response.md) | Replying to a customer email, chat, or LINE message |
| [`thai-smb-outreach.md`](thai-smb-outreach.md) | Writing cold LINE / Facebook DM / email to a Thai SMB |
| [`lead-finding.md`](lead-finding.md) | Finding qualified outbound prospects (city + vertical → ranked list) |
| [`audit-outreach.md`](audit-outreach.md) | The DM script for sending an outbound audit URL to a prospect (paired with the /outbound-audits dashboard tool) |
| [`ship-readiness-audit.md`](ship-readiness-audit.md) | Engineering checklist after shipping any feature touching pricing / schema / i18n / public pages / plan gates |

## When to update these

- **Pricing changes**: update `support-response.md` immediately. Stale
  pricing in support replies = legal exposure.
- **New platform shipped**: add to the platform list in `support-response.md`
- **New refund/cancellation policy**: update `support-response.md`
- **Voice drift** (you read a message and think "that doesn't sound
  like me anymore"): re-read all three; tighten the DO/DON'T lists.

These are the only marketing/support/outreach playbooks worth maintaining.
Don't write a 10th one — pick a fight with the existing 3 if you find
yourself reaching for it.
