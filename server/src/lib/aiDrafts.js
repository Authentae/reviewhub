// AI-drafted review responses via the Anthropic API, with graceful fallback
// to the existing template pool when the API is unavailable or unconfigured.
//
// Contract: generateDraft({review, businessName}) resolves to
//   { draft: string, source: 'ai' | 'template' }
//
// The source field is surfaced back to the client so the UI can (optionally)
// indicate "AI-drafted" vs "template". Calling code never needs to handle
// missing API keys or rate limits — fallback is automatic.
//
// Design decisions:
//   - No thinking. Drafting a ≤280-char reply is simple; adaptive thinking
//     would triple the latency and cost for no quality gain.
//   - No streaming. Outputs are short and we want the full text before
//     returning a response; streaming would complicate the caller.
//   - The system prompt is structured for prompt caching
//     (`cache_control: "ephemeral"` on the last system block). Today the
//     prompt is below Opus 4.7's 4096-token minimum so caching won't activate
//     — the marker is zero-cost and future-proofs a longer prompt.
//   - Short timeout (10s). Users click a button and wait; if the API hiccups,
//     falling back to a template is better than a spinner for 60s.
//   - Model configurable via ANTHROPIC_MODEL env var (defaults to
//     claude-opus-4-7). Operators who want to save cost can pick
//     claude-haiku-4-5; that's their call, not ours.
//   - Client is injectable (second arg to generateDraft) so tests can stub
//     the SDK without needing a mocking framework.

const Anthropic = require('@anthropic-ai/sdk');
const { captureException } = require('./errorReporter');
const { createMockClient, shouldUseMock } = require('./mockAnthropic');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7';
const MAX_TOKENS = 400; // responses are short; 400 gives headroom without risking a cutoff
const REQUEST_TIMEOUT_MS = 10_000;

// System prompt — deliberately stable so it's cache-friendly. Any runtime
// data (business name, reviewer name, rating, review text) goes in the user
// message, never here.
//
// LANGUAGE: the LANGUAGE rules at the top are load-bearing. Without them
// the model defaulted to English even when the review was in Thai/Japanese/
// Korean — every prior instruction in the prompt is in English, so the model
// pattern-matched to English output. Naming the rule explicitly + putting
// it FIRST flips that default. The user message also carries an explicit
// `Reply in: <lang>` line when the caller passes preferredLang, which beats
// auto-detection on edge cases (e.g. a reply-in-English Thai-restaurant
// owner whose customer wrote in English).
const SYSTEM_PROMPT = `You are drafting a response to an online review for a local business owner.

LANGUAGE (most important rule — apply before anything else):
- Reply in the SAME language the review is written in. If the review is in Thai, reply in Thai. Japanese review → Japanese reply. Korean → Korean. Spanish → Spanish. Etc.
- If the user message contains a "Reply in: <language>" hint, that hint OVERRIDES auto-detection — use the requested language regardless of the review's language.
- For Thai replies, use natural conversational Thai with appropriate ครับ/ค่ะ particles. Avoid stiff translated phrasing like "ขอบคุณสำหรับ feedback".
- For Japanese, use polite-form (です/ます) by default unless the review is clearly casual.
- Never mix languages in one reply (no "Thank you ครับ"). Never write a Thai reply in romanized Thai.

Output format:
- Return ONLY the response text. No preamble, no explanation, no quotes, no markdown.
- Plain text; line breaks are fine but avoid lists or headings.
- Keep it under 280 characters so it fits on every platform.

Tone:
- Warm and genuine. Avoid corporate-speak ("We value your feedback" / "ขอบคุณสำหรับความคิดเห็นอันมีค่า") and filler.
- Address the reviewer by their first name if the reviewer name looks like a real person's name.
- Match the register of a small-business owner replying personally, not a PR response.

Content rules by rating:
- 4-5 stars: thank them specifically. Reference something concrete from their review if it gives you a natural hook.
- 3 stars: thank them, acknowledge the mixed experience honestly, invite them back.
- 1-2 stars: apologize without making excuses. Take responsibility. Invite them to reach out directly (email or phone) so it can be made right — do NOT commit to specific remedies like refunds, free items, or discounts. Never argue, deflect blame, or dispute facts.

Hard constraints:
- Never promise refunds, free products, comps, or discounts.
- Never ask the reviewer to delete or change their review.
- Never mention competitors or other businesses.
- Never reveal you are an AI or that the response was generated.`;

