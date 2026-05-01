// Backed by better-sqlite3 (native SQLite). Persistent on disk, synchronous API.
// This module exports the same helper surface as the previous sql.js implementation
// (getDb, run, get, all, insert, saveDb, transaction) so routes need no changes.
//
// Why the swap: sql.js loads the whole DB into memory and rewrites the entire file
// on every mutation (export → writeFile). That's O(DB size) per write and blocks
// horizontal scaling. better-sqlite3 writes pages directly and supports WAL, giving
// real concurrent reads and incremental writes.

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// DATABASE_PATH overrides the default on-disk location. Tests set this to a
// unique tmp file (or an explicit :memory: value) so they run in isolation.
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/reviews.db');

let db = null;

// saveDb() is a no-op with better-sqlite3 (file is always persistent).
// Kept for API compatibility and for the graceful-shutdown path in index.js.
function saveDb() {
  // intentional no-op
}

async function getDb() {
  if (db) return db;

  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  // Open (or create) the DB file. better-sqlite3 opens synchronously.
  db = new Database(DB_PATH);

  // Connection-level PRAGMAs:
  // - WAL: concurrent readers while a writer is active; faster writes.
  // - foreign_keys ON: enforce FK constraints (off by default in SQLite).
  // - synchronous NORMAL: fsync less aggressively (safe with WAL).
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  initSchema();

  // Integrity check on boot. `quick_check` is much faster than the full
  // `integrity_check` and covers 99% of corruption (page-level issues,
  // torn writes, missing indexes). Skipped during tests — the in-memory
  // DB can't be corrupt, and the probe costs real time at boot.
  // If corruption is detected we abort boot rather than serve from a
  // bad DB. The operator should restore from a backup (`npm run backup`
  // + backups/ directory) and investigate.
  if (process.env.NODE_ENV !== 'test' && process.env.DATABASE_PATH !== ':memory:') {
    try {
      const row = db.prepare('PRAGMA quick_check').get();
      const status = Object.values(row || {})[0];
      if (status && status !== 'ok') {
        console.error(`[DB] integrity check FAILED: ${status}`);
        throw new Error(`SQLite integrity check failed: ${status}`);
      }
      console.log('[DB] integrity check: ok');
    } catch (err) {
      // If the check itself throws (e.g. locked), log and continue — we'd
      // rather stay up than hard-fail on a transient issue.
      console.warn(`[DB] integrity check could not run: ${err.message}`);
    }
  }
  return db;
}

