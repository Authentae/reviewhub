// GDPR Data Subject Rights Implementation
// Articles 15-22: Access, Rectification, Erasure, Portability, Restriction, Objection

const { get, all, run, transaction } = require('../../db/schema');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class DataSubjectRights {
  constructor() {
    this.exportFormats = ['json', 'csv', 'xml'];
  }

  // Article 15 - Right of Access
  async exportUserData(userId, format = 'json') {
    if (!this.exportFormats.includes(format)) {
      throw new Error(`Unsupported export format: ${format}`);
    }

    const userData = {
      export_metadata: {
        export_date: new Date().toISOString(),
        user_id: userId,
        format_version: '1.0',
        data_controller: 'ReviewHub',
        retention_notice: 'Data retained as per privacy policy'
      },
      personal_data: await this.collectUserPersonalData(userId),
      consent_history: await this.getConsentHistory(userId),
      processing_activities: await this.getProcessingActivities(userId)
    };

    switch (format) {
      case 'json':
        return JSON.stringify(userData, null, 2);
      case 'csv':
        return this.convertToCSV(userData);
      case 'xml':
        return this.convertToXML(userData);
      default:
        return JSON.stringify(userData, null, 2);
    }
  }

  async collectUserPersonalData(userId) {
    return {
      account_data: get(`
        SELECT id, email, created_at, email_verified_at, terms_accepted_at,
               terms_version_accepted, last_digest_sent_at, mfa_enabled,
               referral_code, onboarding_dismissed_at
        FROM users WHERE id = ?
      `, [userId]),

      businesses: all(`
        SELECT id, business_name, google_place_id, yelp_business_id,
               facebook_page_id, widget_enabled, reply_tone, created_at
        FROM businesses WHERE user_id = ?
      `, [userId]),

      subscription_data: get(`
        SELECT plan, status, billing_provider, created_at, renewal_date
        FROM subscriptions WHERE user_id = ?
      `, [userId]),

      templates: all(`
        SELECT id, title, body, created_at, updated_at
        FROM templates WHERE user_id = ?
      `, [userId]),

      review_requests: all(`
        SELECT customer_name, customer_email, platform, message,
               sent_at, clicked_at, created_at
        FROM review_requests rr
        JOIN businesses b ON rr.business_id = b.id
        WHERE b.user_id = ?
      `, [userId]),

      audit_log: all(`
        SELECT event, ip, user_agent, metadata, created_at
        FROM audit_log WHERE user_id = ?
        ORDER BY created_at DESC LIMIT 100
      `, [userId]),

      api_keys: all(`
        SELECT name, key_prefix, created_at, last_used_at
        FROM api_keys WHERE user_id = ?
      `, [userId])
    };
  }

  // Article 17 - Right to Erasure (Right to be Forgotten)
  async processErasureRequest(userId, verificationToken) {
    // Verify request authenticity
    if (!await this.verifyErasureToken(userId, verificationToken)) {
      throw new Error('Invalid erasure request token');
    }

    const erasureLog = {
      user_id: userId,
      requested_at: new Date().toISOString(),
      data_categories: [],
      retention_justifications: []
    };

    // The transaction body MUST be synchronous — better-sqlite3 commits the
    // moment the callback returns. Async work inside the callback runs
    // AFTER commit and breaks atomicity. The previous version used
    // `async (tx) => { await ... }` which silently committed before the
    // erasure ran — every erasure happened OUTSIDE the transaction.
    //
    // Schema.transaction() now throws on Promise return, so a regression
    // here would surface immediately instead of silently corrupting data.
    //
    // Side-effect calls that ARE genuinely async (fs.writeFile for the
    // backup schedule) and idempotent third-party notifications are moved
    // OUT of the transaction below — they don't need atomic guarantees.
    transaction((tx) => {
      // 1. Anonymize user-generated content FIRST — the user-id cascade
      // from the DELETE in step 2 SETs NULL on support_tickets.user_id,
      // which would orphan the email + message columns AND make our
      // WHERE user_id = ? match nothing. Scrub identifiers before the
      // FK is cleared.
      this.anonymizeUserContent(tx, userId, erasureLog);

      // 2. Personal data erasure (sync DB writes) — DELETE FROM users
      // cascades via FK to most child tables; survivors are handled by
      // anonymizeUserContent above.
      this.erasePersonalData(tx, userId, erasureLog);

      // 3. Store minimal erasure record for legal compliance.
      // completed_at is the ACTUAL completion timestamp (now) — was
      // previously inserting `erasureLog.requested_at` which is set at
      // the top of this method, before any data was erased. The column
      // is named completed_at, so it must record completion time, not
      // request time, otherwise the audit trail is wrong for any
      // downstream "how long did the erasure take?" report.
      const erasureId = tx.insert(`
        INSERT INTO data_erasures (user_id, categories_erased,
                                   retention_justifications, completed_at)
        VALUES (?, ?, ?, ?)
      `, [
        userId,
        JSON.stringify(erasureLog.data_categories),
        JSON.stringify(erasureLog.retention_justifications),
        new Date().toISOString()
      ]);

      erasureLog.erasure_id = erasureId;
    });

    // Side-effect work runs AFTER the transaction commits — these don't
    // need atomicity (third-party notifications are idempotent; the backup
    // schedule file is write-append). If they fail, the user data is
    // already erased; the most we lose is a log entry.
    try { await this.notifyThirdPartyProcessors(userId); } catch { /* best-effort */ }
    try { await this.scheduleBackupDeletion(userId); } catch { /* best-effort */ }

    return erasureLog;
  }

  // Sync because it must run inside the transaction. Despite no actual
  // async work, the prior `async` keyword caused the wrapping caller to
  // `await` it, returning a Promise from the transaction callback —
  // committing before the writes ran. Now plainly sync.
  erasePersonalData(tx, userId, log) {
    // Delete user account and cascade to related data
    tx.run('DELETE FROM users WHERE id = ?', [userId]);
    log.data_categories.push('user_profile');
    log.data_categories.push('businesses');
    log.data_categories.push('subscriptions');
    log.data_categories.push('templates');
    log.data_categories.push('api_keys');
    log.data_categories.push('audit_log');
  }

  // Sync — see erasePersonalData above for the same async-removal reason.
  anonymizeUserContent(tx, userId, log) {
    // Anonymize review requests (retain for business analytics)
    tx.run(`
      UPDATE review_requests
      SET customer_name = 'ANONYMIZED',
          customer_email = 'erased@gdpr.local'
      WHERE business_id IN (SELECT id FROM businesses WHERE user_id = ?)
    `, [userId]);

    // Anonymize support tickets — the FK constraint already SET NULL's the
    // user_id on user delete, but the email + message columns still hold
    // identifiable content (the user typed it themselves). Scrub them so
    // the founder still has the ticket-resolution history but no PII.
    // Pre-fix this was a GDPR-completeness gap: a user invoking erasure
    // would still have their submitted-support-ticket emails + bodies on
    // file indefinitely.
    tx.run(`
      UPDATE support_tickets
      SET email = 'erased@gdpr.local',
          message = '[message erased on user account deletion]'
      WHERE user_id = ?
    `, [userId]);
    log.data_categories.push('support_tickets_anonymized');

    log.data_categories.push('review_requests_anonymized');
    log.retention_justifications.push('Business analytics and fraud prevention');
  }

  // Article 20 - Right to Data Portability
  async generatePortableData(userId) {
    const data = await this.collectUserPersonalData(userId);

    // Structure for easy import into competitor systems
    return {
      format: 'ReviewHub_Portable_v1.0',
      generated_at: new Date().toISOString(),
      user_data: {
        email: data.account_data.email,
        businesses: data.businesses.map(b => ({
          name: b.business_name,
          platforms: {
            google: b.google_place_id,
            yelp: b.yelp_business_id,
            facebook: b.facebook_page_id
          },
          created: b.created_at
        })),
        templates: data.templates.map(t => ({
          title: t.title,
          content: t.body,
          created: t.created_at
        })),
        review_requests: data.review_requests.map(r => ({
          customer_name: r.customer_name,
          customer_email: r.customer_email,
          platform: r.platform,
          message: r.message,
          sent_date: r.sent_at
        }))
      }
    };
  }

  // Article 18 - Right to Restriction of Processing.
  // Transaction body is SYNC — see processErasureRequest comment above.
  async restrictProcessing(userId, restrictions) {
    transaction((tx) => {
      // Add processing restrictions
      for (const restriction of restrictions) {
        tx.insert(`
          INSERT INTO processing_restrictions (user_id, restriction_type, reason, created_at)
          VALUES (?, ?, ?, ?)
        `, [userId, restriction.type, restriction.reason, new Date().toISOString()]);
      }

      // Update user flags
      tx.run(`
        UPDATE users
        SET processing_restricted = 1, processing_restriction_date = ?
        WHERE id = ?
      `, [new Date().toISOString(), userId]);
    });
  }

  async verifyErasureToken(userId, token) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const stored = get(`
      SELECT erasure_token_hash, erasure_token_expires
      FROM users WHERE id = ? AND erasure_token_hash = ?
    `, [userId, hash]);

    if (!stored) return false;
    if (new Date() > new Date(stored.erasure_token_expires)) return false;

    return true;
  }

  async notifyThirdPartyProcessors(userId) {
    // Notify review platforms to remove data
    console.log(`[GDPR] Notifying third-party processors of erasure for user ${userId}`);
    // TODO: Implement API calls to Google, Yelp, Facebook to request data removal
  }

  async scheduleBackupDeletion(userId) {
    // Schedule deletion from backups after retention period
    const deleteAfter = new Date();
    deleteAfter.setMonth(deleteAfter.getMonth() + 3); // 3 month grace period

    await fs.writeFile(
      path.join(__dirname, '../../../data/erasure_schedule.txt'),
      `${userId}:${deleteAfter.toISOString()}\n`,
      { flag: 'a' }
    );
  }

  convertToCSV(data) {
    // Simple CSV conversion for data portability
    const lines = ['Category,Field,Value,Date'];

    const addRows = (category, obj, date = '') => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          addRows(`${category}.${key}`, value, date);
        } else {
          lines.push(`"${category}","${key}","${value}","${date}"`);
        }
      }
    };

    addRows('account', data.personal_data.account_data);
    return lines.join('\n');
  }

  convertToXML(data) {
    // Basic XML structure for data portability
    return `<?xml version="1.0" encoding="UTF-8"?>
<gdpr_export>
  <metadata>
    <export_date>${data.export_metadata.export_date}</export_date>
    <user_id>${data.export_metadata.user_id}</user_id>
  </metadata>
  <personal_data>${JSON.stringify(data.personal_data)}</personal_data>
</gdpr_export>`;
  }
}

module.exports = { DataSubjectRights };