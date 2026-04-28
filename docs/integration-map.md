# ReviewHub integration map

Every external platform we could plug into the product. Tagged by:

- **Status** — `LIVE` (already wired) · `READY` (provider scaffolded, just needs creds) · `PROPOSED` (not yet built)
- **Priority** — based on Thai-market launch usefulness
- **Effort** — 🟢 ≤1 day · 🟡 1–3 days · 🔴 ≥1 week
- **Region** — 🇹🇭 Thailand-specific · 🌏 global

This doc is a menu, not a roadmap. Pick what helps the next 100 paying customers, ignore the rest until you have them.

---

## 1. Review sources (the input pipe — what we pull reviews FROM)

### Live
| Platform | Status | Region | What it gives | Notes |
|---|---|---|---|---|
| **Google Business Profile** | `LIVE` | 🌏 | OAuth → reviews + ratings + replies | Today's only working integration. Most universal. |

### Coming soon (already scaffolded as providers, missing API key + finish)
| Platform | Status | Region | Effort | Notes |
|---|---|---|---|---|
| **Yelp Fusion API** | `READY` | 🌏 | 🟡 | Hotel/restaurant heavy. US/EU > TH. Read-only. |
| **Facebook Page Reviews** | `READY` | 🌏 | 🟡 | Recommends + comments. Need Page admin OAuth. |
| **TripAdvisor Content API** | `READY` | 🌏 | 🟡 | Tourism-heavy. Useful for TH hotels/restaurants near tourist spots. |
| **Trustpilot Business API** | `READY` | 🌏 | 🟡 | E-commerce / services. EU > TH. |
| **Wongnai** | `READY` | 🇹🇭 | 🔴 | TH's #1 restaurant review site. **Highest TH priority** but no public API — partnership needed. Workaround: CSV import + Chrome extension scraper. |

### Worth adding (high TH market value)
| Platform | Effort | Region | Why |
|---|---|---|---|
| **LINE MAN Wongnai** | 🔴 | 🇹🇭 | Merged with Wongnai. Same partnership channel. |
| **Grab Food / Grab merchant** | 🔴 | 🇹🇭🌏 | Has merchant ratings. SE Asia leader. Partner API gated. |
| **Foodpanda merchant** | 🔴 | 🇹🇭 | Ratings + reviews on their merchant portal. Scraping likely faster than partner API. |
| **Shopee / Lazada seller reviews** | 🟡 | 🇹🇭 | E-commerce sellers need this. Lazada has Open Platform; Shopee partner API. |
| **Booking.com reviews** | 🟡 | 🌏 | Critical for hotels. Review express endpoint. |
| **Agoda** | 🟡 | 🇹🇭 | TH-headquartered, owned by Booking Holdings. Hotel reviews. |
| **Airbnb host reviews** | 🔴 | 🌏 | Closed API. Probably never. |
| **Klook** | 🟡 | 🇹🇭🌏 | Tours/activities. TH partners. |
| **Pantip** | 🟢 | 🇹🇭 | TH forum mentions of your brand. Custom scraper or RSS. Not "reviews" strictly but brand-monitoring gold. |
| **App Store / Play Store reviews** | 🟢 | 🌏 | If customer ships an app. Both have official APIs. |
| **G2 / Capterra** | 🟡 | 🌏 | Only matters if you're a B2B SaaS. Not your customer's first concern. |

---

## 2. Communication — review-request channels (the output pipe — how we ASK for reviews)

| Platform | Effort | Region | Notes |
|---|---|---|---|
| **Email (SMTP)** | `LIVE` | 🌏 | Resend already wired. |
| **LINE Official Account API** | 🟡 | 🇹🇭 | **Huge TH leverage.** Most Thai customers have LINE; opens 90%+. Send review-request push messages. |
| **LINE Notify** | 🟢 | 🇹🇭 | Simpler push channel for the SMB owner themselves (alerts about new reviews). |
| **WhatsApp Business API** | 🟡 | 🌏 | Global outside TH. Twilio or Meta direct. |
| **SMS via Twilio** | 🟢 | 🌏 | Universal fallback. ~$0.05/SMS in TH. |
| **SMS via Thai providers** (ThaiBulkSMS, SMSMaster, SiamSMS) | 🟢 | 🇹🇭 | Cheaper than Twilio for local TH numbers. |
| **In-store QR code → web flow** | 🟢 | 🇹🇭🌏 | Already aligned with the Pro plan's "review requests" feature. Print on receipts. |

---

## 3. Payments / billing