// Lazily-initialised Anthropic client. Null if ANTHROPIC_API_KEY is not set
// (we fall back to templates in that case).
let _client = null;
let _clientInitAttempted = false;

// Auth-failure circuit breaker. When the Anthropic API returns 401, a
// rotated/invalid ANTHROPIC_API_KEY is the cause — every subsequent call
// will fail the same way until the env var is fixed. Without this, every
// draft request burns ~200ms calling the SDK to get a 401, AND each
// failure spams Sentry with a duplicate auth event. After a single 401
// we mark the client cold for 5 minutes; during that window draft
// requests skip the network call and short-circuit to the template
// fallback. Cleared automatically on next attempt after the cooldown.
let _authBreakerUntil = 0;
const AUTH_BREAKER_COOLDOWN_MS = 5 * 60 * 1000;

function getDefaultClient() {
  if (_clientInitAttempted) return _client;
  _clientInitAttempted = true;
  // Mock mode: dev without an API key, or explicit ANTHROPIC_MOCK=1.
  // Returns a drop-in client that produces realistic varied drafts so the
  // demo/free-tool/onboarding paths work without burning real API credits.
  if (shouldUseMock()) {
    _client = createMockClient();
    return _client;
  }
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    _client = new Anthropic.default({
      // SDK reads ANTHROPIC_API_KEY from env automatically; passed here for clarity
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: 1, // SDK default is 2; cut to 1 so fallback triggers faster
    });
    return _client;
  } catch (err) {
    captureException(err, { kind: 'anthropic.client_init' });
    return null;
  }
}

// Heuristic: does this string contain Thai characters? Used to pick a Thai
// template when the AI path is unavailable AND the caller didn't pass an
// explicit preferredLang. Cheap (no library), reliable enough for the
// fallback path. Real language detection happens in the AI path.
function looksThai(s) {
  return typeof s === 'string' && /[฀-๿]/.test(s);
}

