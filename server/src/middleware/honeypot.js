// Honeypot middleware — zero-friction bot defence for public form endpoints.
//
// How it works:
// - The matching client form renders an invisible <input name="website" />
//   that is positioned off-screen, aria-hidden, tabindex=-1, autocomplete=off.
// - Real users never see it, never tab to it, never type in it.
// - Naive form-filling bots scrape all inputs by name and fill the ones that
//   look meaningful ("website" is a classic target). When they POST, the
//   honeypot field is non-empty.
// - This middleware checks the field. If filled, return a fake-success
//   response (200 with the same shape the route would normally return on
//   success) so the bot thinks it worked and moves on. We do NOT proceed
//   to the actual handler.
// - Real users always submit with the field empty → middleware passes
//   through to next() and the real handler runs unchanged.
//
// We respond with 200 (not 4xx) on purpose: a 4xx would tell the bot
// "honeypot detected, try harder". A fake 200 wastes the attacker's
// budget on confirmation runs while never actually creating a row.
//
// Usage:
//   router.post('/path', honeypot({ fakeBody: { ok: true } }), handler);
//
// `fakeBody` is the JSON the route normally returns on success — match
// the shape so the bot's success-detection heuristics also fire.
function honeypot({ field = 'website', fakeBody = { ok: true } } = {}) {
  return function honeypotMiddleware(req, res, next) {
    const v = req.body?.[field];
    // Empty string OR missing → real user, pass through.
    // Non-empty (any truthy value) → bot, fake success.
    if (v == null || v === '') return next();
    // Add a tiny random delay (50-300ms) so the response time profile
    // matches a real submission and the bot can't trivially detect the
    // honeypot by timing. Cheap on the server, irrelevant to attackers.
    const delay = 50 + Math.floor(Math.random() * 250);
    setTimeout(() => {
      // Don't log to stdout/audit — the audit log is for legitimate
      // events. Sentry would be over-alerting too. Just silently 200.
      res.status(200).json(fakeBody);
    }, delay);
  };
}

module.exports = { honeypot };
