import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { translations, LANGUAGES } from '../i18n/translations';

const LANG_KEY = 'reviewhub_lang';

// Pick the best-matching supported language from the browser's preferred
// list (navigator.languages is an ordered most-preferred → least array).
// Match on the primary subtag only, so "zh-TW" maps to "zh" and "pt-BR" to
// "pt". If nothing matches, fall back to English.
function detectBrowserLanguage() {
  try {
    const prefs = (navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || 'en']);
    for (const pref of prefs) {
      const primary = String(pref).toLowerCase().split('-')[0];
      if (translations[primary]) return primary;
    }
  } catch { /* SSR / older browsers */ }
  return 'en';
}

const I18nContext = createContext({ t: (k) => k, lang: 'en', setLang: () => {}, languages: LANGUAGES });

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const stored = localStorage.getItem(LANG_KEY);
    // Validate stored language is one we support
    if (stored && translations[stored]) return stored;
    // No explicit preference → auto-detect from browser
    return detectBrowserLanguage();
  });

  const setLang = useCallback((code) => {
    if (!translations[code]) return;
    localStorage.setItem(LANG_KEY, code);
    setLangState(code);
  }, []);

  // Keep <html lang="..."> in sync with selected language for accessibility
  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  // t(key, varsOrFallback, vars) — look up a translation and substitute {var}.
  //
  // Two supported signatures:
  //   t('key')                            — plain lookup, falls back to en, then to key string
  //   t('key', { name: 'Tom' })           — interpolate {name} from vars
  //   t('key', 'English fallback')        — render fallback if key is missing in BOTH current locale and en
  //   t('key', 'English fallback', vars)  — fallback + interpolation
  //
  // The `string-as-second-arg` form was widespread in the codebase (~60 call
  // sites in claim/owner/ownerResponse components) under the assumption it
  // was the fallback. Without this overload, those components render literal
  // key strings ("claim.signInToClaim") to users — visible UX bug.
  const t = useCallback((key, varsOrFallback = {}, varsArg = {}) => {
    const dict = translations[lang] || translations.en;
    const isFallbackString = typeof varsOrFallback === 'string';
    const fallback = isFallbackString ? varsOrFallback : null;
    const vars = isFallbackString ? varsArg : varsOrFallback;
    let str = dict[key] ?? translations.en[key] ?? fallback ?? key;
    if (vars && typeof vars === 'object') {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replaceAll(`{${k}}`, v);
      }
    }
    return str;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ t, lang, setLang, languages: LANGUAGES }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