function initSchema() {
  // CREATE TABLE IF NOT EXISTS — idempotent, safe to run every boot.
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      business_name TEXT NOT NULL,
      google_place_id TEXT,
      yelp_business_id TEXT,
      facebook_page_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      reviewer_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      review_text TEXT,
      sentiment TEXT,
      response_text TEXT,
      external_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'trial',
      price REAL DEFAULT 24.00,
      renewal_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_business_id ON reviews(business_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_platform ON reviews(platform);
    CREATE INDEX IF NOT EXISTS idx_reviews_sentiment ON reviews(sentiment);
    CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);
    CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON businesses(user_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_biz_created ON reviews(business_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(business_id, rating);
    CREATE INDEX IF NOT EXISTS idx_reviews_responded ON reviews(business_id, response_text);
    CREATE INDEX IF NOT EXISTS idx_reviews_biz_sentiment ON reviews(business_id, sentiment);

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);

    -- Platform integrations. One row per (business, provider) pair.
    -- For real OAuth-backed providers, access_token / refresh_token are populated.
    -- For the mock provider (no credentials needed), tokens stay NULL.
    CREATE TABLE IF NOT EXISTS platform_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      external_account_id TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at TEXT,
      last_synced_at TEXT,
      last_sync_error TEXT,
      reviews_synced_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(business_id, provider)
    );
    CREATE INDEX IF NOT EXISTS idx_platform_conn_business ON platform_connections(business_id);

    -- Dedup guard for sync: within a business + platform, external_id is unique.
    -- Partial index so rows without external_id (manually-created reviews) don't
    -- interfere with each other.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_external
      ON reviews(business_id, platform, external_id)
      WHERE external_id IS NOT NULL;

    -- Audit log of security-sensitive user actions. Read-only from the app's
    -- perspective; rows are never updated or deleted (except via user-account
    -- deletion, which cascades). user_id may be NULL for events that happened
    -- before we know the user (e.g. failed login for an email that does/does
    -- not exist -- we never record the attempted email to avoid turning the
    -- log itself into an enumeration oracle).
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      event TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_log(event, created_at DESC);
    -- Partial index on ip so admin forensic lookups by IP scale; NULL rows
    -- (pre-auth failures that we refused to attribute to an IP) stay out.
    CREATE INDEX IF NOT EXISTS idx_audit_ip ON audit_log(ip, created_at DESC) WHERE ip IS NOT NULL;

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6b7280',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);

    CREATE TABLE IF NOT EXISTS review_tags (
      review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (review_id, tag_id)
    );
    CREATE INDEX IF NOT EXISTS idx_review_tags_review ON review_tags(review_id);
    CREATE INDEX IF NOT EXISTS idx_review_tags_tag ON review_tags(tag_id);

    CREATE TABLE IF NOT EXISTS review_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'google',
      message TEXT,
      token_hash TEXT NOT NULL UNIQUE,
      sent_at TEXT DEFAULT (datetime('now')),
      clicked_at TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_rr_business ON review_requests(business_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_rr_token ON review_requests(token_hash);

    -- Auto-respond rules: when a new review matches all non-null criteria,
    -- automatically post the configured response_text.
    -- Criteria columns are nullable — NULL means "match any".
    CREATE TABLE IF NOT EXISTS auto_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      platform TEXT DEFAULT NULL,
      min_rating INTEGER DEFAULT NULL,
      max_rating INTEGER DEFAULT NULL,
      sentiment TEXT DEFAULT NULL,
      response_text TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auto_rules_user ON auto_rules(user_id, enabled);

    -- Outbound webhooks: fire a signed POST to a user-configured URL when
    -- specific events happen (e.g. new review, review responded).
    -- 'events' is a JSON array of event strings so we can add new event types
    -- without a schema change. 'secret' is a random hex string stored in plain
    -- text (not hashed) because we need it to sign outbound payloads.
    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      events TEXT NOT NULL DEFAULT '["review.created"]',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      last_triggered_at TEXT DEFAULT NULL,
      last_status INTEGER DEFAULT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id);

    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
      event TEXT NOT NULL,
      status INTEGER,
      response_snippet TEXT DEFAULT NULL,
      triggered_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);

    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      last_used_at TEXT DEFAULT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
    CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
  `);

  // Column-level migrations — idempotent via PRAGMA table_info checks
  migrateAddColumn('reviews', 'updated_at', 'TEXT DEFAULT NULL', true,
    "UPDATE reviews SET updated_at = created_at WHERE updated_at IS NULL");
  migrateAddColumn('reviews', 'note', 'TEXT DEFAULT NULL', true);
  migrateAddColumn('templates', 'updated_at', 'TEXT DEFAULT NULL', true,
    "UPDATE templates SET updated_at = created_at WHERE updated_at IS NULL");
  migrateAddColumn('users', 'notif_new_review', 'INTEGER NOT NULL DEFAULT 1');
  migrateAddColumn('users', 'notif_negative_alert', 'INTEGER NOT NULL DEFAULT 1');
  migrateAddColumn('users', 'notif_weekly_summary', 'INTEGER NOT NULL DEFAULT 0');

  // Email verification + password reset columns.
  // Tokens are stored as SHA-256 hashes; plaintext tokens are only ever sent via email.
  // *_expires_at columns are ISO 8601 strings (UTC) for comparison with datetime('now').
  migrateAddColumn('users', 'email_verified_at', 'TEXT DEFAULT NULL', true);
  migrateAddColumn('users', 'email_verify_token_hash', 'TEXT DEFAULT NULL');
  migrateAddColumn('users', 'email_verify_sent_at', 'TEXT DEFAULT NULL');
  migrateAddColumn('users', 'password_reset_token_hash', 'TEXT DEFAULT NULL');
  migrateAddColumn('users', 'password_reset_expires_at', 'TEXT DEFAULT NULL');

  // Two-factor auth (email OTP). When enabled, login returns a short-lived
  // "pending" token and requires a 6-digit code emailed to the user. Recovery
  // codes are stored in a separate table so they can be individually marked used.
  // Terms acceptance audit trail. The point of these columns isn't access
  // control — it's EVIDENCE. If a customer later claims "I never agreed to
  // your Terms," the audit row answers with: timestamp, version of Terms
  // they saw, IP address, User-Agent. That's the difference between
  // "my Terms are enforceable" and "court throws out the case on formation
  // grounds." Kept on the user row rather than a separate table because
  // there's only ever one acceptance per user (re-acceptance on material
  // Terms changes creates a NEW audit_log entry; the version column here
  // reflects the LATEST accepted version).
  migrateAddColumn('users', 'terms_accepted_at', 'TEXT DEFAULT NULL');
  migrateAddColumn('users', 'terms_version_accepted', 'TEXT DEFAULT NULL');
  migrateAddColumn('users', 'terms_accept_ip', 'TEXT DEFAULT NULL');
  migrateAddColumn('users', 'terms_accept_ua', 'TEXT DEFAULT NULL');
  migrateAddColumn('users', 'age_confirmed', 'INTEGER NOT NULL DEFAULT 0');

  // Inbound email forwarding secret. Per-user random hex used as the
  // local part of the forwarding address: reviews+<secret>@reviewhub.review.
  // When a review platform emails the SMB owner about a new review and the
  // owner forwards that email to their personal alias, our inbound
  // endpoint parses the message and ingests it as a review. Lazily
  // generated on first request via /api/inbound/address (see routes/inbound.js).
  migrateAddColumn('users', 'inbound_email_secret', 'TEXT DEFAULT NULL', true);

  // Preferred locale for transactional + scheduled emails. Captured from
  // Accept-Language at registration; foreground emails (verify, reset, MFA,
  // email-change, erasure) prefer the live request locale, but background
  // jobs (weekly digest, follow-up requests, new-review notifications) have
  // no req object, so they read this column. NULL means default to English.
  migrateAddColumn('users', 'preferred_lang', "TEXT DEFAULT NULL");

  // Password-change timestamp — used by the auth middleware to invalidate
  // JWTs issued BEFORE the user changed their password. Without this, an
  // attacker with a stolen-but-still-within-TTL JWT keeps access indefinitely
  // after the legit user rotates their password. After a password change,
  // we reject any JWT whose `iat` is older than `password_changed_at`.
  migrateAddColumn('users', 'password_changed_at', 'TEXT DEFAULT NULL');

  // Email change flow. When a user requests to change their email, we stash
  // the pending new address + a one-time-use hashed token on their row. The
  // token is emailed to the NEW address. Clicking the link flips the user's
  // email. Using dedicated columns (not overloading email_verify_token_hash)
  // keeps the two flows distinct — a pending email change shouldn't block
  // or invalidate a separately-issued verification for the existing email.
  migrateAddColumn('users', 'pending_email', 'TEXT DEFAULT NULL');
  migrateAddColumn('users', 'pending_email_token_hash', 'TEXT DEFAULT NULL');
  migrateAddColumn('users', 'pending_email_expires_at', 'TEXT DEFAULT NULL');

  // Track when we last sent each user their weekly digest so the scheduler
  // is idempotent across restarts — without this, restarting the server
  // mid-week resets the timer and the user never receives that week's digest.
  migrateAddColumn('users', 'last_digest_sent_at', 'TEXT DEFAULT NULL');

  migrateAddColumn('users', 'mfa_enabled', 'INTEGER NOT NULL DEFAULT 0', true);
  migrateAddColumn('users', 'mfa_code_hash', 'TEXT DEFAULT NULL');
  migrateAddColumn('users', 'mfa_code_expires_at', 'TEXT DEFAULT NULL');
  migrateAddColumn('users', 'mfa_last_sent_at', 'TEXT DEFAULT NULL');

  // Billing: plan tier (free/starter/pro/business) and billing-provider IDs.
  // Provider-neutral so the billing abstraction can plug in Stripe, Paddle,
  // LemonSqueezy, or a regional processor (Omise for Thai PromptPay, etc.)
  // without schema changes. `billing_provider_id` holds the customer ID at
  // whatever provider is active; `billing_subscription_id` holds the
  // subscription ID there. Swapping providers is a migration not a schema
  // change.
  migrateAddColumn('subscriptions', 'plan', "TEXT NOT NULL DEFAULT 'free'", true);
  migrateAddColumn('subscriptions', 'billing_provider', 'TEXT DEFAULT NULL');
  migrateAddColumn('subscriptions', 'billing_provider_id', 'TEXT DEFAULT NULL');
  migrateAddColumn('subscriptions', 'billing_subscription_id', 'TEXT DEFAULT NULL');
  migrateAddColumn('subscriptions', 'cancel_at', 'TEXT DEFAULT NULL');
  // Monthly AI-draft quota tracking. `ai_drafts_period_start` is the first
  // day of the current billing month (YYYY-MM-DD); when a draft request
  // comes in during a new month, the counter is reset. `ai_drafts_used` is
  // the count within the current period. Keeping it on the subscription row
  // (not a separate table) because reads happen on every draft and it's
  // one value per user.
  migrateAddColumn('subscriptions', 'ai_drafts_used', 'INTEGER NOT NULL DEFAULT 0');
  migrateAddColumn('subscriptions', 'ai_drafts_period_start', 'TEXT DEFAULT NULL');
  migrateAddColumn('businesses', 'widget_enabled', 'INTEGER NOT NULL DEFAULT 0');
  migrateAddColumn('reviews', 'pinned', 'INTEGER NOT NULL DEFAULT 0');
  migrateAddColumn('auto_rules', 'match_keywords', 'TEXT DEFAULT NULL');
  migrateAddColumn('reviews', 'flagged', 'INTEGER NOT NULL DEFAULT 0');
  migrateAddColumn('reviews', 'sentiment_override', 'INTEGER NOT NULL DEFAULT 0');
  migrateAddColumn('reviews', 'status', 'TEXT DEFAULT NULL');
  migrateAddColumn('reviews', 'responded_at', 'TEXT DEFAULT NULL');
  // Marks a row as injected by the demo-seed (POST /reviews/seed). Lets the
  // clear-demo endpoint wipe just the seeded rows without touching real
  // reviews, and lets the dashboard surface a "Clear demo data" button only
  // when there's something to clear.
  migrateAddColumn('reviews', 'is_demo', 'INTEGER NOT NULL DEFAULT 0');
  migrateAddColumn('users', 'active_business_id', 'INTEGER DEFAULT NULL');
  migrateAddColumn('auto_rules', 'tag_id', 'INTEGER DEFAULT NULL');
  // Auto follow-up: if a review request hasn't been clicked after N days, resend once.
  // follow_up_after_days=0 means disabled. Stored on users so the setting persists.
  migrateAddColumn('users', 'follow_up_after_days', 'INTEGER NOT NULL DEFAULT 0');
  migrateAddColumn('review_requests', 'follow_up_sent_at', 'TEXT DEFAULT NULL');
  // Partial index for the follow-up scanner (see jobs/followUpRequests.js).
  // Rows move out of the partial index as soon as clicked_at OR follow_up_sent_at
  // fill in, so the index stays proportional to pending-follow-up work only.
  db.exec(`CREATE INDEX IF NOT EXISTS idx_rr_pending_followup
           ON review_requests(business_id, sent_at)
           WHERE clicked_at IS NULL AND follow_up_sent_at IS NULL;`);

  // Schema metadata — key/value store for flagging one-shot migrations that
  // can't be expressed as column additions. Idempotency is enforced by
  // writing a row on first run and checking for its presence on subsequent.
  db.exec(`CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    applied_at TEXT DEFAULT (datetime('now'))
  );`);

  // One-shot: on the first boot after the follow-up feature ships, mark every
  // review_request older than 30 days as already-followed-up. This prevents
  // the scheduler from firing retroactive follow-ups to months-old customers
  // on first run. The in-job MAX_AGE_DAYS guard handles the same concern in
  // code, but stamping the rows makes the guarantee durable even if the
  // guard is removed or tuned later. Idempotent via schema_meta.
  {
    const flag = db.prepare(`SELECT 1 FROM schema_meta WHERE key = 'follow_up_backfill_v1'`).get();
    if (!flag) {
      const info = db.prepare(
        `UPDATE review_requests
           SET follow_up_sent_at = datetime('now')
         WHERE follow_up_sent_at IS NULL
           AND clicked_at IS NULL
           AND sent_at < datetime('now', '-30 days')`
      ).run();
      db.prepare(`INSERT INTO schema_meta (key, value) VALUES ('follow_up_backfill_v1', ?)`).run(String(info.changes));
      if (info.changes > 0) {
        console.log(`[DB] One-shot: stamped ${info.changes} pre-feature review_request(s) as already-followed-up to prevent retroactive spam`);
      }
    }
  }

  // One-shot: backfill is_demo=1 for rows that were inserted by the demo
  // seed BEFORE the is_demo column existed. Without this, the "Clear demo
  // data" button never appears for users who clicked "Try with demo data"
  // before today's deploy — their seeded rows have is_demo=0 (the column
  // default at migration time) so demo_count is 0 and the button stays
  // hidden, leaving them stuck. Signal: the seed always creates a business
  // named exactly 'The Corner Bistro' and the seeded reviewer_names are a
  // closed set (Sarah M., James T., Emily R., Marcus D., Linda K.,
  // Chris B., Angela W., David P., Michelle S., Tom H., Rachel N.,
  // Kevin L.). Both signals together avoid false positives if a real
  // business happens to be called The Corner Bistro.
  {
    const flag = db.prepare(`SELECT 1 FROM schema_meta WHERE key = 'is_demo_backfill_v1'`).get();
    if (!flag) {
      const info = db.prepare(
        `UPDATE reviews
           SET is_demo = 1
         WHERE is_demo = 0
           AND business_id IN (SELECT id FROM businesses WHERE business_name = 'The Corner Bistro')
           AND reviewer_name IN (
             'Sarah M.','James T.','Emily R.','Marcus D.','Linda K.','Chris B.',
             'Angela W.','David P.','Michelle S.','Tom H.','Rachel N.','Kevin L.'
           )`
      ).run();
      db.prepare(`INSERT INTO schema_meta (key, value) VALUES ('is_demo_backfill_v1', ?)`).run(String(info.changes));
      if (info.changes > 0) {
        console.log(`[DB] One-shot: marked ${info.changes} pre-existing demo-seed review(s) as is_demo=1 so the "Clear demo data" button surfaces for users who tried demo before the column existed`);
      }
    }
  }

  // Onboarding checklist: dismissed_at set when user clicks "dismiss" or when
  // all steps complete. NULL = still show on dashboard.
  migrateAddColumn('users', 'onboarding_dismissed_at', 'TEXT DEFAULT NULL');

  // Browser extension token — stored as SHA-256 hash; the plaintext is only
  // shown once at generation time. One token per user (regenerate to rotate).
  // Separate from the api_keys table because this token is available on all
  // plans (including Free) and has a single narrow scope: draft review replies
  // from within the Chrome extension.
  migrateAddColumn('users', 'extension_token_hash', 'TEXT DEFAULT NULL');
  migrateAddColumn('users', 'extension_token_created_at', 'TEXT DEFAULT NULL');

  // Affiliate / referral tracking. Every user gets a short human-readable
  // referral code auto-assigned at first /auth/me hit (see auth.js). When
  // a new user signs up with ?ref=<code>, we record who referred them via
  // referred_by_user_id. Payout integration (LemonSqueezy affiliate API or
  // manual Stripe transfers) is separate — this is just the data plumbing.
  migrateAddColumn('users', 'referral_code', 'TEXT DEFAULT NULL');
  migrateAddColumn('users', 'referred_by_user_id', 'INTEGER DEFAULT NULL');
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL;`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by_user_id);`);

  // GDPR Compliance columns
  migrateAddColumn('users', 'processing_restricted', 'INTEGER NOT NULL DEFAULT 0');
  migrateAddColumn('users', 'processing_restriction_date', 'TEXT DEFAULT NULL');
  migrateAddColumn('users', 'analytics_opt_out', 'INTEGER NOT NULL DEFAULT 0');
  migrateAddColumn('users', 'erasure_token_hash', 'TEXT DEFAULT NULL');
  migrateAddColumn('users', 'erasure_token_expires', 'TEXT DEFAULT NULL');
  migrateAddColumn('users', 'data_portability_requested_at', 'TEXT DEFAULT NULL');

  // Drop UNIQUE constraint on businesses.user_id so Business-plan users can own
  // multiple locations. SQLite doesn't support ALTER TABLE DROP CONSTRAINT, so
  // we do the standard recreate-and-swap approach inside a transaction.
  // Idempotent: the pragma check detects whether the constraint still exists.
  try {
    const info = db.pragma('table_info(businesses)');
    const indices = db.pragma('index_list(businesses)');
    const hasUnique = indices.some(idx => {
      if (!idx.unique) return false;
      const cols = db.pragma(`index_info(${idx.name})`);
      return cols.length === 1 && cols[0].name === 'user_id';
    });
    if (hasUnique) {
      console.log('[DB] Migration: removing UNIQUE constraint on businesses.user_id');
      db.exec(`
        PRAGMA foreign_keys = OFF;
        BEGIN;
        CREATE TABLE businesses_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          business_name TEXT NOT NULL,
          google_place_id TEXT,
          yelp_business_id TEXT,
          facebook_page_id TEXT,
          widget_enabled INTEGER NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO businesses_new SELECT id, user_id, business_name, google_place_id, yelp_business_id, facebook_page_id, COALESCE(widget_enabled, 0), created_at FROM businesses;
        DROP TABLE businesses;
        ALTER TABLE businesses_new RENAME TO businesses;
        CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON businesses(user_id);
        COMMIT;
        PRAGMA foreign_keys = ON;
      `);
    }
  } catch (err) {
    console.error('[DB] Migration: failed to drop businesses.user_id unique constraint:', err.message);
  }

  // Audit log retention. Kept long enough for the 1-year rolling window that
  // covers security reviews, compliance audits, and dispute lookbacks. Older
  // rows are trimmed at boot so the table doesn't grow unboundedly on a
  // long-lived deployment. Configurable via AUDIT_RETENTION_DAYS env var;
  // default 365. Setting it to 0 disables trimming.
  try {
    const daysRaw = process.env.AUDIT_RETENTION_DAYS;
    const days = daysRaw === undefined ? 365 : parseInt(daysRaw, 10);
    if (Number.isFinite(days) && days > 0) {
      const info = db.prepare(
        `DELETE FROM audit_log WHERE created_at < datetime('now', ?)`
      ).run(`-${days} days`);
      if (info.changes > 0) {
        console.log(`[DB] audit_log: trimmed ${info.changes} row(s) older than ${days} days`);
      }
    }
  } catch (err) {
    console.warn('[DB] audit_log trim skipped:', err.message);
  }

  // Webhook de-dup: LemonSqueezy retries on network error and rare cases of
  // duplicate delivery exist. We record every accepted webhook's event_id
  // and reject a repeat with 200 (so the provider stops retrying) without
  // re-running the reconcile. A short-lived table, trimmed by created_at
  // at boot (see below) — we only care about recent duplicates.
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        event_id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        event_name TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_webhook_created ON webhook_events(created_at);
    `);
    // Trim events older than 30 days — LS retry window is much shorter, but
    // 30 days gives comfortable headroom and the row is tiny.
    db.exec(`DELETE FROM webhook_events WHERE created_at < datetime('now', '-30 days')`);
  } catch (err) {
    console.error('[DB] webhook_events table creation:', err.message);
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_mfa_recovery_user ON mfa_recovery_codes(user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mfa_recovery_lookup
        ON mfa_recovery_codes(user_id, code_hash);
    `);
  } catch (err) {
    console.error('[DB] MFA recovery codes table creation:', err.message);
  }

  // GDPR Compliance Tables - Critical for EU operations
  try {
    db.exec(`
      -- GDPR Consent Management
      CREATE TABLE IF NOT EXISTS user_consents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        consent_type TEXT NOT NULL,
        granted INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, consent_type)
      );
      CREATE INDEX IF NOT EXISTS idx_user_consents_user ON user_consents(user_id);

      -- GDPR Consent Audit Trail (immutable)
      CREATE TABLE IF NOT EXISTS consent_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        consent_type TEXT NOT NULL,
        granted INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        privacy_policy_version TEXT,
        method TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_consent_audit_user ON consent_audit(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_consent_audit_type ON consent_audit(consent_type, created_at DESC);

      -- GDPR Data Erasure Records
      CREATE TABLE IF NOT EXISTS data_erasures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        categories_erased TEXT NOT NULL,
        retention_justifications TEXT,
        completed_at TEXT DEFAULT (datetime('now')),
        erasure_token_hash TEXT,
        verified_identity INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_erasures_date ON data_erasures(completed_at);

      -- Processing Restrictions (GDPR Article 18)
      CREATE TABLE IF NOT EXISTS processing_restrictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        restriction_type TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        lifted_at TEXT DEFAULT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_restrictions_user ON processing_restrictions(user_id);

      -- Privacy Policy Versions
      CREATE TABLE IF NOT EXISTS privacy_policy_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        effective_date TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- GDPR Article 33/34 breach notifications (operator-published)
      CREATE TABLE IF NOT EXISTS breach_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        incident_id TEXT NOT NULL UNIQUE,
        notification_date TEXT NOT NULL,
        description TEXT NOT NULL,
        affected_data TEXT,
        mitigation_measures TEXT,
        contact_dpo TEXT,
        public_notification INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_breach_public ON breach_notifications(public_notification, notification_date DESC);
    `);
  } catch (err) {
    console.error('[DB] GDPR compliance tables creation:', err.message);
  }

  // ── Business owner claim + public review responses ──────────────────────
  // A logged-in user can claim a business listing by submitting a pending
  // claim. An admin reviews and approves (or denies). Once approved, the
  // claimant becomes a verified owner and may post a single public response
  // per review on that business. Claims are scoped per (user_id, business_id)
  // pair: a user can only have ONE active claim per business at a time.
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS business_claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending',
        evidence TEXT,
        denial_reason TEXT,
        reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_claims_user ON business_claims(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_claims_business ON business_claims(business_id, status);
      CREATE INDEX IF NOT EXISTS idx_claims_status ON business_claims(status, created_at DESC);
      -- Only one active (pending or approved) claim per (user, business).
      -- Denied claims may pile up if the user re-applies; partial index allows that.
      CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_active
        ON business_claims(user_id, business_id)
        WHERE status IN ('pending', 'approved');

      CREATE TABLE IF NOT EXISTS review_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
        owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        response_text TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(review_id)
      );
      CREATE INDEX IF NOT EXISTS idx_review_responses_review ON review_responses(review_id);
      CREATE INDEX IF NOT EXISTS idx_review_responses_owner ON review_responses(owner_user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_review_responses_business ON review_responses(business_id);
    `);
  } catch (err) {
    console.error('[DB] business_claims / review_responses table creation:', err.message);
  }

  // Index token hashes so verify/reset lookups are O(log n) even at scale.
  // Partial indexes (WHERE … IS NOT NULL) keep them tiny — only rows with active tokens.
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email_verify_token
             ON users(email_verify_token_hash)
             WHERE email_verify_token_hash IS NOT NULL`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_password_reset_token
             ON users(password_reset_token_hash)
             WHERE password_reset_token_hash IS NOT NULL`);
  } catch (err) {
    console.error('[DB] Token index creation:', err.message);
  }
}