| Platform | Status | Region | Effort | Notes |
|---|---|---|---|---|
| **LemonSqueezy** | `LIVE` | 🌏 | — | Merchant of record, handles VAT globally. Already wired. |
| **Stripe** | `READY` | 🌏 | 🟡 | Provider scaffolded (`server/src/lib/billing/stripe.js`). Use if LS becomes a problem or you want self-MoR. |
| **Paddle** | `READY` | 🌏 | 🟡 | Same as LS — MoR. Provider scaffolded. |
| **Omise** | `PROPOSED` | 🇹🇭 | 🟡 | TH-headquartered processor. Better TH bank routing than LS for some cards. |
| **PromptPay (QR)** | `PROPOSED` | 🇹🇭 | 🟡 | Government QR system. Free for B2C, costs ~1% via processor. **High demand for Thai SMBs** who hate Stripe fees. |
| **Rabbit LINE Pay** | `PROPOSED` | 🇹🇭 | 🟡 | LINE wallet checkout. Increasingly popular. |
| **TrueMoney Wallet** | `PROPOSED` | 🇹🇭 | 🟡 | True corp's wallet. Lower priority. |
| **Atome (BNPL)** | `PROPOSED` | 🇹🇭 | 🟡 | Buy Now Pay Later. Useful if your AOV is high. Yours isn't ($14–$59/mo). Skip. |
| **Direct bank APIs** (KBank, SCB, Krungsri, Bualuang) | 🔴 | 🇹🇭 | Reserve for enterprise customers. |

---

## 4. Email delivery

| Platform | Status | Effort | Notes |
|---|---|---|---|
| **Resend** | `LIVE` | — | Currently sending. |
| **SendGrid** | `READY` | 🟢 | Drop-in via SMTP env vars. Backup if Resend deliverability dips. |
| **Postmark** | `READY` | 🟢 | Best-in-class transactional deliverability. Slightly pricier. |
| **AWS SES** | `READY` | 🟢 | Cheapest at scale (>50K/mo). Worth it if you grow. |
| **Brevo** (Sendinblue) | `READY` | 🟢 | EU-based. Good for GDPR-strict customers. |
| **Loops / ConvertKit** | `PROPOSED` | 🟡 | If you start sending newsletter / marketing emails — separate from transactional. |

---

## 5. Analytics + product analytics

| Platform | Status | Effort | Why pick this one |
|---|---|---|---|
| **Plausible** | `PROPOSED` (placeholder ready in `client/index.html`) | 🟢 | Cookieless, privacy-first, GDPR-clean. €9/mo. **Recommended.** |
| **Umami** | `PROPOSED` | 🟢 | Self-host or cloud. Free tier good. |
| **PostHog** | `PROPOSED` | 🟡 | All-in-one: analytics + funnels + session replay + feature flags. Free up to 1M events/mo. |
| **Mixpanel** | `PROPOSED` | 🟡 | Best for funnel analysis. Free up to 100K events. |
| **Amplitude** | `PROPOSED` | 🟡 | Similar to Mixpanel. Free up to 10M events. |
| **Google Analytics 4** | `PROPOSED` | 🟢 | Universal, but cookie banner required. Use only if you need adwords retargeting. |
| **Fathom** | `PROPOSED` | 🟢 | Same vibe as Plausible, slightly pricier ($14/mo). |

---

## 6. Error / observability

| Platform | Status | Notes |
|---|---|---|
| **Sentry** | `LIVE` | Server errors flowing. Frontend SDK not wired yet. |
| **Sentry frontend SDK** | `READY` | Adding `@sentry/react` to client gives JS errors + breadcrumbs. ~30 min. |
| **LogRocket** | `PROPOSED` | Session replay on errors — see exactly what the user did. ~$99/mo. Skip until 50+ paid users. |
| **BetterStack** | `PROPOSED` | Uptime monitoring + log aggregation. Free tier fine for now. |
| **UptimeRobot** | `PROPOSED` | 5-min interval pings, free. **Add this today** — you'll know about Railway downtime before customers do. |

---

## 7. Customer support / chat

| Platform | Effort | Region | Notes |
|---|---|---|---|
| **Crisp** | 🟢 | 🌏 | Best for SaaS. Free tier real. Has TH translations. |
| **Tidio** | 🟢 | 🌏 | Free tier with 50 chats/mo. AI replies built in. |
| **Intercom** | 🟡 | 🌏 | Industry standard, $74+/mo. Overkill at <100 users. |
| **LINE OA** | 🟡 | 🇹🇭 | Use your LINE OA as the support channel — TH SMBs already on LINE. |
| **Plain.com** | 🟡 | 🌏 | Modern alternative to Zendesk. Good API. |
| **Help Scout** | 🟡 | 🌏 | Email-first ticketing. $25/mo. |
| **HubSpot Service** | 🟡 | 🌏 | Free tier. Couples with HubSpot CRM. |