// Template pool — used when AI path isn't available or fails. Same
// style/sentiment mapping as the previous hard-coded drafts route.
//
// `preferredLang` is optional; when 'th' (or omitted but the review text
// contains Thai characters), Thai templates are used. Without this, a Thai
// reviewer who hits the fallback path got an English-only reply — which is
// what the user reported.
function getTemplateDraft(review, preferredLang) {
  const hasName = typeof review.reviewer_name === 'string' && review.reviewer_name.trim().length > 0;
  const name = hasName ? review.reviewer_name : null;

  // Pick locale: explicit preferredLang wins, else heuristic-detect from the
  // review text. Default English. Add more locales here when needed; mirror
  // the EN/TH structure below.
  const useThai =
    preferredLang === 'th' ||
    (!preferredLang && looksThai(review.review_text));

  const draftsTH = hasName ? {
    positive: [
      `ขอบคุณ${name}มากนะคะ ดีใจที่ประทับใจ รอต้อนรับครั้งหน้าเลยค่ะ`,
      `ขอบคุณสำหรับคำชมจากคุณ${name}ค่ะ ทีมงานอ่านแล้วยิ้มกันเลย แวะมาใหม่นะคะ`,
      `ขอบคุณ${name}ค่ะ รีวิวแบบนี้เป็นกำลังใจให้ทีมเราจริงๆ เจอกันใหม่นะคะ`,
      `ดีใจมากนะคะคุณ${name} ขอบคุณที่สละเวลามาเขียนรีวิว แล้วเจอกันค่ะ`,
    ],
    negative: [
      `ต้องขอโทษ${name}จริงๆ นะคะ ไม่ใช่มาตรฐานของเรา รบกวนติดต่อเราโดยตรงเพื่อให้แก้ไขให้ค่ะ`,
      `ขอบคุณ${name}ที่บอกตรงๆ นะคะ เรารับฟังและจะปรับปรุงให้ดีขึ้น`,
      `ขออภัยอย่างจริงใจค่ะคุณ${name} อยากให้ติดต่อเราโดยตรงเพื่อแก้ไขเรื่องนี้`,
      `เราเข้าใจ${name}และขอโทษที่ทำให้ผิดหวัง ขอโอกาสแก้ไข — ทักมาหาเราโดยตรงได้นะคะ`,
    ],
    neutral: [
      `ขอบคุณ${name}สำหรับคำติชมนะคะ ครั้งหน้าเราจะทำให้ดีกว่านี้`,
      `ขอบคุณ${name}ที่แวะมาและสละเวลาเขียนรีวิวค่ะ ความเห็นแบบนี้ช่วยเราพัฒนา`,
      `ขอบคุณ${name}มากค่ะ ครั้งหน้าจะพยายามให้ได้ 5 ดาวเต็มจากคุณ`,
      `ขอบคุณ${name}สำหรับความเห็นจริงใจ เราพยายามทำให้ดีขึ้นเสมอ แวะมาใหม่นะคะ`,
    ],
  } : {
    positive: [
      `ขอบคุณมากนะคะ ดีใจที่ประทับใจ รอต้อนรับครั้งหน้าเลยค่ะ`,
      `ขอบคุณสำหรับคำชมค่ะ ทีมงานอ่านแล้วยิ้มกันเลย แวะมาใหม่นะคะ`,
      `ขอบคุณค่ะ รีวิวแบบนี้เป็นกำลังใจให้ทีมเราจริงๆ เจอกันใหม่นะคะ`,
      `ดีใจมากค่ะ ขอบคุณที่สละเวลามาเขียนรีวิว แล้วเจอกันนะคะ`,
    ],
    negative: [
      `ต้องขอโทษจริงๆ ค่ะ ไม่ใช่มาตรฐานของเรา รบกวนติดต่อเราโดยตรงเพื่อให้แก้ไขให้`,
      `ขอบคุณที่บอกตรงๆ นะคะ เรารับฟังและจะปรับปรุงให้ดีขึ้น`,
      `ขออภัยอย่างจริงใจค่ะ อยากให้ติดต่อเราโดยตรงเพื่อแก้ไขเรื่องนี้`,
      `เราเข้าใจและขอโทษที่ทำให้ผิดหวัง ขอโอกาสแก้ไข — ทักมาหาเราโดยตรงได้นะคะ`,
    ],
    neutral: [
      `ขอบคุณสำหรับคำติชมนะคะ ครั้งหน้าเราจะทำให้ดีกว่านี้`,
      `ขอบคุณที่แวะมาและสละเวลาเขียนรีวิวค่ะ ความเห็นแบบนี้ช่วยเราพัฒนา`,
      `ขอบคุณมากค่ะ ครั้งหน้าจะพยายามให้ได้ 5 ดาวเต็มจากคุณ`,
      `ขอบคุณสำหรับความเห็นจริงใจ เราพยายามทำให้ดีขึ้นเสมอ แวะมาใหม่นะคะ`,
    ],
  };

  const draftsEN = hasName ? {
    positive: [
      `Thank you so much, ${name}! We're thrilled you had a great experience and look forward to welcoming you back soon.`,
      `We really appreciate your kind words, ${name}! It means the world to our team. See you next time!`,
      `Wonderful to hear this, ${name}! Reviews like yours motivate our whole team. Hope to see you again soon!`,
      `Your feedback made our day, ${name}! We work hard to deliver great experiences and it's so rewarding to know it shows.`,
    ],
    negative: [
      `We're truly sorry to hear about your experience, ${name}. This is not up to our standards and we'd love to make it right. Please contact us directly.`,
      `Thank you for bringing this to our attention, ${name}. We take all feedback seriously and are working to improve.`,
      `We sincerely apologize, ${name}. Your experience does not reflect the standard we hold ourselves to. Please reach out so we can resolve this for you.`,
      `We hear you, ${name}, and we're sorry we let you down. Please give us another chance to make things right — contact us directly.`,
    ],
    neutral: [
      `Thank you for your feedback, ${name}! We hope to exceed your expectations on your next visit.`,
      `Thanks for stopping by and leaving a review, ${name}. Your feedback helps us improve!`,
      `We appreciate you taking the time to share your thoughts, ${name}. We'd love to earn a 5-star visit for you next time!`,
      `Thank you, ${name}! We value your honest feedback and are always looking for ways to do better. We hope to see you again soon.`,
    ],
  } : {
    positive: [
      `Thank you so much! We're thrilled you had a great experience and look forward to welcoming you back soon.`,
      `We really appreciate your kind words! It means the world to our team. See you next time!`,
      `Wonderful to hear this! Reviews like yours motivate our whole team. Hope to see you again soon!`,
      `Your feedback made our day! We work hard to deliver great experiences and it's so rewarding to know it shows.`,
    ],
    negative: [
      `We're truly sorry to hear about your experience. This is not up to our standards and we'd love to make it right. Please contact us directly.`,
      `Thank you for bringing this to our attention. We take all feedback seriously and are working to improve.`,
      `We sincerely apologize. Your experience does not reflect the standard we hold ourselves to. Please reach out so we can resolve this for you.`,
      `We hear you, and we're sorry we let you down. Please give us another chance to make things right — contact us directly.`,
    ],
    neutral: [
      `Thank you for your feedback! We hope to exceed your expectations on your next visit.`,
      `Thanks for stopping by and leaving a review. Your feedback helps us improve!`,
      `We appreciate you taking the time to share your thoughts. We'd love to earn a 5-star visit for you next time!`,
      `Thank you! We value your honest feedback and are always looking for ways to do better. We hope to see you again soon.`,
    ],
  };

  const drafts = useThai ? draftsTH : draftsEN;
  const options = drafts[review.sentiment] || drafts.neutral;
  return options[Math.floor(Math.random() * options.length)];
}

