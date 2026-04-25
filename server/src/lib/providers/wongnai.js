// Wongnai (Thailand food/restaurants) provider (stub).
//
// Wongnai is the largest restaurant-discovery and review platform in
// Thailand. Their Partner API is not public — access requires a formal
// partnership agreement with Wongnai (contact: partners@wongnai.com).
//
// When credentials arrive, they'll most likely be:
//   WONGNAI_API_KEY + WONGNAI_PARTNER_ID
//
// Until then, this stub exists so the provider registry has a named slot
// for Wongnai — users in Thailand see "Wongnai (coming soon)" in Settings
// rather than "no Thai platforms available".
//
// Endpoint (expected shape based on standard partner APIs):
//   GET https://partner-api.wongnai.com/v1/businesses/{bizId}/reviews
//     Headers: Authorization: Bearer {token}, X-Partner-Id: {partnerId}

const { BaseProvider } = require('./base');

class WongnaiProvider extends BaseProvider {
  get isConfigured() {
    return !!(process.env.WONGNAI_API_KEY && process.env.WONGNAI_PARTNER_ID);
  }

  async fetchReviews(/* { since } = {} */) {
    if (!this.isConfigured) {
      throw new Error('Wongnai provider not configured: set WONGNAI_API_KEY and WONGNAI_PARTNER_ID');
    }
    throw new Error('Wongnai provider API integration not yet implemented — partner API access required');
  }
}

module.exports = { WongnaiProvider };
