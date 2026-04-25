// Mock Anthropic client — drop-in replacement for `new Anthropic()` that
// produces realistic, varied draft replies WITHOUT calling the real API.
//
// Why this exists:
//   - Local dev: founder runs the app daily without burning API credits.
//   - Demos / screenshots: the Landing page free-tool demo and onboarding
//     should show AI-quality output, not the boring "Thank you so much,
//     {name}!" template fallback.
//   - Tests: a single shared mock instead of inline stubs in every test.
//   - Offline: works on a plane.
//
// Activated by:
//   - ANTHROPIC_MOCK=1 (explicit opt-in, any environment)
//   - OR: NODE_ENV=development AND no ANTHROPIC_API_KEY (auto in local dev)
//
// Shape contract: matches the real SDK closely enough that aiDrafts.js
// can pass this in via the `client` injection slot with no other changes.
//   client.messages.create({...}) → { content: [{ type: 'text', text }] }

// Sentence pools, keyed by sentiment. Each pool is a list of templates with
// `{name}` / `{biz}` / `{hook}` placeholders. We pick weighted-random across
// them so consecutive demo runs don't show identical drafts.
const POOLS = {
  positive: [
    "{name} — thank you. {hook} Hearing this means a lot, and we hope to see you back at {biz} soon.",
    "We're so glad you enjoyed it, {name}. {hook} The whole team will love reading this — thanks for taking a moment to write it.",
    "Thanks {name} — that made our day. {hook} Come back any time; we'll save you a good seat.",
    "{name}, this is exactly the kind of visit we hope every guest has. {hook} Thank you for the kind words.",
    "Really appreciate you, {name}. {hook} Word-of-mouth from regulars like you keeps small places like {biz} going.",
  ],
  neutral: [
    "Thanks for the honest feedback, {name}. {hook} If there's something specific that would have made it a 5-star visit, we'd genuinely like to hear it — {biz}.",
    "{name} — we appreciate you taking the time. {hook} We'd love another shot at earning that fifth star next visit.",
    "Thank you, {name}. {hook} Your notes help us figure out what to tighten up; we hope you'll give {biz} another try.",
    "Appreciate the balanced read, {name}. {hook} Email us next time you stop by and we'll make sure it lands closer to a 5.",
  ],
  negative: [
    "{name} — we're really sorry. {hook} That's not the experience we want anyone to have at {biz}. Could you email us directly so we can hear the full story and make it right?",
    "We owe you an apology, {name}. {hook} I'd like to look into what happened personally — please reach out and we'll take it from there.",
    "{name}, thank you for telling us, even though it wasn't what we'd hoped to hear. {hook} We'd like the chance to do better — please get in touch with {biz} directly.",
    "This isn't us at our best, {name}, and we're sorry. {hook} Reach out any time — we read every message and we'll respond personally.",
  ],
};

// Hook generators look at the review text for concrete things to reference,
// so the draft feels read-not-templated. Falls back to a generic phrase if
// nothing notable surfaces.
const HOOK_KEYWORDS = [
  { match: /\b(staff|team|server|waitress|waiter|barista|crew)\b/i,
    positive: "We'll pass this along to the team — they'll be thrilled.",
    neutral: "We'll share your note with the team.",
    negative: "We'll be talking with the team about what you described." },
  { match: /\b(food|meal|dish|menu|sandwich|burger|coffee|drink|cocktail|wine|cake|pizza|pastry|bread|salad)\b/i,
    positive: "Glad the food landed well — we put real care into the menu.",
    neutral: "Thanks for the note on the food — we're always tweaking.",
    negative: "It sounds like the food fell short of what we aim for, and that's on us." },
  { match: /\b(wait|waited|slow|long time|took forever|45 min|an hour)\b/i,
    positive: "",
    neutral: "We hear you on the timing.",
    negative: "Long waits aren't acceptable, and we should have communicated better." },
  { match: /\b(clean|cleanliness|dirty|messy|spotless)\b/i,
    positive: "Cleanliness is something we take seriously, so it's good to hear it shows.",
    neutral: "",
    negative: "Cleanliness is non-negotiable for us — we'll be looking into this today." },
  { match: /\b(price|expensive|overpriced|value|cheap)\b/i,
    positive: "",
    neutral: "We've heard the value question before and we take it seriously.",
    negative: "Value is something we think hard about, and clearly we missed the mark here." },
  { match: /\b(atmosphere|ambience|vibe|cozy|loud|quiet)\b/i,
    positive: "The atmosphere is something we put a lot of thought into — happy it landed.",
    neutral: "",
    negative: "" },
];

