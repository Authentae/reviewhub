// Yelp Fusion API provider (stub).
//
// Yelp's API is simpler than Google's — a single API key (server-side) replaces
// OAuth. Set YELP_API_KEY and fill in fetchReviews() with a call to
//   GET https://api.yelp.com/v3/businesses/{external_account_id}/reviews
// Note: Yelp Fusion only returns the 3 most recent reviews; full history
// requires their enterprise API.

const { BaseProvider } = require('./base');

class YelpProvider extends BaseProvider {
  get isConfigured() {
    return !!process.env.YELP_API_KEY;
  }

  async fetchReviews(/* { since } = {} */) {
    if (!this.isConfigured) {
      throw new Error('Yelp provider not configured: set YELP_API_KEY');
    }
    // TODO: fetch(`https://api.yelp.com/v3/businesses/${this.connection.external_account_id}/reviews`,
    //              { headers: { Authorization: `Bearer ${process.env.YELP_API_KEY}` } })
    //       → map response.reviews[] → review objects.
    throw new Error('Yelp provider API integration not yet implemented');
  }
}

module.exports = { YelpProvider };
