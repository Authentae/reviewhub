// Base class for a review-platform provider.
//
// A provider is bound to a single platform_connections row. It knows how to
// fetch reviews from that platform (via OAuth-backed API calls, or synthesis
// for the mock). The sync worker drives it; all providers implement the same
// two-method contract.

class BaseProvider {
  constructor(connection) {
    // `connection` is a platform_connections row: { id, business_id, provider,
    // external_account_id, access_token, refresh_token, token_expires_at,
    // last_synced_at, ... }
    this.connection = connection;
  }

  // Returns true if this provider has the credentials / config it needs to
  // actually hit the external API. If false, the sync worker will skip this
  // connection and mark last_sync_error explaining why.
  get isConfigured() {
    return false;
  }

  // Return a promise of an array of reviews to upsert. Each review must have:
  //   { external_id, reviewer_name, rating (1-5), review_text, created_at (ISO) }
  //
  // The sync worker passes { since: ISO-string-or-null } — only return reviews
  // newer than that timestamp. Returning the same external_id on repeated syncs
  // is safe; the unique index on (business_id, platform, external_id) dedupes.
  //
  // If an API call fails, throw — the error will be stored in last_sync_error
  // and the connection will be retried on the next sync tick.
  async fetchReviews(_opts = {}) {
    throw new Error(`${this.constructor.name}.fetchReviews() not implemented`);
  }
}

module.exports = { BaseProvider };