// Add a column if it doesn't already exist; optionally run a back-fill statement afterwards.
function migrateAddColumn(table, column, definition, logMigration = false, backfillSql = null) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (cols.some(c => c.name === column)) return;
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    if (backfillSql) db.exec(backfillSql);
    if (logMigration) console.log(`[DB] Migration: added ${column} column to ${table}`);
  } catch (err) {
    console.error(`[DB] Migration error (${table}.${column}):`, err.message);
  }
}

// Coerce BigInt → Number. better-sqlite3 may return BigInt for rowids past 2^53,
// which our id space will never reach, but the defensive cast keeps parity with
// the previous implementation and avoids surprise type mismatches downstream.
function toNumber(v) {
  return typeof v === 'bigint' ? Number(v) : v;
}

// Helper: run a write statement
function run(sql, params = []) {
  db.prepare(sql).run(...params);
}

// Helper: get first row (or null)
function get(sql, params = []) {
  const row = db.prepare(sql).get(...params);
  return row === undefined ? null : row;
}

// Helper: get all rows
function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

// Helper: insert and return lastInsertRowid as Number
function insert(sql, params = []) {
  const info = db.prepare(sql).run(...params);
  return toNumber(info.lastInsertRowid);
}

// Helper: run multiple writes in a single SQLite transaction.
// The callback receives a `tx` object with run() and insert() (same semantics
// as the module-level helpers). If the callback throws, the transaction rolls back.
//
// We wrap with better-sqlite3's db.transaction() which handles BEGIN/COMMIT/ROLLBACK
// and nested savepoints correctly.
//
// IMPORTANT: better-sqlite3's transactions are SYNCHRONOUS. If `fn` is an
// async function (returns a Promise), the transaction commits the moment the
// Promise is RETURNED — before any of its `await` chain has actually run.
// All the awaited writes then happen OUTSIDE the transaction, defeating the
// atomicity guarantee. Detect this and throw loudly instead of silently
// corrupting data — the calling code needs to refactor to sync.
function transaction(fn) {
  const wrapped = db.transaction((innerFn) => {
    const tx = {
      run: (sql, params = []) => {
        db.prepare(sql).run(...params);
      },
      insert: (sql, params = []) => {
        const info = db.prepare(sql).run(...params);
        return toNumber(info.lastInsertRowid);
      },
    };
    const result = innerFn(tx);
    if (result && typeof result.then === 'function') {
      throw new Error(
        'transaction() callback returned a Promise. better-sqlite3 transactions ' +
        'are synchronous — async work inside the callback runs AFTER commit, ' +
        'breaking atomicity. Refactor the callback to be synchronous.'
      );
    }
    return result;
  });
  return wrapped(fn);
}

module.exports = { getDb, run, get, all, insert, saveDb, transaction };
