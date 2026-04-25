// Google Business Profile review provider.
//
// Talks to the Business Profile APIs using the access_token stored on the
// platform_connections row by the OAuth callback (see routes/platforms.js).
// Refreshes the access_token when it's expired/expiring using the stored
// refresh_token.
//
// Why three endpoints:
//   1. mybusinessaccountmanagement.googleapis.com/v1/accounts
//      → one-time discovery of the user's account ID
//   2. mybusinessbusinessinformation.googleapis.com/v1/accounts/{id}/locations
//      → list of locations the user manages
//   3. mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews
//      → the reviews themselves (v4 is still the current reviews endpoint)
//
// For MVP: we fetch the FIRST location discovered for the account and sync
// reviews from it. Multi-location businesses pick one location per connection
// (the external_account_id on platform_connections holds the resolved
// accountId/locationId pair once discovered). Later we can add a picker UI
// for businesses with multiple locations.
//
// The Business Profile APIs require the account to be allow-listed with
// Google for the reviews endpoint; until that happens, calls return 403 and
// we surface that error in last_sync_error so the operator can apply.

const { BaseProvider } = require('./base');
const { run } = require('../../db/schema');
const googleOAuth = require('./googleOAuth');

const ACCOUNT_MGMT_URL  = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
const BIZ_INFO_BASE     = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const REVIEWS_BASE      = 'https://mybusiness.googleapis.com/v4';

// Refresh a token if it's expired or within this many seconds of expiry.
// 60s gives headroom for the subsequent API call without racing the expiry.
const REFRESH_EARLY_SEC = 60;

// Parse `token_expires_at` (ISO string) → Date. Returns null if missing.
function parseExpiry(isoLike) {
  if (!isoLike) return null;
  const d = new Date(isoLike);
  return isNaN(d.getTime()) ? null : d;
}

class GoogleProvider extends BaseProvider {
  get isConfigured() {
    // Configured at the deployment level (env vars). Per-connection creds
    // (access_token, refresh_token) are separate — checked at fetch time.
    return googleOAuth.isConfigured();
  }

  // Ensure the connection's access_token is fresh enough for the next call.
  // Returns the (possibly new) access_token. Persists any new token to the DB.
  async _ensureAccessToken() {
    const conn = this.connection;
    if (!conn.access_token) {
      throw new Error('Google connection has no access_token — re-authenticate via OAuth');
    }
    const expiry = parseExpiry(conn.token_expires_at);
    const now = new Date();
    const fresh = expiry && (expiry.getTime() - now.getTime()) > REFRESH_EARLY_SEC * 1000;
    if (fresh) return conn.access_token;

    if (!conn.refresh_token) {
      // No refresh token on file — we can't renew. This happens if the user
      // revoked the app in their Google account or if Google didn't issue a
      // refresh token (e.g. OAuth start omitted access_type=offline or
      // prompt=consent). Surface clearly so the user can reconnect.
      throw new Error('Google access token expired and no refresh_token available — reconnect Google in Settings');
    }

    let refreshed;
    try {
      refreshed = await googleOAuth.refreshAccessToken(conn.refresh_token);
    } catch (err) {
      if (err.revoked) {
        // The refresh token itself has been revoked — blow away the stored
        // credentials so the UI prompts the user to re-auth, and surface a
        // clear last_sync_error.
        run(
          `UPDATE platform_connections
             SET access_token = NULL, refresh_token = NULL, token_expires_at = NULL
           WHERE id = ?`,
          [conn.id]
        );
        throw new Error('Google authorization revoked — reconnect in Settings');
      }
      throw err;
    }

    // Persist new access_token + expires_at; refresh_token stays the same.
    run(
      `UPDATE platform_connections
         SET access_token = ?, token_expires_at = ?
       WHERE id = ?`,
      [refreshed.access_token, refreshed.expires_at, conn.id]
    );
    // Update the in-memory copy too so subsequent calls within this sync
    // tick don't re-refresh.
    this.connection.access_token = refreshed.access_token;
    this.connection.token_expires_at = refreshed.expires_at;
    return refreshed.access_token;
  }

