// Facebook Pages / Graph API provider (stub).
//
// Requires a Facebook App, page-level OAuth with pages_read_user_content
// permission (which needs app review for production use on pages Claude
// doesn't administer). Fill in fetchReviews() with:
//   GET https://graph.facebook.com/v18.0/{page_id}/ratings
//     ?access_token={page_access_token}&fields=created_time,rating,review_text,reviewer
//
// Requires FACEBOOK_APP_ID and FACEBOOK_APP_SECRET plus per-page access
// tokens stored in platform_connections.access_token.

const { BaseProvider } = require('./base');

class FacebookProvider extends BaseProvider {
  get isConfigured() {
    return !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
  }

  async fetchReviews(/* { since } = {} */) {
    if (!this.isConfigured) {
      throw new Error('Facebook provider not configured: set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET');
    }
    throw new Error('Facebook provider API integration not yet implemented');
  }
}

module.exports = { FacebookProvider };
