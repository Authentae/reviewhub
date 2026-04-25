// Trustpilot Invitation/Reviews API provider (stub).
//
// Essential for ecommerce. Trustpilot's Business API is OAuth-backed:
// TRUSTPILOT_API_KEY and TRUSTPILOT_API_SECRET get you a short-lived
// access token via the OAuth 2.0 client-credentials grant, which you then
// use against the reviews endpoint.
//
// API docs: https://developers.trustpilot.com/business-units-api
//   GET https://api.trustpilot.com/v1/business-units/{businessUnitId}/reviews
//     ?apikey={API_KEY}&perPage=100
//
// OAuth grant is only required for write operations (replies, invitations).
// Public review reads need only the API key.

const { BaseProvider } = require('./base');

class TrustpilotProvider extends BaseProvider {
  get isConfigured() {
    return !!process.env.TRUSTPILOT_API_KEY;
  }

  async fetchReviews(/* { since } = {} */) {
    if (!this.isConfigured) {
      throw new Error('Trustpilot provider not configured: set TRUSTPILOT_API_KEY');
    }
    // TODO: fetch(`https://api.trustpilot.com/v1/business-units/${this.connection.external_account_id}/reviews?apikey=${process.env.TRUSTPILOT_API_KEY}&perPage=100`)
    //       → response.reviews[] → map fields.
    throw new Error('Trustpilot provider API integration not yet implemented');
  }
}

module.exports = { TrustpilotProvider };