  // Thin wrapper over fetch that threads the Authorization header and
  // translates non-2xx responses into informative errors.
  async _googleGet(url, accessToken) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const err = new Error(`Google API ${res.status}: ${body.slice(0, 300)}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return res.json();
  }

  // Discover the first (account, location) pair the user can manage. Cached
  // on the connection row in external_account_id as "accounts/X/locations/Y"
  // after first successful discovery so subsequent syncs skip the lookup.
  async _resolveLocationName(accessToken) {
    const cached = this.connection.external_account_id;
    // Already resolved to a full path? Use it as-is.
    if (cached && cached.startsWith('accounts/') && cached.includes('/locations/')) {
      return cached;
    }

    // 1. Account discovery
    const accountsResp = await this._googleGet(ACCOUNT_MGMT_URL, accessToken);
    const accounts = accountsResp.accounts || [];
    if (accounts.length === 0) {
      throw new Error('No Google Business Profile accounts available for this user');
    }
    // `accounts[i].name` is already "accounts/12345"
    const accountName = accounts[0].name;

    // 2. Location discovery. Read mask is required by the API; `name` is all
    // we need — the sync doesn't display per-location metadata (yet).
    const locUrl = `${BIZ_INFO_BASE}/${accountName}/locations?readMask=name&pageSize=10`;
    const locResp = await this._googleGet(locUrl, accessToken);
    const locations = locResp.locations || [];
    if (locations.length === 0) {
      throw new Error(`Google account ${accountName} has no locations configured`);
    }
    const locationName = locations[0].name; // e.g. "locations/67890"
    const fullName = `${accountName}/${locationName}`;

    // Cache on the connection row for subsequent syncs
    run(
      `UPDATE platform_connections SET external_account_id = ? WHERE id = ?`,
      [fullName, this.connection.id]
    );
    this.connection.external_account_id = fullName;
    return fullName;
  }

  // Translate a Google review object into the shape syncReviews expects.
  // Google's star values are strings: "ONE" / "TWO" / ... / "FIVE".
  _mapReview(r) {
    const STAR_MAP = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
    return {
      external_id: r.reviewId || r.name,
      reviewer_name: r.reviewer?.displayName || 'Anonymous',
      rating: STAR_MAP[r.starRating] || 3,
      review_text: r.comment || '',
      created_at: r.createTime || new Date().toISOString(),
    };
  }

  // PUT a reply back to Google. `externalReviewId` is the reviewId Google
  // gave us (stored in reviews.external_id); `comment` is the text to post.
  // PUT is idempotent — calling it again updates the existing reply rather
  // than creating a duplicate. Returns the server's echo of the reply.
  async replyToReview(externalReviewId, comment) {
    if (!this.isConfigured) {
      throw new Error('Google provider not configured');
    }
    if (!externalReviewId) throw new Error('reply requires external_id');
    if (typeof comment !== 'string' || !comment.trim()) {
      throw new Error('reply comment is required');
    }

    const accessToken = await this._ensureAccessToken();
    const locationName = await this._resolveLocationName(accessToken);
    const url = `${REVIEWS_BASE}/${locationName}/reviews/${externalReviewId}/reply`;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ comment: comment.trim() }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const err = new Error(`Google reply API ${res.status}: ${body.slice(0, 300)}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return res.json();
  }

  async fetchReviews({ since } = {}) {
    if (!this.isConfigured) {
      throw new Error('Google provider not configured: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
    }

    const accessToken = await this._ensureAccessToken();
    const locationName = await this._resolveLocationName(accessToken);

    // Fetch reviews. API orders newest-first by default. We page once — for
    // an active business the first page (50 reviews) covers a polling interval
    // easily. Deeper backfills are for the future.
    const url = `${REVIEWS_BASE}/${locationName}/reviews?pageSize=50`;
    const resp = await this._googleGet(url, accessToken);
    const reviews = resp.reviews || [];

    // Client-side since-filter — Google's API doesn't accept a `since` param
    // for this endpoint, so we fetch the first page and trim. Subsequent
    // pages are only needed on a full refresh (not yet implemented).
    const sinceTs = since ? new Date(since).getTime() : 0;
    return reviews
      .map((r) => this._mapReview(r))
      .filter((r) => new Date(r.created_at).getTime() > sinceTs);
  }
}

module.exports = { GoogleProvider };
