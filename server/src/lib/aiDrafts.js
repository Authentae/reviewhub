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
HARASSMENT / HATE SPEECH / THREATS — DO NOT ENGAGE
============================================================
If the review contains any of:
- Racial / religious / ethnic / national-origin slurs aimed at the owner, staff, or customers
- Sexual or gendered slurs
- Threats of violence, death threats, doxxing
- Coordinated harassment language (multiple identical accounts piling on with the same wording)
- Defamatory claims of crimes (theft, sexual assault, etc.) without specific verifiable detail
- Group-targeted hostility — attacks on the customer category itself rather than the experience (e.g. "vegans deserve to suffer", "you people always X", "this religion always Y"). The review's complaint is the EXISTENCE of the audience, not the service.

Then DO NOT generate a polite reply. Politely engaging with hate speech or
threats legitimizes the attack and makes the owner look like they're
debating with a harasser in public. Instead, return a draft that says:

"This review appears to violate the platform's content policies. We've
reported it for removal. We will not be engaging with the content
itself."

— OR, if the platform context suggests reporting won't work, return:

"We've taken note of this review and are addressing it through proper
channels. We will not be commenting publicly on the specifics."

The owner can edit if they want a different tactic, but the DEFAULT
must be non-engagement, NOT polite reply. This protects them from
escalating an attack.

============================================================
DON'T ACCEPT THE REVIEWER'S CLAIMS AS PROVEN FACT
============================================================
The reviewer's text is one side of a story. The owner who is reading
your draft may know the claim is wrong, exaggerated, or even malicious
(coordinated review-bombing, competitor smears, customers lying about
what happened).

So:
- Acknowledge the experience the reviewer reports — never pretend it didn't happen.
- BUT do not write the draft as if the reviewer's version is established truth.
- Especially for accusations of overcharging, theft, mistreatment, food
  safety, or staff misconduct: use phrasing like "the experience you
  describe", "what you say happened", "we'd like to understand what
  occurred" — never "we're sorry we overcharged you" or "we apologize
  for the rude staff" unless that's been independently verified.
- If the review reads like coordinated brigading (account < 30 days
  old, no other reviews, vague accusation, identical phrasing across
  multiple recent reviews), keep the response calm, factual, and
  invite resolution offline. Don't escalate. Don't apologize for
  things you didn't do.

Example. Reviewer claims: "I was overcharged 200% on the bill, the staff was rude when I complained."
BAD draft: "We're so sorry we overcharged you and that our staff was rude. That's unacceptable."
GOOD draft: "Hi {name}, the experience you describe isn't what we want for any guest. Our prices are listed on the menu and on each table — could you email me at owner@example.com with your visit date and order so we can look it up? I want to understand what happened on your end."

The owner can always edit the draft to be more apologetic if they
agree with the claim. They cannot easily edit a draft that already
admitted fault to be neutral. Default to neutral; let the owner
escalate if appropriate.

============================================================
HIGH-DISCIPLINE SERVICES — DON'T APOLOGIZE FOR THE DISCIPLINE
============================================================
Some businesses succeed BECAUSE they are strict — driving schools,
martial arts dojos, language teachers, fitness coaches, behavior
modification programs, military-prep academies, professional-licence
prep schools. Reviews complaining "the instructor was too harsh /
made me cry / yelled at me" are sometimes complaints about the CORE
SERVICE the business provides, not failures of it.

When the review's complaint is the discipline / strictness / rigor of
instruction itself (not the rudeness or unprofessionalism of delivery),
DO NOT apologize for the discipline. Acknowledge the feedback,
re-frame the value, and offer to discuss DELIVERY improvements only.

Example. "The driving instructor yelled at me, made me cry, never coming back."
BAD: "We're so sorry the experience was upsetting. We'll review our methods."
GOOD: "Thanks for the feedback. We maintain a strict instruction style because it produces a 95% first-attempt road-test pass rate — but if there's a specific moment that felt out of line beyond that, please email me at owner@example.com so I can look into the delivery."

This protects businesses whose strictness IS their value proposition.

============================================================
COMPETITIVE SABOTAGE — VERIFY BEFORE APOLOGIZING
============================================================
In some industries (locksmiths, towing services, plumbing, AC repair,
roofing, moving), competitor brigading is endemic. Fake reviews from
brand-new accounts accusing a business of overcharging / damaging
property / not showing up — often written by competitors trying to
push customers to call them instead.

When the review:
- is from an account < 30 days old AND
- claims a specific service interaction (date/amount/damage) BUT
- provides no verifiable detail (no date, no invoice number, no
  staff member name, no service-call number) AND
- the business may not have a record of this customer

…suggest that the owner verify the visit / call happened before
replying. Default reply should NOT apologize. Default should be:

"We take customer concerns seriously. We don't have a record of this
service call — could you email me at owner@example.com with the date
and any invoice number so I can look into it?"

If the customer was real, they'll respond. If it's a sabotage account,
they won't, and the owner can flag the review for platform removal
without having admitted to fault publicly.

============================================================
FRENCH VARIANT DETECTION
============================================================
French splits into France-French (FR-FR) and Quebec-French (FR-CA),
plus Belgian and African-French. Quebec French has distinct vocabulary
and register; using France-French in Quebec reads as snooty / foreign
(same dynamic as Spain-Spanish in Mexico).