// Map ISO-639 codes the rest of the app uses to natural-language names the
// model understands well. We pass the name (not the code) because models are
// far more reliable when prompted with "Reply in: Thai" than "Reply in: th".
const LANG_NAMES = {
  en: 'English',
  th: 'Thai (ภาษาไทย) — natural conversational Thai with appropriate ครับ/ค่ะ particles, NOT romanized',
  ja: 'Japanese (日本語)',
  ko: 'Korean (한국어)',
  zh: 'Chinese (中文)',
  es: 'Spanish (Español)',
  fr: 'French (Français)',
  de: 'German (Deutsch)',
  it: 'Italian (Italiano)',
  pt: 'Portuguese (Português)',
};

function buildUserMessage({ review, businessName, preferredLang }) {
  // Use the registry's display label so the AI sees "Wongnai" / "Tabelog
  // (食べログ)" / "Dianping (大众点评)" instead of bare lowercase IDs —
  // helps the model adapt tone to the platform's audience and convention.
  const { PLATFORM_META } = require('./platforms');
  const platformLabel = PLATFORM_META[review.platform]?.label || review.platform || '';
  // When the caller passes a preferred language, surface it as an explicit
  // hint that overrides auto-detection (per SYSTEM_PROMPT). When omitted,
  // the prompt's "match the review's language" rule still applies.
  const langLine = preferredLang && LANG_NAMES[preferredLang]
    ? `Reply in: ${LANG_NAMES[preferredLang]}`
    : null;
  return [
    `Business: ${businessName || 'this business'}`,
    `Platform: ${platformLabel}`,
    `Reviewer: ${review.reviewer_name}`,
    `Rating: ${review.rating} out of 5 stars`,
    `Review text: ${review.review_text ? `"${review.review_text}"` : '(none provided)'}`,
    langLine,
    '',
    'Draft a response.',
  ].filter(Boolean).join('\n');
}

