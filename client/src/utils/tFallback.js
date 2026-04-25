// Small helper for components that ship with English copy ahead of the
// translations.js update. The repo's t(key) returns the key itself when a
// string is missing, which means `t('x') || 'fallback'` never falls back.
// withFallback(t) returns a function that returns `fallback` instead when
// t(key) === key (i.e. unresolved). Once the keys land in translations.js,
// the helper transparently returns the localized strings.
export function makeT(t) {
  return (key, fallback, vars) => {
    const out = t(key, vars || {});
    if (out === key && typeof fallback === 'string') return fallback;
    return out;
  };
}