- France-French (FR-FR) markers: "voiture / faire les courses /
  parking / weekend / téléphone portable / ordinateur" Standard
  metropolitan vocabulary.
- Quebec-French (FR-CA) markers: "char" (car), "magasiner" (to shop),
  "fin de semaine" (weekend, NOT "le weekend"), "icitte" (here),
  "là-bas" frequent, "tantôt" (in a bit), occasional anglicisms ("c'est
  cute", "c'est full bon"), and tolerance for English code-switching.
- If the review uses Quebec markers → reply in Quebec register: shorter
  sentences, allow anglicism comfort ("merci pour le feedback"), tu-form
  much more freely than France would. Don't translate "char" back to
  "voiture" if quoting; quoting Quebec usage shows you understand the
  market.
- Belgian / African / Swiss French: default to neutral standard French
  unless clear regional markers ("septante" for 70 = Belgian/Swiss; "ça
  va aller" = West African).

============================================================
OFF-TOPIC REVIEWS — DON'T DEBATE
============================================================
Sometimes reviews are not about the business — they're about the
owner's personal beliefs, politics, religion, or unrelated grievances.
"The pastor's sermon was off-base." "I disagree with your political
posts." "I don't support businesses that fly that flag."

Don't engage substantively. Don't argue, don't agree, don't apologize
for the belief. Acknowledge the visit briefly + note that the review
platform is for service feedback. Example:

"Thanks for stopping by. This review channel is for our service; for
feedback on anything beyond that, we'd be happy to talk in person."

Same logic if review is about a NEIGHBORING business (rare but
happens — "the place next door is louder than yours") — acknowledge
politely without speaking for the neighbor.

============================================================
EDUCATIONAL CONTEXT — DON'T DEFAULT TO APOLOGY
============================================================
Sometimes a 2-3 star review is rooted in the customer's unfamiliarity
with the business, not in something the business did wrong.

Examples:
- "I went to a Korean BBQ and didn't know what to order — the staff
  could've been more helpful." (Solution = friendly explanation, not
  apology for staff.)
- "The pho was strange, lots of weird ingredients I didn't recognize."
  (Cultural unfamiliarity, not bad pho.)
- "The natural-wine tasted off." (The customer doesn't know natural
  wine ferments differently — solution is friendly education, not
  conceding the wine is bad.)
- "Why is this lassi so thick?" (Authentic lassi IS thick. Educate
  warmly.)

When the review reads as "I didn't understand X about your category"
rather than "you did Y wrong", default to friendly explanation in
the reply — not apology. Apologizing for the customer's confusion
makes the business look small and the customer look smaller.
"Thanks for trying us! Bibimbap is meant to be mixed up with the
egg before eating — next time ask for the recommended order, our
team is happy to walk you through" beats "We're sorry the experience
fell short."

============================================================
CHINESE VARIANT DETECTION
============================================================
Chinese splits Mainland Mandarin (Simplified script) vs Hong Kong /
Taiwan / Macau / overseas Chinese (Traditional script + different
vocabulary). Replying in the wrong variant reads as foreign and damages
trust in the same way Spain-Spanish does on a Mexico business.

- Mainland (zh-CN, Simplified) markers: 简体 characters (优 vs 優,
  发 vs 發, 网 vs 網), Mainland-specific vocabulary (软件 software,
  视频 video, 仪表盘 dashboard, 互联网 internet, 短信 SMS), 啊/呢/嘛
  particles, 您 stacking common in formal contexts.
- HK/Taiwan/Macau (zh-HK / zh-TW, Traditional) markers: 繁體 characters
  (優 not 优, 發 not 发, 網 not 网), Taiwan-specific vocabulary (軟體
  software, 影片 video, 控制板 dashboard, 網路 internet, 簡訊 SMS),
  HK Cantonese-influenced phrasing (係 instead of 是, 唔 instead of 不,
  嘅 possessive).
- If the reviewer wrote in Traditional characters → reply in Traditional
  with HK/TW vocabulary. If Simplified → reply in Simplified with
  Mainland vocabulary. Don't mix scripts in one reply.
- If the script is entirely English with one or two Chinese phrases,
  reply in English (not Chinese).

============================================================
SPANISH VARIANT DETECTION
============================================================
Spanish has wide regional variation. Spain-Spanish on a Mexican
business reads as foreign and damages trust. If the reviewer wrote
in Spanish:

- Spain (ES-ES) markers: "vosotros / habéis / coger / vale / venga
  / fíjate / hostia / curro / móvil / chaval". Use vosotros plural,
  Spain-specific vocabulary.
- Mexico (ES-MX) markers: "ahorita / qué padre / no manches / chido
  / órale / wey / mande / acá". Avoid "coger" entirely (means
  something obscene in MX). Use ustedes, not vosotros.
- Argentina (ES-AR) markers: "vos / che / boludo / re bueno / posta
  / laburo / mate / quilombo". Use voseo (vos sos / vos podés) NOT
  tú eres / tú puedes. Avoid Spain-vocab.
- Other LATAM (CO, CL, PE, VE, etc): neutral-LATAM register, ustedes
  for plural, no voseo, no Spain-isms.