const GENERIC_HOOKS = {
  positive: [
    "Reviews like this genuinely make a difference for a small place.",
    "The team works hard to make every visit count, so this matters.",
    "It's the regulars who get us here — thank you.",
  ],
  neutral: [
    "Honest middle-of-the-road feedback is some of the most useful kind.",
    "We'd rather hear it straight than not at all.",
  ],
  negative: [
    "There's no version of this where we're okay leaving you with that impression.",
    "We take this kind of feedback seriously — it's how we get better.",
  ],
};

function pickHook(reviewText, sentiment) {
  if (typeof reviewText === 'string' && reviewText.length) {
    for (const hk of HOOK_KEYWORDS) {
      if (hk.match.test(reviewText) && hk[sentiment]) {
        return hk[sentiment];
      }
    }
  }
  const fallback = GENERIC_HOOKS[sentiment] || GENERIC_HOOKS.neutral;
  return fallback[Math.floor(Math.random() * fallback.length)];
}

// Pull a first name out of "Marcus T." / "Alice Example" / "alice@x.com".
function firstName(raw) {
  if (!raw || typeof raw !== 'string') return 'there';
  const cleaned = raw.split('@')[0].trim();
  const first = cleaned.split(/\s+/)[0];
  if (!first) return 'there';
  return first[0].toUpperCase() + first.slice(1);
}

// Parse the structured user message that aiDrafts.js builds, so the mock
// can branch on rating/sentiment without us re-defining the contract.
function parseUserMessage(content) {
  if (typeof content !== 'string') return {};
  const lines = content.split('\n');
  const fields = {};
  for (const line of lines) {
    const m = line.match(/^([A-Za-z ]+):\s*(.*)$/);
    if (m) fields[m[1].toLowerCase().trim()] = m[2];
  }
  const rating = parseInt(fields.rating, 10) || 0;
  const sentiment = rating >= 4 ? 'positive' : rating <= 2 ? 'negative' : 'neutral';
  return {
    sentiment,
    rating,
    reviewer: fields.reviewer || '',
    business: fields.business || 'this business',
    reviewText: (fields['review text'] || '').replace(/^"|"$/g, ''),
  };
}

function generateDraftText({ sentiment, reviewer, business, reviewText }) {
  const pool = POOLS[sentiment] || POOLS.neutral;
  const template = pool[Math.floor(Math.random() * pool.length)];
  const hook = pickHook(reviewText, sentiment);
  return template
    .replace('{name}', firstName(reviewer))
    .replace('{biz}', business || 'us')
    .replace('{hook}', hook)
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Artificial latency so the demo "feels" like an API call rather than
// snapping instantly. Tunable via env for tests that want zero delay.
function getMockLatencyMs() {
  if (process.env.ANTHROPIC_MOCK_LATENCY === '0') return 0;
  const configured = parseInt(process.env.ANTHROPIC_MOCK_LATENCY || '', 10);
  if (Number.isFinite(configured) && configured >= 0) return configured;
  // Default: 300–800ms, randomized per call.
  return 300 + Math.floor(Math.random() * 500);
}

function createMockClient() {
  return {
    messages: {
      async create(request) {
        const latency = getMockLatencyMs();
        if (latency > 0) await new Promise((r) => setTimeout(r, latency));

        const userMsg = request?.messages?.[0]?.content || '';
        const parsed = parseUserMessage(userMsg);
        const text = generateDraftText(parsed);

        return {
          id: `msg_mock_${Date.now().toString(36)}`,
          type: 'message',
          role: 'assistant',
          model: request?.model || 'mock-claude',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
          content: [{ type: 'text', text }],
        };
      },
    },
  };
}

// Decide whether the mock should be used in the current process. Called
// from aiDrafts.js when no explicit client is injected.
function shouldUseMock() {
  if (process.env.ANTHROPIC_MOCK === '1') return true;
  if (process.env.NODE_ENV === 'development' && !process.env.ANTHROPIC_API_KEY) return true;
  return false;
}

module.exports = { createMockClient, shouldUseMock, generateDraftText, parseUserMessage };
