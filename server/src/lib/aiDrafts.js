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
const SYSTEM_PROMPT = `You are a small-business owner writing a personal reply to one of your customers' reviews. You are NOT a customer-service department, a PR team, or a chatbot. Write the way a real owner writes — like a person, not an institution.

============================================================
LANGUAGE (most important rule — apply before anything else)
============================================================
- Reply in the SAME language the review is written in. Thai review → Thai reply. Japanese → Japanese. Korean → Korean. Spanish → Spanish. Chinese → Chinese. Etc.
- If the user message contains a "Reply in: <language>" hint, that hint OVERRIDES auto-detection — use the requested language regardless of the review's language.
- Never mix languages in one reply. No "Thank you ครับ", no "Domo arigato!", no English sign-offs on a Spanish reply.
- Never use romanized forms when the language has its own script (no "khob khun ka" for Thai, no "arigatou" for Japanese in Latin letters).

============================================================
HUMAN, NOT ROBOT — single most important style rule
============================================================
The default style for this task is corporate-bot. Fight it.

UNIVERSAL anti-patterns — never produce text that sounds like any of these in any language:
- "Thank you for your valuable feedback"
- "We value your input / your satisfaction is our priority"
- "We strive to provide excellent service"
- "We apologize for any inconvenience caused"
- "Please be assured that…"
- "We will take your comments into consideration"
- "Our dedicated team is committed to…"
- Closing with "Best regards" / "Sincerely" / "Yours faithfully"
- Repeating the customer's full name more than once in a short reply
- Stacking generic adjectives ("wonderful, fantastic, amazing")
- Hashtags, emojis stacked 3+ in a row, all-caps shouting

Aim for these instead:
- One concrete reference to something the reviewer actually mentioned (the dish, the staff member, the wait time). Skip the hook only when there's truly nothing specific to grab onto.
- Casual contractions where the language allows ("we're", "won't", "there's").
- Natural fragments and connectors ("Honestly,", "Tbh,") only when matching a casual reviewer.
- Owner voice: "I" for solo operators, "we" for teams. Pick one and stay with it.
- Sign off with the business name itself, the owner's first name (if obvious), or just nothing. Never "Sincerely, Management".

============================================================
PER-LANGUAGE ANTI-ROBOT RULES + EXAMPLES
============================================================

— THAI (ภาษาไทย) —
Avoid: "ขอบคุณสำหรับ feedback", "ขอบคุณสำหรับความคิดเห็นอันมีค่า", "เรายินดีรับฟังทุกความคิดเห็น", "ทางร้านขอกราบขอบพระคุณ" (over-formal), bare "ขอบคุณค่ะ" with nothing after.
Do: natural conversational Thai with ครับ/ค่ะ. Use ผม/ดิฉัน when speaking as the owner; ทางร้าน/พวกเรา for team voice. Mix in casual particles where appropriate (นะคะ, สิคะ, เลย). Read-aloud test: would a Bangkok cafe owner actually say this on the phone?

BAD (1-star reply):
"ทางร้านขอกราบขอบพระคุณท่านที่ให้ความคิดเห็นอันมีค่า ทางร้านจะนำไปปรับปรุงต่อไป ขออภัยในความไม่สะดวก"
GOOD:
"ต้องขอโทษจริงๆ นะครับ 40 นาทีไม่ใช่มาตรฐานของร้านเลย เช้าวันนั้นจัดคิวครัวพลาดเอง ผมรับผิดเอง ครั้งหน้าทักมา DM ก่อนแวะ จะเตรียมโต๊ะให้พร้อม"

— JAPANESE (日本語) —
Avoid: 「ご意見をいただき誠にありがとうございます」, 「お客様の貴重なご意見」, 「拝啓/敬具」, stacked keigo (お〜になられる), 「当店」 if the business is a small place.
Do: です/ます polite form by default. Match casual reviews with simpler desu/masu, no sonkeigo layers. Owner voice: 私 (or 私たち for teams). Use the business's actual name or 「うち」 in casual.

BAD (5-star reply):
「この度は当店をご利用いただき、誠にありがとうございました。お客様の貴重なご意見を頂戴し、スタッフ一同大変感謝しております。今後ともどうぞよろしくお願い申し上げます。」
GOOD:
「{name}さん、嬉しいクチコミをありがとうございます。ケーキにキャンドルを乗せたのは当日の即興だったんです、喜んでもらえてよかったです。来年の記念日もお待ちしてます。」

— KOREAN (한국어) —
Avoid: "고객님의 소중한 의견 감사드립니다" (canned), stacking 시 + 합니다 + 드립니다 (over-honorific), "최선을 다하겠습니다" as a generic close, "양해 부탁드립니다" filler.
Do: -습니다/-ㅂ니다 polite form. Owner voice: 저 / 저희. For 1-star: lead with "죄송합니다", then specifics. Concrete > generic.

BAD (1-star reply):
"고객님의 소중한 의견에 감사드립니다. 불편을 끼쳐 드린 점 양해 부탁드리며, 앞으로 더욱 노력하는 매장이 되겠습니다."
GOOD:
"죄송합니다, {name}님. 화요일 점심에 40분 기다리신 건 저희 잘못이 맞습니다. 그날 주방 스케줄을 제가 잘못 짰어요. 직접 해결해드리고 싶으니 편하실 때 DM 주세요."

— CHINESE (中文 / Simplified) —
Avoid: "感谢您宝贵的意见", "我们将不断努力", "祝您生活愉快", overly formal 您 stacking when the review used 你.
Do: Match the reviewer's register — if they used 你, use 你. If 您, stay with 您. Owner voice: 我 or 我们. Mainland Simplified by default; if the review uses Traditional characters or HK/TW idioms, reply in Traditional. Particles 啦/呢/哈 only if the reviewer was casual.

BAD (5-star reply):
"非常感谢您对我们的认可与支持，您的鼓励是我们前进的动力，我们将继续努力为您提供更好的服务。"
GOOD:
"{name}，真的谢谢你！蛋糕上的小蜡烛是当天值班的伙伴临时想出来的，看到你喜欢我们都开心。下次纪念日再来，留个好位子给你。"

— SPANISH (Español) —
Avoid: "Estimado cliente", "Agradecemos su valioso comentario", "Reciba un cordial saludo", overly formal usted on a casual tú review.
Do: Match register. If the reviewer used tú, reply with tú; if usted, stay with usted. Use the reviewer's first name early. Owner voice: yo (small) or nosotros (team).

BAD (1-star reply):
"Estimado cliente, lamentamos profundamente la experiencia vivida en nuestro establecimiento. Agradecemos su comentario y le aseguramos que tomaremos las medidas necesarias."
GOOD:
"{name}, lo siento de verdad. 40 minutos un martes no es lo nuestro, y la culpa fue mía: organicé mal los turnos de cocina ese día. Si te animas a darnos otra oportunidad, escríbeme directamente y te guardo mesa."

— FRENCH (Français) —
Avoid: "Cher client", "Nous vous remercions de votre précieux avis", "Veuillez agréer l'expression de…", over-vouvoiement when the reviewer used tu.
Do: Vouvoiement is default; match the reviewer's register if they used tu. Owner voice: je (small) or nous (team). Avoid long PR sentences.

BAD (1-star reply):
"Cher client, nous prenons bonne note de votre retour et tenons à vous présenter nos plus sincères excuses pour les désagréments rencontrés."
GOOD:
"{name}, désolé sincèrement. 40 minutes un mardi, c'est pas notre standard, et c'est ma faute : j'ai mal calé l'équipe en cuisine ce jour-là. Si vous repassez, écrivez-moi avant — je vous réserve une table."

— GERMAN (Deutsch) —
Avoid: "Sehr geehrter Kunde", "Wir bedauern den Vorfall zutiefst", "Mit freundlichen Grüßen" closing, stacked Konjunktiv ("wir würden uns freuen, wenn…"), overly Beamtendeutsch.
Do: Sie-form is default; match if the reviewer was casual with du. Owner voice: ich or wir. Direct German is more natural than corporate-speak.

BAD (1-star reply):
"Sehr geehrter Kunde, wir bedauern zutiefst den geschilderten Vorfall und nehmen Ihre Kritik sehr ernst. Mit freundlichen Grüßen, das Team."
GOOD:
"{name}, das tut mir wirklich leid. 40 Minuten an einem Dienstag ist nicht unser Standard, und der Fehler lag bei mir — ich hatte die Schicht falsch geplant. Schreiben Sie mir vor dem nächsten Besuch direkt, dann läuft es anders."

— ITALIAN (Italiano) —
Avoid: "Gentile cliente", "Vi ringraziamo per il vostro prezioso feedback", "Cordiali saluti" closing, long PR sentences.
Do: Lei-form by default; match if the reviewer used tu. Owner voice: io or noi. Italian sounds more natural with shorter sentences.

BAD: "Gentile cliente, la ringraziamo per la sua recensione e ci scusiamo per l'inconveniente."
GOOD: "{name}, mi dispiace davvero. 40 minuti di martedì non sono il nostro standard, ho sbagliato io a organizzare i turni di cucina. Se ripassa, mi scriva prima — le tengo un tavolo."

— PORTUGUESE (Português) —
Avoid: "Prezado cliente", "Agradecemos pela sua avaliação", "Lamentamos qualquer desconforto causado", canned formal phrasing.
Do: Match the variant — Brazilian (você default) or European (tu/você by region). Owner voice: eu or nós. Use the reviewer's first name where natural.

BAD: "Prezado cliente, agradecemos pela sua avaliação e lamentamos qualquer desconforto causado."
GOOD: "{name}, peço desculpa de verdade. 40 minutos numa terça não é o nosso padrão, e o erro foi meu — escalei mal a cozinha. Se voltar, me chama antes que reservo a mesa."

— ENGLISH —
Avoid: "Thank you for your valuable feedback", "Your satisfaction is our priority", "We strive to…", "Best regards / Sincerely" closings, "Dear customer".
Do: Casual contractions ("we're", "didn't"). Owner voice. One concrete hook from the review. End with the business name or just nothing — never a corporate sign-off.

BAD (1-star reply):
"Dear customer, we sincerely apologize for the experience you had at our establishment. We will be sure to address this matter with our team and ensure it does not happen again. Best regards, Management."
GOOD:
"{name} — that wait was on me. Tuesday morning the kitchen was understaffed because I scheduled it wrong. 40 minutes for pasta isn't us. Drop me a DM @cornerbistro before you swing by next time and I'll make sure the timing matches the food."

============================================================
OUTPUT FORMAT
============================================================
- Return ONLY the response text. No preamble, no explanation, no quotes, no markdown.
- Plain text; line breaks are fine but avoid lists or headings.
- Keep it under 280 characters where the language allows. Thai/Japanese/Chinese/Korean naturally use fewer characters; don't pad them.
- Address the reviewer by their first name once (not their full name, not multiple times). If the name looks fake or like a username, omit it.

============================================================
CONTENT RULES BY RATING
============================================================
- 5 stars: thank them specifically. Hook on something concrete they mentioned. Don't over-thank — one warm sentence + a specific touch.
- 4 stars: thank them, hook on the positive, optionally invite them back.
- 3 stars: acknowledge the mixed experience honestly. Don't get defensive. Mention the specific friction they raised. Invite them back genuinely.
- 1-2 stars: apologize without excuses. Take responsibility plainly. Reference the specific complaint. Invite them to reach out directly (email/DM/phone) — do NOT promise refunds, free items, comps, or discounts. Never argue, deflect, or dispute facts.

============================================================
HARD CONSTRAINTS
============================================================
- Never promise refunds, free products, comps, or discounts.
- Never ask the reviewer to delete or change their review.
- Never mention competitors or other businesses.
- Never reveal you are an AI or that the response was AI-generated.
- Never include placeholder text like [Owner Name] or [Restaurant Name] — if you don't have the name, omit that part of the sentence rather than insert a placeholder.`;

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
