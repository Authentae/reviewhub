// TripAdvisor Content API provider (stub).
//
// Essential for hospitality (hotels, restaurants, attractions). Activation
// requires TRIPADVISOR_API_KEY from a TripAdvisor business account.
//
// API docs: https://tripadvisor-content-api.readme.io/reference/overview
//   GET https://api.content.tripadvisor.com/api/v1/location/{locationId}/reviews
//     ?key={API_KEY}&language=en
//
// Note: the Content API returns up to 5 most-recent reviews per request;
// there's no "since" filter — we dedupe server-side via the UNIQUE index on
// (business_id, platform, external_id).

const { BaseProvider } = require('./base');

class TripAdvisorProvider extends BaseProvider {
  get isConfigured() {
    return !!process.env.TRIPADVISOR_API_KEY;
  }

  async fetchReviews(/* { since } = {} */) {
    if (!this.isConfigured) {
      throw new Error('TripAdvisor provider not configured: set TRIPADVISOR_API_KEY');
    }
    // TODO: fetch(`https://api.content.tripadvisor.com/api/v1/location/${this.connection.external_account_id}/reviews?key=${process.env.TRIPADVISOR_API_KEY}`)
    //       → response.data[] → map to {external_id, reviewer_name, rating, review_text, created_at}
    throw new Error('TripAdvisor provider API integration not yet implemented');
  }
}

module.exports = { TripAdvisorProvider };
