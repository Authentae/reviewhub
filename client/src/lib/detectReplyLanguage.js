// Client-side language detection for the free tools.
//
// Mirror of the server's auto-detect behavior so the user can SEE which
// language the AI will reply in before they hit Generate. The actual
// reply language is decided server-side (lib/aiDrafts.js); this is purely
// UI feedback.
//
// Returns a result for the 10 languages we support natively:
//   en (default fallback) · th · ja · ko · zh · es · fr · de · it · pt
//
// Detection priority:
//   1. Script-based (Thai/Japanese/Korean/Chinese have unique scripts —
//      the most reliable signal)
//   2. Latin-script word-list for ES/FR/DE/IT/PT (>=2 high-frequency
//      function-word matches)
//   3. Fallback: English (or whatever the UI lang is set to)
//
// Returns: { code, name, flag, autoDetected }
//   - code: ISO 639-1 ('th', 'en', etc.) — what gets sent as `lang` to the API
//   - name: display name in English ('Thai')
//   - flag: emoji flag for the chip
//   - autoDetected: true if we matched a non-English language; false if we
//     fell back to the UI default

const SUPPORTED = {
  en: { name: 'English',    flag: '🇬🇧' },
  th: { name: 'Thai',       flag: '🇹🇭' },
  ja: { name: 'Japanese',   flag: '🇯🇵' },
  ko: { name: 'Korean',     flag: '🇰🇷' },
  zh: { name: 'Chinese',    flag: '🇨🇳' },
  es: { name: 'Spanish',    flag: '🇪🇸' },
  fr: { name: 'French',     flag: '🇫🇷' },
  de: { name: 'German',     flag: '🇩🇪' },
  it: { name: 'Italian',    flag: '🇮🇹' },
  pt: { name: 'Portuguese', flag: '🇵🇹' },
};

// Latin-script function-word lists — same ones the AI prompt uses to
// identify language. Pick 5-6 high-frequency words per language; >=2
// matches = strong signal.
const LATIN_PATTERNS = [
  { code: 'es', words: ['el', 'la', 'que', 'de', 'no', 'es', 'con', 'una', 'para'] },
  { code: 'fr', words: ['le', 'la', 'de', 'un', 'une', 'est', 'pour', 'avec', 'sont'] },
  { code: 'de', words: ['der', 'die', 'das', 'und', 'ist', 'nicht', 'ein', 'eine', 'mit'] },
  { code: 'it', words: ['il', 'la', 'di', 'che', 'non', 'è', 'per', 'con', 'sono'] },
  { code: 'pt', words: ['o', 'a', 'de', 'que', 'não', 'é', 'para', 'com', 'uma'] },
];

export default function detectReplyLanguage(text, fallbackLang = 'en') {
  if (typeof text !== 'string' || text.trim().length < 4) {
    return makeResult(fallbackLang, false);
  }

  // 1. Script-based detection — bulletproof for non-Latin scripts
  if (/[฀-๿]/.test(text)) return makeResult('th', true);   // Thai
  if (/[぀-ゟ゠-ヿ]/.test(text)) return makeResult('ja', true); // Hiragana/Katakana
  if (/[가-힯]/.test(text)) return makeResult('ko', true);   // Hangul
  // CJK ideographs — could be Japanese kanji or Chinese hanzi. If we already
  // matched hiragana/katakana above, we returned 'ja'. Pure CJK without kana
  // is Chinese.
  if (/[一-鿿]/.test(text)) return makeResult('zh', true);

  // 2. Latin-script word-list detection
  // Pad with spaces so we match whole words, not substrings ("le" inside "blue")
  const padded = ' ' + text.toLowerCase().replace(/[^a-zàáâäçéèêëíîïñóôöúûüß\s]/g, ' ') + ' ';
  for (const { code, words } of LATIN_PATTERNS) {
    const hits = words.filter((w) => padded.includes(' ' + w + ' ')).length;
    if (hits >= 2) return makeResult(code, true);
  }

  // 3. Fallback — UI default (or 'en' if not specified)
  return makeResult(fallbackLang, false);
}

function makeResult(code, autoDetected) {
  const meta = SUPPORTED[code] || SUPPORTED.en;
  return {
    code,
    name: meta.name,
    flag: meta.flag,
    autoDetected,
  };
}