---

## 8. Auth / identity (additions to current email + password)

| Platform | Effort | Region | Why |
|---|---|---|---|
| **LINE Login** | 🟡 | 🇹🇭 | TH users already have a LINE account. **Highest-leverage TH addition.** |
| **Google OAuth** (for app login, separate from BusinessProfile) | 🟢 | 🌏 | One-tap signup. Most users have Google. |
| **Apple Sign-in** | 🟢 | 🌏 | Required if you ship an iOS app. Otherwise skip. |
| **Facebook Login** | 🟢 | 🌏 | Declining usage. Skip unless customers ask. |
| **Clerk** | 🔴 | 🌏 | Replace your auth entirely. Big refactor; not worth it pre-launch. |
| **WorkOS** | 🔴 | 🌏 | Enterprise SSO (SAML, SCIM). Skip until enterprise deals. |

---

## 9. Marketing automation / mailing

| Platform | Effort | Notes |
|---|---|---|
| **Loops** | 🟢 | Onboarding email sequences. SaaS-focused, simple API. |
| **Customer.io** | 🟡 | Same use, more powerful. $100/mo+. |
| **Mailchimp** | 🟢 | Lowest-friction onboarding. Free up to 500 contacts. |
| **ConvertKit** | 🟡 | Creator-focused. Skip — not your customer profile. |
| **Beehiiv** | 🟡 | Newsletter platform. Use later for "ReviewHub Weekly" content. |

---

## 10. Workflow / automation (so users can pipe ReviewHub into their stack)

| Platform | Effort | Notes |
|---|---|---|
| **Zapier** | 🟡 | Build a public Zapier integration. Triggers: new review, sentiment threshold. Actions: draft reply, post reply. Massive distribution channel. |
| **Make.com** | 🟡 | Same as Zapier, EU-based, often cheaper. |
| **n8n** | 🟢 | Self-hosted. Provide a webhook recipe in your docs. |
| **Pipedream** | 🟢 | Webhook-friendly, dev-loved. |

---

## 11. Help docs / changelog / public roadmap

| Platform | Effort | Notes |
|---|---|---|
| **Mintlify** | 🟢 | Developer docs. Free tier. Good if you build the API. |
| **GitBook** | 🟢 | General-purpose docs. |
| **Frill** | 🟢 | Changelog + feedback + roadmap voting. $25/mo. **Recommended** to pair with launch. |
| **Canny** | 🟢 | Same as Frill. Pricier. |
| **Featurebase** | 🟢 | Cheaper Canny clone. Good for solo. |

---

## 12. Other infra you might need

| Category | Platform | Effort | Notes |
|---|---|---|---|
| **CDN / images** | Cloudflare R2 + Images | 🟢 | If users upload screenshots. |
| **Queue / cron** | Railway cron | 🟢 | Already runs there. |
| **Search** | Meilisearch (self-host) or Algolia | 🟡 | If review count per business explodes. |
| **Feature flags** | GrowthBook (self-host) or Statsig | 🟢 | Useful when you want to ship Yelp integration to 10% of users first. |
| **Status page** | StatusPage.io / BetterStack Status | 🟢 | Public uptime page. Boosts trust during enterprise sales. |
| **Translation review** (human QA on Thai) | Lokalise / Crowdin | 🟡 | If you want native Thai speakers to QA the t() strings I added. |

---

## What to actually do — ranked by ROI for TH launch

1. **LINE Official Account integration** (review-request + support channel) → unlocks TH market the way email does for global.
2. **Plausible analytics** (snippet drop-in, CSP update) → 10 min, lets you see traffic.
3. **UptimeRobot** monitoring → 5 min, free, customer-trust win.
4. **Frill** for changelog + public roadmap → 30 min setup, builds trust pre-launch.
5. **Sentry frontend SDK** → 30 min, catches client crashes you currently don't see.
6. **Zapier integration** → 1–2 days, distribution multiplier.
7. **PromptPay** payment option → 1–2 days, alternative to credit cards for Thai SMBs.
8. **LINE Login** → 1–2 days, frictionless TH signups.

Skip until $5K MRR:
- Wongnai partnership · Booking.com integration · WorkOS SSO · LogRocket · Customer.io · Algolia.