// Main entry point. `client` is injectable for tests; production passes nothing
// and gets the module-level lazily-initialised client. `preferredLang` (e.g.
// 'th', 'ja') overrides the model's auto-language-detection AND picks the
// matching template for the fallback path.
async function generateDraft({ review, businessName, preferredLang }, { client } = {}) {
  const anthropic = client ?? getDefaultClient();

  if (!anthropic) {
    return { draft: getTemplateDraft(review, preferredLang), source: 'template' };
  }

  // Auth circuit breaker — short-circuit during the cooldown window so a
  // rotated/invalid API key doesn't burn round-trips on every draft and
  // doesn't keep tripping Sentry alerts. Tests inject a client directly,
  // so the breaker only applies when we're using the module-level client.
  if (!client && Date.now() < _authBreakerUntil) {
    return { draft: getTemplateDraft(review, preferredLang), source: 'template' };
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          // Marker is zero-cost below the model's minimum cacheable prefix.
          // Kept here so the prompt-caching path is wired the day the prompt
          // grows past 4096 tokens (Opus 4.7 minimum).
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        { role: 'user', content: buildUserMessage({ review, businessName, preferredLang }) },
      ],
    });

    // response.content is ContentBlock[] — narrow by .type before reading .text.
    const textBlock = response.content.find((b) => b.type === 'text');
    const draft = textBlock?.text?.trim();
    if (!draft) {
      // API returned no text block — shouldn't happen, but fall back cleanly.
      captureException(new Error('Anthropic returned no text block'), {
        kind: 'anthropic.empty_response',
        reviewId: review.id,
      });
      return { draft: getTemplateDraft(review, preferredLang), source: 'template' };
    }
    return { draft, source: 'ai' };
  } catch (err) {
    // Use typed exceptions from the SDK to categorise the error for monitoring
    // without leaking detail to the user. We never rethrow — the caller gets
    // a valid (if generic) draft either way.
    const errorKind = err instanceof Anthropic.default.RateLimitError ? 'rate_limited'
      : err instanceof Anthropic.default.AuthenticationError ? 'auth'
      : err instanceof Anthropic.default.APIError ? `api_${err.status}`
      : 'unknown';

    // Auth failures = bad ANTHROPIC_API_KEY in env. Trip the breaker so
    // the next 5 minutes of draft requests skip Anthropic entirely, AND
    // log to Sentry only ONCE per cooldown window — without this, every
    // user clicking "Draft with AI" produces a duplicate Sentry event for
    // the same root cause (the env var).
    if (errorKind === 'auth') {
      const breakerWasOpen = Date.now() < _authBreakerUntil;
      _authBreakerUntil = Date.now() + AUTH_BREAKER_COOLDOWN_MS;
      if (!breakerWasOpen) {
        console.warn('[aiDrafts] Anthropic auth failed — check ANTHROPIC_API_KEY in env. Falling back to templates for the next 5 min.');
        captureException(err, {
          kind: 'anthropic.draft_failed',
          errorKind,
          reviewId: review.id,
          model: MODEL,
          breaker: 'tripped',
        });
      }
      return { draft: getTemplateDraft(review, preferredLang), source: 'template' };
    }

    captureException(err, {
      kind: 'anthropic.draft_failed',
      errorKind,
      reviewId: review.id,
      model: MODEL,
    });
    return { draft: getTemplateDraft(review, preferredLang), source: 'template' };
  }
}

// Reset for tests — clears the lazy client so setting ANTHROPIC_API_KEY in a
// test env takes effect, and re-arms the auth circuit breaker.
function _resetForTests() {
  _client = null;
  _clientInitAttempted = false;
  _authBreakerUntil = 0;
}

module.exports = { generateDraft, getTemplateDraft, _resetForTests };
