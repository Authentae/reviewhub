# Overnight queue — 2026-05-20

Earth is asleep. Cron fires every 20 min and executes the next `[ ]` item.

**Rules:**
- Execute items in order — do NOT skip or pick favorites
- Do NOT invent new items beyond this list (lesson from 2026-05-19 polish-clustering)
- Mark `[done]` immediately after commit + push succeeds
- If an item fails twice, mark `[blocked: <reason>]` and continue to the next
- STOP completely if CI goes red after a push
- When all items are `[done]` OR `[blocked]`: write status to item 14, then exit (do not reschedule)
- One commit per item, 2-line message ending with `Co-Authored-By: Claude Opus 4.7`
- $0 budget. No directory submissions. No emails sent. No Gmail / billing / JWT_SECRET / DB migrations / audit-preview copy.
- Apply the procedural check from `feedback_active_wave_is_not_product_scope.md` BEFORE writing any user-facing copy: is this segment-narrowing? If yes, fix the framing.

---

## Queue

- [done] **1. `/trust` page** — shipped (commit eda4436). React page + route + footer link under Company. Two-things-we-access, four-things-we-don't, data policy, 6 sub-processors named, deletion path. Build green.

- [done] **2. `/integrations` page** — shipped (commit 9e591e1). Lists Google BP API + Places fallback, CSV import (~20 confirmed, honest about Google-only auto-polling per honesty-lint rule), email-forward, LINE OA, Telegram, WhatsApp roadmap, email digest, Anthropic Claude drafts in 10 languages. Footer link under Product. Pre-commit caught "60+ platforms" as banned phrase on first push — rephrased to be honest about auto-polling vs CSV path.

- [done] **3. `llm.txt`** — shipped (commit 356f222). Markdown site summary at /llm.txt per llmstxt.org convention. Lists key pages, comparison pages, vertical pages, free tools, blog highlights, sub-processors, contact. Also added `LLM-content:` pointer in robots.txt so crawlers can discover it. 12-month early-mover edge for AI-search citations (ChatGPT/Claude/Perplexity/Gemini).

- [done] **4. Pillar + cluster content map** — shipped (commit 85cbdc8). Proposes 5 segment-agnostic pillars (reply mechanics, negative reviews, acquisition+tracking, AI replies, multilingual+multi-platform), maps all 17 existing topics, lists 14 gap-cluster posts to write, sketches internal-linking + restructure plan. Caught a Bangkok-narrowing draft of Pillar 5 in re-read; reframed to "multilingual & multi-platform" before commit. Earth's approval needed on the pillar choices.

- [done] **5. Strategic conversation summary** — shipped (commit 6100bda). 5-min morning briefing: active-wave-vs-product-scope meta-rule, product's actual scope (global / 10 languages / multi-channel), $0 phased plan with triggers (Phase 0 free data → Phase 4 $5k MRR), 5-D segment grid, what we're NOT doing yet, 5 open decisions for Earth.

- [done] **6. Wiki update** — shipped (commit ceab803). New "Strategic decisions 2026-05-20" section at top of wiki (right after Canonical handles): global scope vs Bangkok outreach segment, 3-file memory chain enforcing active-wave-vs-product-scope, $0 phased plan with triggers, deferred dependency upgrades, pointers to new docs + site pages. Future sessions read this before anything else.

- [done] **7. `/why-us` page** — shipped (commit ccdafed). 5 beliefs: ChatGPT-paste doesn't scale, voice consistency matters, privacy is a feature, ambient triggers beat dashboards, small is right for this. First-person plural — no founder names per Earth's preference. Linked from footer Company section (top of group, next to /support). Build green.

- [done] **8. Newsletter signup widget** — shipped (commit db46f7d). new newsletter_signups table (UNIQUE on email), POST /api/newsletter with honeypot + rate-limit + 9 server tests (all green), NewsletterSignup component in panel + inline variants, wired into Landing (panel above footer) + BlogIndex (inline above footer). Static blog HTML pages NOT updated this cycle — that requires per-file HTML edits across 33 posts which would compete with other queue items; revisit later via a script.

- [done] **9. MarketingFooter refresh** — shipped (commit 0df41df). All 4 groups now at exactly 8 links. Product: dropped redundant Home (wordmark links it), added /audit-demo (highest-leverage conversion surface, previously buried), dropped one tool to fit cap. Resources: dropped Bangkok-hospitality featured-link (segment-narrowing per tonight's strategic doc; post still at /blog). Company: added /about alongside /why-us, dropped /legal/th-summary (linked from /terms anyway). Comment header updated to reflect new structure + cap rule.

- [ ] **10. Schema.org Organization + WebSite + SearchAction markup** in `client/index.html`. `Organization` with our name, URL, logo, sameAs links to X handles. `WebSite` with potentialAction `SearchAction` so Google can show a sitelinks searchbox for "reviewhub" queries. Validate with Google Rich Results Test before committing.

- [ ] **11. `security.txt`** at `client/public/.well-known/security.txt` per RFC 9116. Contact: security@reviewhub.review, expires field, preferred-languages, canonical URL. Plus a PGP key placeholder (note in commit message: actual PGP key when Earth wants to set one up).

- [ ] **12. OG meta audit for non-blog marketing pages** — check Landing, Pricing, /audit, /audit-demo, /guide, /changelog, /support, /about, /for-spas, /for-dentists, /vs/chatgpt, /vs/birdeye. Use `useSocialMeta` hook to ensure every page sets og:title / og:description / og:image / og:type / twitter:card / twitter:image. The og:image should be `/og-image.png` (homepage), `/og-image-audit.png` (audit pages), or `/og-image-blog.png` (blog). Per-page og:title and og:description should match the page's purpose. Document any pages missing meta in the status report.

- [ ] **13. Server tests** for `/api/health` and `/api/admin/waitlist-stats`. Both endpoints shipped recently (cycles 31, 39) without direct test coverage. Test: `/api/health` returns expected shape with components bag; `/api/admin/waitlist-stats` requires admin auth and returns the by_plan structure with `last_30d`, `total`, `latest_at` per plan.

- [ ] **14. Final status report** at `docs/overnight-status-2026-05-20.md`. Lists every item that shipped (with commit hash), every blocker hit, and 3 recommendations for what Earth should look at first when he wakes (with file links). Marks itself `[done]`. Cron's prompt should detect this and exit.

---

## Reminders for the cron's execution agent

- The `feedback_active_wave_is_not_product_scope.md` rule says: before writing any user-facing copy, check whether you're narrowing the product to Bangkok or hospitality. If yes, rewrite to be segment-agnostic.
- The product is **global**. Ships 10 language packs. Has Telegram (global) alongside LINE (Asia). WhatsApp is on the roadmap. CSV import works for 60+ non-Thai platforms. **Default scope: global**. Restrict to Bangkok/hospitality only when explicitly discussing today's outreach pipeline.
- Use the brand tokens: `--rh-paper`, `--rh-ink`, `--rh-teal`, `--rh-rose`, `--rh-sage`, `--rh-ochre`. Typography: Instrument Serif (headings), Inter (body), JetBrains Mono (eyebrows).
- Run pre-commit hooks. Don't `--no-verify` unless absolutely necessary.
- Commit message format: 2-line, ends with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
