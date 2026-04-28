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
const SYSTEM_PROMPT = `You are drafting a response to an online review for a local business owner.

Output format:
- Return ONLY the response text. No preamble, no explanation, no quotes, no markdown.
- Plain text; line breaks are fine but avoid lists or headings.
- Keep it under 280 characters so it fits on every platform.

Tone:
- Warm and genuine. Avoid corporate-speak ("We value your feedback") and filler.
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

// Template pool — used when AI path isn't available or fails. Same
// style/sentiment mapping as the previous hard-coded drafts route.
function getTemplateDraft(review) {
  const drafts = {
    positive: [
      `Thank you so much, ${review.reviewer_name}! We're thrilled you had a great experience and look forward to welcoming you back soon.`,
      `We really appreciate your kind words, ${review.reviewer_name}! It means the world to our team. See you next time!`,
      `Wonderful to hear this, ${review.reviewer_name}! Reviews like yours motivate our whole team. Hope to see you again soon!`,
      `Your feedback made our day, ${review.reviewer_name}! We work hard to deliver great experiences and it's so rewarding to know it shows.`,
    ],
    negative: [
      `We're truly sorry to hear about your experience, ${review.reviewer_name}. This is not up to our standards and we'd love to make it right. Please contact us directly.`,
      `Thank you for bringing this to our attention, ${review.reviewer_name}. We take all feedback seriously and are working to improve.`,
      `We sincerely apologize, ${review.reviewer_name}. Your experience does not reflect the standard we hold ourselves to. Please reach out so we can resolve this for you.`,
      `We hear you, ${review.reviewer_name}, and we're sorry we let you down. Please give us another chance to make things right — contact us directly.`,
    ],
    neutral: [
      `Thank you for your feedback, ${review.reviewer_name}! We hope to exceed your expectations on your next visit.`,
      `Thanks for stopping by and leaving a review, ${review.reviewer_name}. Your feedback helps us improve!`,
      `We appreciate you taking the time to share your thoughts, ${review.reviewer_name}. We'd love to earn a 5-star visit for you next time!`,
      `Thank you, ${review.reviewer_name}! We value your honest feedback and are always looking for ways to do better. We hope to see you again soon.`,
    ],
  };
  const options = drafts[review.sentiment] || drafts.neutral;
  return options[Math.floor(Math.random() * options.length)];
}

function buildUserMessage({ review, businessName }) {
  // Use the registry's display label so the AI sees "Wongnai" / "Tabelog
  // (食べログ)" / "Dianping (大众点评)" instead of bare lowercase IDs —
  // helps the model adapt tone to the platform's audience and convention.
  const { PLATFORM_META } = require('./platforms');
  const platformLabel = PLATFORM_META[review.platform]?.label || review.platform || '';
  return [
    `Business: ${businessName || 'this business'}`,
    `Platform: ${platformLabel}`,
    `Reviewer: ${review.reviewer_name}`,
    `Rating: ${review.rating} out of 5 stars`,
    `Review text: ${review.review_text ? `"${review.review_text}"` : '(none provided)'}`,
    '',
    'Draft a response.',
  ].join('\n');
}

// Main entry point. `client` is injectable for tests; production passes nothing
// and gets the module-level lazily-initialised client.
async function generateDraft({ review, businessName }, { client } = {}) {
  const anthropic = client ?? getDefaultClient();

  if (!anthropic) {
    return { draft: getTemplateDraft(review), source: 'template' };
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
        { role: 'user', content: buildUserMessage({ review, businessName }) },
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
      return { draft: getTemplateDraft(review), source: 'template' };
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
    captureException(err, {
      kind: 'anthropic.draft_failed',
      errorKind,
      reviewId: review.id,
      model: MODEL,
    });
    return { draft: getTemplateDraft(review), source: 'template' };
  }
}

// Reset for tests — clears the lazy client so setting ANTHROPIC_API_KEY in a
// test env takes effect.
function _resetForTests() {
  _client = null;
  _clientInitAttempted = false;
}

module.exports = { generateDraft, getTemplateDraft, _resetForTests };
