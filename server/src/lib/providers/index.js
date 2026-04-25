// Provider registry.
//
// `getProvider(connection)` returns a provider instance for the connection.
//
// Mock-fallback policy:
//   - Development (NODE_ENV !== 'production'): if real creds are missing, fall
//     back to MockProvider so the sync pipeline demonstrates working behaviour
//     without external deps. This is the demo / local-dev default.
//   - Production: DO NOT fall back to mock unless the operator explicitly sets
//     ENABLE_MOCK_PROVIDER=1. Shipping fake reviews to real customers looks
//     like real data but isn't — the user would respond to reviews that never
//     existed, which is worse than showing them "platform not yet configured"
//     and surfacing the error in last_sync_error.
//
// Legacy: DISABLE_MOCK_PROVIDER=1 is still honoured (always forces real-only),
// so existing prod deployments that had it set are unaffected.

const { BaseProvider } = require('./base');
const { MockProvider } = require('./mock');
const { GoogleProvider } = require('./google');
const { YelpProvider } = require('./yelp');
const { FacebookProvider } = require('./facebook');
const { TripAdvisorProvider } = require('./tripadvisor');
const { TrustpilotProvider } = require('./trustpilot');
const { WongnaiProvider } = require('./wongnai');

// Map provider string → real implementation class.
// Adding a provider: implement a class extending BaseProvider in this dir,
// import it here, and add the {string → class} entry. The sync worker and
// routes pick it up automatically; no other changes needed.
const REGISTRY = {
  google: GoogleProvider,
  yelp: YelpProvider,
  facebook: FacebookProvider,
  tripadvisor: TripAdvisorProvider,
  trustpilot: TrustpilotProvider,
  wongnai: WongnaiProvider,
  mock: MockProvider,
};

// Mock is used when: explicit mock provider, OR real is unconfigured AND we're
// not in a context that forbids mocks.
function shouldUseMockFallback() {
  if (process.env.DISABLE_MOCK_PROVIDER) return false;
  if (process.env.NODE_ENV === 'production') {
    // Prod: mock only if operator has explicitly opted in.
    return !!process.env.ENABLE_MOCK_PROVIDER;
  }
  // Dev / test: default to mock fallback.
  return true;
}

function getProvider(connection) {
  const Cls = REGISTRY[connection.provider];
  if (!Cls) {
    throw new Error(`Unknown provider: ${connection.provider}`);
  }
  // If the user explicitly configured a mock connection, honour that regardless of env.
  if (connection.provider === 'mock') return new MockProvider(connection);

  const real = new Cls(connection);
  if (real.isConfigured) return real;
  if (shouldUseMockFallback()) return new MockProvider(connection);

  // Prod with no creds and no mock opt-in → return the real provider; its
  // fetchReviews() throws a helpful "not configured" error, which the sync
  // worker records as last_sync_error and surfaces to the user.
  return real;
}

// Convenience: is there any real (non-mock) configured provider in this env?
function hasAnyRealProvider() {
  return ['google', 'yelp', 'facebook'].some((p) => {
    try { return new REGISTRY[p]({}).isConfigured; } catch { return false; }
  });
}

module.exports = { getProvider, hasAnyRealProvider, BaseProvider };