- If you cannot tell from the review text, default to NEUTRAL LATIN
  AMERICAN — ustedes for plural, no vosotros, avoid clearly-regional
  vocab. This passes in most LATAM countries; Spain-Spanish is the
  one variant you should NOT default to since it reads as foreign
  in 90% of the Spanish-speaking world by population.

============================================================
PORTUGUESE VARIANT DETECTION
============================================================
Brazilian and European Portuguese diverge enough that the wrong
variant reads as foreign. If the reviewer wrote in Portuguese:
- Brazilian markers ("você", "celular", "ônibus", "trem", "legal",
  "tá", "vou", "vc", -ndo gerunds): use BR-PT register, você-form,
  shorter sentences. Owner voice: "a gente" or "nós."
- European markers ("tu" with TU-conjugation, "telemóvel", "autocarro",
  "comboio", "fixe", "estás", "vais", -ar/-er + a + infinitive instead
  of gerund): use PT-PT register, tu/você by social distance. Owner
  voice: "eu" or "nós."
- If you cannot tell from the review text, default to BR-PT (larger
  market) BUT keep the draft neutral enough that it would also pass
  in PT-PT (avoid "a gente" + gerund stacking that screams BR).

============================================================
VARY YOUR STRUCTURE — DON'T BE A FORMULA
============================================================
A real owner's replies vary in shape from review to review. They
don't always start with the customer's name. They don't always end
with "see you next time." They don't always have the same number of
sentences.

Customers who read multiple replies on the same business's profile
notice when every reply uses the same scaffolding. The trust they
extended to ONE warm reply collapses when they see it was a template.

So:
- Vary the OPENING: sometimes lead with the customer's name, sometimes
  with the reaction ("Honestly, …" / "ขอบคุณนะคะ — …" / "Wow —…"),
  sometimes with the specific detail you're hooking on.
- Vary the LENGTH: between ~25 and ~80 words depending on what the
  review gave you to work with. Don't pad to a target.
- Vary the CLOSING: sometimes end on the business name, sometimes on
  an invitation back, sometimes just with thanks. Never always the
  same.
- Vary the STRUCTURE: sometimes 2 sentences, sometimes 3, sometimes
  one longer paragraph.

This isn't randomness for its own sake — it's matching how a real
owner actually writes. Each reply is a specific human reading a
specific review.

============================================================
HARD CONSTRAINTS
============================================================
- Never promise refunds, free products, comps, or discounts.
- Never ask the reviewer to delete or change their review.
- Never mention competitors or other businesses.
- Never reveal you are an AI or that the response was AI-generated.
- Never include placeholder text like [Owner Name] or [Restaurant Name] — if you don't have the name, omit that part of the sentence rather than insert a placeholder.
- Never accept the reviewer's claim as established truth when the claim is an accusation of misconduct, fraud, theft, food safety, or staff abuse — see the "DON'T ACCEPT THE REVIEWER'S CLAIMS AS PROVEN FACT" section above.`;

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

// Cheap script-based heuristics for picking a template language when the AI
// path is unavailable AND the caller didn't pass an explicit preferredLang.
// Real language detection happens in the AI path. We only check for the
// scripts where falling back to English would be obviously wrong (CJK + Thai);
// Latin-script languages share the alphabet so heuristic-detection between
// English / Spanish / French is unreliable — those need explicit preferredLang.
function looksThai(s) {
  return typeof s === 'string' && /[฀-๿]/.test(s);
}
function looksJapanese(s) {
  // Hiragana or Katakana — kanji alone could be Chinese, so we require kana
  // to disambiguate. Practical for our use case: Japanese reviews always
  // include kana; standalone-kanji review text is a Chinese review.
  return typeof s === 'string' && /[぀-ゟ゠-ヿ]/.test(s);
}
function looksChinese(s) {
  // CJK Unified Ideographs without any Japanese kana → almost certainly Chinese.
  return typeof s === 'string' && /[一-鿿]/.test(s) && !looksJapanese(s);
}
function looksKorean(s) {
  return typeof s === 'string' && /[가-힣]/.test(s);
}

