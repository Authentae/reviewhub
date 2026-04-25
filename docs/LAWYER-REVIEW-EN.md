# Lawyer Review Briefing — ReviewHub

This is the English companion to `LAWYER-REVIEW-TH.md`. The Thai version is the one your lawyer will actually read. This one is for **you**, so you know what you're asking him to review and can follow his answers.

---

## The framing

You're handing your lawyer 4 legal documents (Terms, Privacy, AUP, Refund) that were drafted using international SaaS patterns. Those patterns are strong defaults in the US/EU but **Thai law has specifics that might override them.**

You're not asking him to write new Terms. You're asking him to answer: *"Will these documents actually protect me in Thailand, or are parts of them decorative?"*

That question takes ~30 minutes to answer for someone who knows Thai consumer law. It's the cheapest insurance you can buy.

---

## The 10 questions (what you're asking, in English)

### 1. Liability cap enforceable under Thai Consumer Protection Act?

My Terms §7 caps my liability at "12 months of fees paid or $100, whichever is greater." **Thai Consumer Protection Act §11-12 declares unfair contract clauses void.** If a Thai consumer sues you for a big loss, the Thai court might just ignore your cap.

**What you want to hear:** "Yes, the cap is enforceable for B2B. For B2C, ท่านควรเพิ่มข้อความว่า..." (or similar — they tell you what to add).

### 2. Mandatory arbitration + class-action waiver enforceable?

Terms §10 forces all disputes into individual arbitration and bans class actions. This is US-standard and rock-solid there. **Thailand is different** — Thai consumer courts have historically been skeptical of mandatory-arbitration clauses imposed on individual consumers.

**What you want to hear:** Either "yes, it's enforceable in Thailand if you use a recognised arbitration body" OR "for Thai consumers this is decoration — plan on your cases being heard in Thai courts."

### 3. PDPA compliance — is the Privacy Policy actually legal in Thailand?

I wrote the Privacy Policy to cover GDPR + CCPA + PDPA simultaneously. PDPA has quirks: explicit opt-in consent for specific purposes, 72-hour breach notification, data-subject-rights processes. The ask: does my doc actually satisfy **Thai** requirements, not just the English ones?

Special sub-question: **does my size of operation require appointing a DPO (Data Protection Officer)?** PDPA Section 41 has thresholds that might require this.

### 4. Do the Terms need to be in Thai to bind Thai customers?

Some Thai consumer-protection rulings have held that contracts targeting Thai customers are only enforceable in Thai. If that's the case here, your English-only Terms might not bind a Thai customer at all.

**What you want to hear:** Either "English is fine for B2B Thai customers" OR "you need a Thai version of at least the Privacy Policy and key Terms clauses before taking Thai customers."

### 5. Governing law clause — how should it read?

Terms §11 says "governed by the jurisdiction of ReviewHub's incorporation (TBD)." Since you're an individual in Thailand, you need this filled in properly. Options:
- "Thailand, Bangkok courts" (simplest, aligns with your operator location)
- Some founders pick Singapore or a neutral third country for international SaaS

**What you want to hear:** A clear recommendation based on your customer mix.

### 6. Thai consumer refund rights — does my Refund Policy satisfy them?

My Refund Policy: 30-day money-back on first paid month, no pro-rata thereafter. Does Thai consumer law give customers mandatory minimums beyond that?

### 7. Operating as an individual (no company) — any specific Thai legal requirements?

You're an individual operator for now. Ask specifically:
- Should I register as an e-commerce merchant with DBD (กรมพัฒนาธุรกิจการค้า)?
- At what revenue do I need to register for VAT? (The 1.8M THB/year threshold — does LemonSqueezy being Merchant of Record change this?)
- How does LemonSqueezy revenue get reported on my personal income tax (ภ.ง.ด. 90)?

### 8. AI-generated content liability

If my AI drafts a defamatory response and a customer posts it, and the affected person sues — can they sue ME (the platform operator) instead of just the customer? My Terms §4a + §8 try to push liability to the customer, but Thai law might not respect that.

**What you want to hear:** Either "your indemnification clause protects you" OR "in Thailand, platforms can be directly liable for AI-generated content — here's what to add."

### 9. Storing reviews written by third parties — PDPA exposure

The reviews in your system are written by third parties (Google/Yelp reviewers) who never agreed to your Privacy Policy. Their names and review text are in your database. **Could they sue you for processing their personal data without consent?**

**What you want to hear:** "This is covered under 'legitimate interest' because the data is already public" OR "you need to implement a mechanism for reviewers to request deletion."

### 10. Overall risk assessment — should I be incorporating sooner?

Not a legal question per se, but your lawyer knows the threshold. You asked this last time and I gave you my guess ($500-$2000/mo revenue). Your lawyer's answer is more valuable than mine.

---

## What to do with his answers

1. **All ✓ answers** → nothing to do, ship confidently
2. **Any ✗ answers** → send them to me, I'll update the Terms/Privacy/AUP/Refund accordingly. Most fixes are one-paragraph additions.
3. **Any ? answers** → ask him to clarify or flag as "review again in 3 months"

Most likely outcome: 2-4 of the 10 will come back as "needs a Thai-specific clause." That's normal and fixable in 30 minutes of code changes.

---

## What this costs

If your lawyer is a family contact doing you a favour: 30-45 minutes of his time.
If you're paying his normal rate: ~฿3,000-5,000.

Compare to: **one Thai customer lawsuit that finds your liability cap unenforceable = unlimited liability.**

---

## Files to send him

- `docs/LAWYER-REVIEW-TH.md` (the Thai version — that's the main one)
- The 4 legal docs (you can either print them or give him the URLs):
  - `https://your-domain/terms`
  - `https://your-domain/privacy`
  - `https://your-domain/acceptable-use`
  - `https://your-domain/refund-policy`

Or, if your site isn't live yet, he can read them in the repo:
- `client/src/i18n/translations.js` — search for `legal.terms.*`, `legal.privacy.*`, `legal.aup.*`, `legal.refund.*`
- `client/src/pages/Terms.jsx`, `Privacy.jsx`, `AcceptableUse.jsx`, `Refund.jsx` — render those keys

---

## After the meeting

Bring me his answers. I'll translate them into code changes. Your part is done after the meeting — you don't have to do the drafting, I do.