// Template pool — used when AI path isn't available or fails. Same
// style/sentiment mapping as the previous hard-coded drafts route.
//
// `preferredLang` is optional; when set, that language wins. When omitted,
// we heuristic-detect the script of the review text. Defaults to English
// when nothing matches.
function getTemplateDraft(review, preferredLang) {
  const hasName = typeof review.reviewer_name === 'string' && review.reviewer_name.trim().length > 0;
  const name = hasName ? review.reviewer_name : null;

  // Resolve locale. Explicit lang from caller wins. Otherwise scan the
  // review text for non-Latin scripts to pick the right pool. Latin-script
  // pairs (en/es/fr/de/it/pt) can't be heuristic-detected reliably so we
  // default to English when no explicit lang is given and the text is Latin.
  let lang = preferredLang;
  if (!lang) {
    if (looksThai(review.review_text)) lang = 'th';
    else if (looksJapanese(review.review_text)) lang = 'ja';
    else if (looksKorean(review.review_text)) lang = 'ko';
    else if (looksChinese(review.review_text)) lang = 'zh';
    else lang = 'en';
  }

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

  // Japanese pool. です/ます polite by default, owner voice 私 / 私たち,
  // avoid 拝啓/敬具 and 「貴重なご意見」-style canned phrases.
  const draftsJA = hasName ? {
    positive: [
      `${name}さん、嬉しい口コミをありがとうございます。スタッフ一同元気が出ました。またのお越しをお待ちしてます。`,
      `${name}さん、ありがとうございます。お気に召していただけて本当に嬉しいです。次回もお待ちしてます。`,
      `${name}さん、温かいお言葉ありがとうございます。私たちの励みになります。またお会いできるのを楽しみに。`,
      `${name}さん、わざわざ口コミをありがとうございます。次にいらっしゃる時もよろしくお願いします。`,
    ],
    negative: [
      `${name}さん、申し訳ありませんでした。私たちの基準に達しておらず、直接お話しできれば幸いです。お手数ですがご連絡ください。`,
      `${name}さん、教えていただきありがとうございます。改善すべき点としてしっかり受け止めます。`,
      `心からお詫びします、${name}さん。直接やり取りさせていただき、状況を改善したいです。ご連絡をお待ちしています。`,
      `${name}さん、ご期待に応えられず申し訳ありません。チャンスをいただければ — 私から直接ご連絡させてください。`,
    ],
    neutral: [
      `${name}さん、率直なご意見ありがとうございます。次回はもっと満足いただけるよう頑張ります。`,
      `${name}さん、貴重なお時間を割いていただき感謝します。改善のヒントになります。`,
      `${name}さん、ありがとうございます。次回は5つ星をいただけるよう努めます。`,
      `${name}さん、正直なご感想をありがとうございます。常に良くしていくつもりです。またのお越しをお待ちしてます。`,
    ],
  } : {
    positive: [
      '嬉しい口コミをありがとうございます。スタッフ一同元気が出ました。またのお越しをお待ちしてます。',
      'ありがとうございます。お気に召していただけて本当に嬉しいです。次回もお待ちしてます。',
      '温かいお言葉ありがとうございます。私たちの励みになります。またお会いできるのを楽しみに。',
      'わざわざ口コミをありがとうございます。次にいらっしゃる時もよろしくお願いします。',
    ],
    negative: [
      '申し訳ありませんでした。私たちの基準に達しておらず、直接お話しできれば幸いです。お手数ですがご連絡ください。',
      '教えていただきありがとうございます。改善すべき点としてしっかり受け止めます。',
      '心からお詫びします。直接やり取りさせていただき、状況を改善したいです。ご連絡をお待ちしています。',
      'ご期待に応えられず申し訳ありません。チャンスをいただければ — 私から直接ご連絡させてください。',
    ],
    neutral: [
      '率直なご意見ありがとうございます。次回はもっと満足いただけるよう頑張ります。',
      '貴重なお時間を割いていただき感謝します。改善のヒントになります。',
      'ありがとうございます。次回は5つ星をいただけるよう努めます。',
      '正直なご感想をありがとうございます。常に良くしていくつもりです。またのお越しをお待ちしてます。',
    ],
  };

  // Spanish pool. Match the reviewer's register; we default to tú which
  // reads as small-business friendly. Owner voice: yo / nosotros.
  const draftsES = hasName ? {
    positive: [
      `¡Mil gracias, ${name}! Nos alegra muchísimo que te haya gustado. Te esperamos pronto.`,
      `Gracias, ${name} — el equipo se ha alegrado un montón al leerlo. Vuelve cuando quieras.`,
      `Qué alegría leer esto, ${name}. Reseñas así nos dan energía para seguir. Hasta pronto.`,
      `Gracias por tomarte el tiempo, ${name}. Comentarios así son lo que nos motiva.`,
    ],
    negative: [
      `Lo siento mucho, ${name}. Eso no es lo que queremos para nadie. Escríbeme directamente y lo resolvemos.`,
      `Gracias por contárnoslo, ${name}. Tomamos nota y vamos a mejorar.`,
      `${name}, mil disculpas. Me gustaría hablarlo en persona — ponte en contacto y lo arreglamos.`,
      `${name}, lamento que no fuera la experiencia que esperabas. Dame la oportunidad de arreglarlo — escríbeme directamente.`,
    ],
    neutral: [
      `Gracias por la opinión sincera, ${name}. La próxima visita vamos a por las 5 estrellas.`,
      `Te agradezco que te tomes el tiempo, ${name}. Comentarios como el tuyo nos ayudan a afinar.`,
      `Gracias, ${name}. Volvemos a verte y nos esmeramos para que sea de 5 estrellas.`,
      `Gracias por la sinceridad, ${name}. Siempre buscando mejorar — ojalá volvamos a verte pronto.`,
    ],
  } : {
    positive: [
      '¡Mil gracias! Nos alegra muchísimo que te haya gustado. Te esperamos pronto.',
      'Gracias — el equipo se ha alegrado un montón al leerlo. Vuelve cuando quieras.',
      'Qué alegría leer esto. Reseñas así nos dan energía para seguir. Hasta pronto.',
      'Gracias por tomarte el tiempo. Comentarios así son lo que nos motiva.',
    ],
    negative: [
      'Lo siento mucho. Eso no es lo que queremos para nadie. Escríbeme directamente y lo resolvemos.',
      'Gracias por contárnoslo. Tomamos nota y vamos a mejorar.',
      'Mil disculpas. Me gustaría hablarlo en persona — ponte en contacto y lo arreglamos.',
      'Lamento que no fuera la experiencia que esperabas. Dame la oportunidad de arreglarlo — escríbeme directamente.',
    ],
    neutral: [
      'Gracias por la opinión sincera. La próxima visita vamos a por las 5 estrellas.',
      'Te agradezco que te tomes el tiempo. Comentarios así nos ayudan a afinar.',
      'Gracias. Volvemos a verte y nos esmeramos para que sea de 5 estrellas.',
      'Gracias por la sinceridad. Siempre buscando mejorar — ojalá volvamos a verte pronto.',
    ],
  };

  // Chinese (Simplified) pool. Match register: default 你 for casual,
  // owner voice 我 / 我们. Avoid 您 stacking and 感谢您宝贵的意见 corp-speak.
  const draftsZH = hasName ? {
    positive: [
      `${name}，谢谢你！看到你喜欢，我们都开心。下次再来啊。`,
      `谢谢${name}的好评，团队读到都笑了。期待再见到你。`,
      `${name}，太感谢了。这种评价是我们继续做下去的动力，下次见。`,
      `${name}，谢谢你抽时间写评价，这种反馈对我们意义很大。`,
    ],
    negative: [
      `${name}，真的很抱歉，这不是我们应有的水平。能私信联系我们一下吗？想直接处理这个问题。`,
      `谢谢${name}直接告诉我们。我们会认真改进。`,
      `${name}，向你诚恳道歉。希望能直接联系你，把这件事处理好。`,
      `${name}，让你失望了，对不起。给我们一次机会改正 — 私信联系我们就行。`,
    ],
    neutral: [
      `谢谢${name}的坦诚反馈，下次我们会做得更好。`,
      `${name}，感谢你抽时间写评价，这种意见对我们有帮助。`,
      `${name}，谢谢。下次争取拿到你的5星。`,
      `${name}，谢谢你直说。我们一直在调整，希望你能再来一次。`,
    ],
  } : {
    positive: [
      '谢谢你！看到你喜欢，我们都开心。下次再来啊。',
      '谢谢好评，团队读到都笑了。期待再见到你。',
      '太感谢了。这种评价是我们继续做下去的动力，下次见。',
      '谢谢你抽时间写评价，这种反馈对我们意义很大。',
    ],
    negative: [
      '真的很抱歉，这不是我们应有的水平。能私信联系我们一下吗？想直接处理这个问题。',
      '谢谢直接告诉我们。我们会认真改进。',
      '向你诚恳道歉。希望能直接联系你，把这件事处理好。',
      '让你失望了，对不起。给我们一次机会改正 — 私信联系我们就行。',
    ],
    neutral: [
      '谢谢坦诚反馈，下次我们会做得更好。',
      '感谢你抽时间写评价，这种意见对我们有帮助。',
      '谢谢。下次争取拿到你的5星。',
      '谢谢你直说。我们一直在调整，希望你能再来一次。',
    ],
  };

  // Korean pool. -습니다 polite form, owner voice 저 / 저희. Avoid stacked
  // honorifics and "고객님의 소중한 의견" canned phrases.
  const draftsKO = hasName ? {
    positive: [
      `${name}님, 정말 감사합니다. 좋게 봐주셔서 저희 팀 모두 힘이 나요. 다음에 또 뵙겠습니다.`,
      `${name}님 칭찬 덕분에 팀 분위기가 환해졌습니다. 또 들러주세요.`,
      `${name}님, 시간 내서 글 남겨주셔서 감사해요. 이런 리뷰가 저희를 계속 일하게 만듭니다.`,
      `${name}님, 마음 따뜻해지는 한마디 감사합니다. 곧 또 뵙겠습니다.`,
    ],
    negative: [
      `${name}님, 정말 죄송합니다. 저희 기준에 못 미친 부분이 있었네요. 직접 해결해 드리고 싶으니 DM이나 연락 부탁드립니다.`,
      `${name}님, 솔직하게 말씀해주셔서 감사합니다. 진지하게 받아들이고 고치겠습니다.`,
      `진심으로 사과드립니다, ${name}님. 직접 풀어드리고 싶으니 편한 방법으로 연락 주세요.`,
      `${name}님, 실망시켜드려 죄송합니다. 한번 더 기회 주시면 직접 챙기겠습니다 — 연락 주세요.`,
    ],
    neutral: [
      `${name}님, 솔직한 의견 감사합니다. 다음엔 더 잘하겠습니다.`,
      `${name}님, 시간 내서 글 써주셔서 감사해요. 이런 의견 덕에 부족한 데가 보입니다.`,
      `${name}님, 감사합니다. 다음엔 5점 받을 수 있도록 노력하겠습니다.`,
      `${name}님, 솔직하게 말씀해 주셔서 감사합니다. 항상 더 나아지려고 합니다 — 또 뵙길 바랍니다.`,
    ],
  } : {
    positive: [
      '정말 감사합니다. 좋게 봐주셔서 저희 팀 모두 힘이 나요. 다음에 또 뵙겠습니다.',
      '칭찬 덕분에 팀 분위기가 환해졌습니다. 또 들러주세요.',
      '시간 내서 글 남겨주셔서 감사해요. 이런 리뷰가 저희를 계속 일하게 만듭니다.',
      '마음 따뜻해지는 한마디 감사합니다. 곧 또 뵙겠습니다.',
    ],
    negative: [
      '정말 죄송합니다. 저희 기준에 못 미친 부분이 있었네요. 직접 해결해 드리고 싶으니 DM이나 연락 부탁드립니다.',
      '솔직하게 말씀해주셔서 감사합니다. 진지하게 받아들이고 고치겠습니다.',
      '진심으로 사과드립니다. 직접 풀어드리고 싶으니 편한 방법으로 연락 주세요.',
      '실망시켜드려 죄송합니다. 한번 더 기회 주시면 직접 챙기겠습니다 — 연락 주세요.',
    ],
    neutral: [
      '솔직한 의견 감사합니다. 다음엔 더 잘하겠습니다.',
      '시간 내서 글 써주셔서 감사해요. 이런 의견 덕에 부족한 데가 보입니다.',
      '감사합니다. 다음엔 5점 받을 수 있도록 노력하겠습니다.',
      '솔직하게 말씀해 주셔서 감사합니다. 항상 더 나아지려고 합니다 — 또 뵙길 바랍니다.',
    ],
  };

  // French pool. Vouvoiement default. Owner voice je / nous. Avoid "Cher client",
  // "Nous vous remercions de votre précieux avis", "Cordialement" sign-off.
  const draftsFR = hasName ? {
    positive: [
      `Merci ${name} ! On est ravis que ça vous ait plu. À très vite.`,
      `${name}, merci pour ce retour — toute l'équipe a souri en le lisant. Revenez quand vous voulez.`,
      `${name}, ça fait plaisir à lire. Des avis comme le vôtre nous donnent l'énergie de continuer.`,
      `${name}, merci d'avoir pris le temps. C'est ce qui fait avancer une petite équipe comme la nôtre.`,
    ],
    negative: [
      `${name}, désolé sincèrement. Ce n'est pas notre standard. Écrivez-moi directement et on va arranger ça.`,
      `Merci ${name} de nous l'avoir dit clairement. On prend la critique et on corrige.`,
      `Je m'excuse, ${name}. J'aimerais en discuter directement — contactez-moi et on règle ça.`,
      `${name}, désolé de vous avoir déçu. Donnez-nous une seconde chance — écrivez-moi en direct.`,
    ],
    neutral: [
      `Merci ${name} pour ce retour franc. La prochaine fois on vise les 5 étoiles.`,
      `${name}, merci d'avoir pris le temps. C'est exactement le genre de remarque qui nous aide à affiner.`,
      `Merci ${name}. Repassez nous voir, on va faire en sorte que ça vaille la 5e étoile.`,
      `Merci pour la franchise, ${name}. On essaie toujours de mieux faire — au plaisir de vous revoir.`,
    ],
  } : {
    positive: [
      'Merci beaucoup ! On est ravis que ça vous ait plu. À très vite.',
      'Merci pour ce retour — toute l\'équipe a souri en le lisant. Revenez quand vous voulez.',
      'Ça fait plaisir à lire. Des avis comme le vôtre nous donnent l\'énergie de continuer.',
      'Merci d\'avoir pris le temps. C\'est ce qui fait avancer une petite équipe comme la nôtre.',
    ],
    negative: [
      'Désolé sincèrement. Ce n\'est pas notre standard. Écrivez-moi directement et on va arranger ça.',
      'Merci de nous l\'avoir dit clairement. On prend la critique et on corrige.',
      'Je m\'excuse. J\'aimerais en discuter directement — contactez-moi et on règle ça.',
      'Désolé de vous avoir déçu. Donnez-nous une seconde chance — écrivez-moi en direct.',
    ],
    neutral: [
      'Merci pour ce retour franc. La prochaine fois on vise les 5 étoiles.',
      'Merci d\'avoir pris le temps. C\'est exactement le genre de remarque qui nous aide à affiner.',
      'Merci. Repassez nous voir, on va faire en sorte que ça vaille la 5e étoile.',
      'Merci pour la franchise. On essaie toujours de mieux faire — au plaisir de vous revoir.',
    ],
  };

  // German pool. du-form (matches the German marketing voice). Owner voice
  // ich / wir. Avoid "Sehr geehrter Kunde", "Mit freundlichen Grüßen",
  // "Wir bedauern den Vorfall zutiefst" Beamtendeutsch.
  const draftsDE = hasName ? {
    positive: [
      `${name}, danke dir! Schön, dass es dir gefallen hat. Bis bald.`,
      `${name}, das freut uns echt — das ganze Team hat sich beim Lesen gefreut. Komm gerne wieder.`,
      `${name}, das ist klasse zu hören. Solche Bewertungen geben uns Kraft, weiterzumachen.`,
      `${name}, danke fürs Schreiben. Genau das treibt ein kleines Team wie uns an.`,
    ],
    negative: [
      `${name}, das tut mir wirklich leid. Das ist nicht unser Standard. Schreib mir direkt und wir kriegen das hin.`,
      `${name}, danke dass du's klar sagst. Wir nehmen die Kritik an und arbeiten dran.`,
      `Ich entschuldige mich, ${name}. Würde das gerne direkt mit dir besprechen — meld dich, dann regeln wir's.`,
      `${name}, sorry dass wir dich enttäuscht haben. Gib uns noch eine Chance — schreib mir direkt.`,
    ],
    neutral: [
      `Danke ${name} für die ehrliche Rückmeldung. Beim nächsten Mal wollen wir die 5 Sterne.`,
      `${name}, danke fürs Schreiben. Genau solche Hinweise helfen uns, besser zu werden.`,
      `Danke ${name}. Komm gerne nochmal vorbei, wir geben alles für die fünf Sterne.`,
      `Danke für die Ehrlichkeit, ${name}. Wir versuchen, jeden Tag besser zu werden — bis bald.`,
    ],
  } : {
    positive: [
      'Danke dir! Schön, dass es dir gefallen hat. Bis bald.',
      'Das freut uns echt — das ganze Team hat sich beim Lesen gefreut. Komm gerne wieder.',
      'Das ist klasse zu hören. Solche Bewertungen geben uns Kraft, weiterzumachen.',
      'Danke fürs Schreiben. Genau das treibt ein kleines Team wie uns an.',
    ],
    negative: [
      'Das tut mir wirklich leid. Das ist nicht unser Standard. Schreib mir direkt und wir kriegen das hin.',
      'Danke dass du\'s klar sagst. Wir nehmen die Kritik an und arbeiten dran.',
      'Ich entschuldige mich. Würde das gerne direkt mit dir besprechen — meld dich, dann regeln wir\'s.',
      'Sorry dass wir dich enttäuscht haben. Gib uns noch eine Chance — schreib mir direkt.',
    ],
    neutral: [
      'Danke für die ehrliche Rückmeldung. Beim nächsten Mal wollen wir die 5 Sterne.',
      'Danke fürs Schreiben. Genau solche Hinweise helfen uns, besser zu werden.',
      'Danke. Komm gerne nochmal vorbei, wir geben alles für die fünf Sterne.',
      'Danke für die Ehrlichkeit. Wir versuchen, jeden Tag besser zu werden — bis bald.',
    ],
  };

  // Italian pool. Lei-form default. Owner voice io / noi. Avoid "Gentile cliente",
  // "Cordiali saluti", "Vi ringraziamo per il vostro prezioso feedback".
  const draftsIT = hasName ? {
    positive: [
      `Grazie ${name}! Felici che ti sia piaciuto. A presto.`,
      `${name}, grazie — il team ha sorriso leggendo. Torna quando vuoi.`,
      `${name}, fa davvero piacere leggerlo. Recensioni così ci danno la carica per continuare.`,
      `${name}, grazie per il tempo. È quello che fa andare avanti una piccola squadra come la nostra.`,
    ],
    negative: [
      `${name}, mi dispiace davvero. Non è il nostro standard. Scrivimi direttamente e sistemiamo la cosa.`,
      `Grazie ${name} per dircelo apertamente. Prendiamo la critica e correggiamo.`,
      `Mi scuso, ${name}. Vorrei parlarne direttamente — contattami e risolviamo.`,
      `${name}, mi spiace averti deluso. Dacci un'altra possibilità — scrivimi direttamente.`,
    ],
    neutral: [
      `Grazie ${name} per la sincerità. La prossima volta puntiamo alle 5 stelle.`,
      `${name}, grazie per il tempo. Note come la tua ci aiutano a sistemare i dettagli.`,
      `Grazie ${name}. Ripassa, faremo in modo che la prossima visita meriti le cinque.`,
      `Grazie per la franchezza, ${name}. Cerchiamo sempre di migliorare — a presto.`,
    ],
  } : {
    positive: [
      'Grazie! Felici che ti sia piaciuto. A presto.',
      'Grazie — il team ha sorriso leggendo. Torna quando vuoi.',
      'Fa davvero piacere leggerlo. Recensioni così ci danno la carica per continuare.',
      'Grazie per il tempo. È quello che fa andare avanti una piccola squadra come la nostra.',
    ],
    negative: [
      'Mi dispiace davvero. Non è il nostro standard. Scrivimi direttamente e sistemiamo la cosa.',
      'Grazie per dircelo apertamente. Prendiamo la critica e correggiamo.',
      'Mi scuso. Vorrei parlarne direttamente — contattami e risolviamo.',
      'Mi spiace averti deluso. Dacci un\'altra possibilità — scrivimi direttamente.',
    ],
    neutral: [
      'Grazie per la sincerità. La prossima volta puntiamo alle 5 stelle.',
      'Grazie per il tempo. Note come la tua ci aiutano a sistemare i dettagli.',
      'Grazie. Ripassa, faremo in modo che la prossima visita meriti le cinque.',
      'Grazie per la franchezza. Cerchiamo sempre di migliorare — a presto.',
    ],
  };

  // Portuguese pool. Brazilian register (você default — covers the largest
  // Lusophone market). Owner voice eu / nós. Avoid "Prezado cliente",
  // "Lamentamos qualquer desconforto causado".
  const draftsPT = hasName ? {
    positive: [
      `${name}, muito obrigado! Que bom que curtiu. Volta sempre.`,
      `${name}, valeu — o time ficou feliz de ler isso aí. Aparece quando quiser.`,
      `${name}, dá gosto de ler. Avaliação assim dá ânimo pra continuar.`,
      `${name}, obrigado por tirar um tempo. É o que move uma equipe pequena como a nossa.`,
    ],
    negative: [
      `${name}, peço desculpa de verdade. Não é o nosso padrão. Me chama direto que a gente resolve.`,
      `Valeu ${name} por dizer direto. A crítica entrou no nosso radar e vamos corrigir.`,
      `Peço desculpas, ${name}. Queria resolver isso direto com você — me manda mensagem.`,
      `${name}, desculpa ter te decepcionado. Me dá uma segunda chance — me chama no privado.`,
    ],
    neutral: [
      `Valeu ${name} pelo retorno sincero. Na próxima a gente vai atrás das 5 estrelas.`,
      `${name}, obrigado pelo tempo. Esse tipo de comentário ajuda a gente a afinar os detalhes.`,
      `Obrigado ${name}. Volta lá, vamos fazer o possível pra valer 5 estrelas.`,
      `Valeu pela sinceridade, ${name}. A gente sempre tenta melhorar — até a próxima.`,
    ],
  } : {
    positive: [
      'Muito obrigado! Que bom que curtiu. Volta sempre.',
      'Valeu — o time ficou feliz de ler isso aí. Aparece quando quiser.',
      'Dá gosto de ler. Avaliação assim dá ânimo pra continuar.',
      'Obrigado por tirar um tempo. É o que move uma equipe pequena como a nossa.',
    ],
    negative: [
      'Peço desculpa de verdade. Não é o nosso padrão. Me chama direto que a gente resolve.',
      'Valeu por dizer direto. A crítica entrou no nosso radar e vamos corrigir.',
      'Peço desculpas. Queria resolver isso direto com você — me manda mensagem.',
      'Desculpa ter te decepcionado. Me dá uma segunda chance — me chama no privado.',
    ],
    neutral: [
      'Valeu pelo retorno sincero. Na próxima a gente vai atrás das 5 estrelas.',
      'Obrigado pelo tempo. Esse tipo de comentário ajuda a gente a afinar os detalhes.',
      'Obrigado. Volta lá, vamos fazer o possível pra valer 5 estrelas.',
      'Valeu pela sinceridade. A gente sempre tenta melhorar — até a próxima.',
    ],
  };

  const POOLS = {
    en: draftsEN,
    th: draftsTH,
    ja: draftsJA,
    es: draftsES,
    zh: draftsZH,
    ko: draftsKO,
    fr: draftsFR,
    de: draftsDE,
    it: draftsIT,
    pt: draftsPT,
  };
  const drafts = POOLS[lang] || draftsEN;
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

// Reviewer-name sniff: detect cases where the platform-supplied name is
// junk and the model should omit the greeting rather than try to use it.
// Caught here so the AI doesn't produce "Hi N/A," / "Hi user12345," /
// "Hi 0," replies when it gets garbage from upstream platforms.
function isJunkReviewerName(raw) {
  if (typeof raw !== 'string') return true;
  const s = raw.trim();
  if (!s) return true;
  if (s.length > 80) return true; // someone pasted a paragraph into the name field
  // Common junk strings observed in the wild from scraped review feeds:
  if (/^(n\/?a|none|null|undefined|anonymous|guest|user|customer|reviewer)$/i.test(s)) return true;
  // Pure-digits "names" (e.g. "12345"):
  if (/^[\d_\-.]+$/.test(s)) return true;
  // Username-shaped: starts with user/anon/guest + digits/underscores ("user_8472")
  if (/^(user|usr|anon|guest|reviewer|customer)[\d_\-]+$/i.test(s)) return true;
  // Looks like an email address:
  if (/@/.test(s) && /\./.test(s)) return true;
  return false;
}

function buildUserMessage({ review, businessName, preferredLang }) {
  // Use the registry's display label so the AI sees "Wongnai" / "Tabelog
  // (食べログ)" / "Dianping (大众点评)" instead of bare lowercase IDs —
  // helps the model adapt tone to the platform's audience and convention.
  const { PLATFORM_META } = require('./platforms');
  const platformLabel = PLATFORM_META[review.platform]?.label || review.platform || '(unknown)';

  // When the caller passes a preferred language, surface it as an explicit
  // hint that overrides auto-detection (per SYSTEM_PROMPT). When omitted,
  // the prompt's "match the review's language" rule still applies.
  const langLine = preferredLang && LANG_NAMES[preferredLang]
    ? `Reply in: ${LANG_NAMES[preferredLang]}`
    : null;

  // Reviewer name handling: if the upstream value looks like junk, send
  // "(no name available)" so the prompt's "if the name looks fake, omit
  // it" rule can fire. Without this, the model would try to greet
  // "Hi user_12345," / "Hi N/A," etc.
  const reviewerLine = isJunkReviewerName(review.reviewer_name)
    ? 'Reviewer: (no name available — omit greeting by name)'
    : `Reviewer: ${review.reviewer_name}`;

  // Rating sanity. Ratings should be 1–5; defensively coerce out-of-range
  // or non-numeric inputs so the prompt doesn't say "Rating: NaN out of 5"
  // or "Rating: 7 out of 5" — both confuse the model and produce weird
  // drafts. Default to 5 (most common case) when junk arrives.
  const ratingNum = Number(review.rating);
  const safeRating = Number.isFinite(ratingNum) && ratingNum >= 1 && ratingNum <= 5
    ? Math.round(ratingNum)
    : 5;

  return [
    `Business: ${businessName || 'this business'}`,
    `Platform: ${platformLabel}`,
    reviewerLine,
    `Rating: ${safeRating} out of 5 stars`,
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
