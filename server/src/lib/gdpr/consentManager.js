// GDPR Consent Management System
// CRITICAL: Must be implemented within 30 days for EU compliance

const { get, run, insert, transaction } = require('../../db/schema');
const crypto = require('crypto');

class ConsentManager {
  constructor() {
    this.consentTypes = [
      'essential',           // Strictly necessary for service operation
      'analytics',           // Usage analytics and performance monitoring
      'marketing',           // Email marketing and promotional communications
      'third_party',         // Data sharing with review platforms
      'profiling'            // Automated decision making for AI features
    ];
  }

  // Record user consent with full GDPR audit trail
  async recordConsent(userId, consentType, granted, req) {
    if (!this.consentTypes.includes(consentType)) {
      throw new Error(`Invalid consent type: ${consentType}`);
    }

    const consentRecord = {
      user_id: userId,
      consent_type: consentType,
      granted: granted ? 1 : 0,
      ip_address: this.getClientIP(req),
      user_agent: req.headers['user-agent'],
      privacy_policy_version: await this.getCurrentPrivacyPolicyVersion(),
      method: 'explicit_checkbox',
      timestamp: new Date().toISOString()
    };

    // Store in audit trail
    const auditId = insert(`
      INSERT INTO consent_audit (
        user_id, consent_type, granted, ip_address, user_agent,
        privacy_policy_version, method, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      consentRecord.user_id,
      consentRecord.consent_type,
      consentRecord.granted,
      consentRecord.ip_address,
      consentRecord.user_agent,
      consentRecord.privacy_policy_version,
      consentRecord.method,
      consentRecord.timestamp
    ]);

    // Update current consent status
    run(`
      INSERT INTO user_consents (user_id, consent_type, granted, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, consent_type)
      DO UPDATE SET granted = excluded.granted, updated_at = excluded.updated_at
    `, [userId, consentType, consentRecord.granted, consentRecord.timestamp]);

    return { auditId, ...consentRecord };
  }

  // Verify if user has given consent for specific processing
  async verifyConsent(userId, consentType) {
    const consent = get(`
      SELECT granted, updated_at
      FROM user_consents
      WHERE user_id = ? AND consent_type = ?
    `, [userId, consentType]);

    if (!consent) return false;

    // Essential consent is always required
    if (consentType === 'essential') return consent.granted === 1;

    // Check if consent is still valid (not withdrawn)
    return consent.granted === 1;
  }

  // Withdraw consent (GDPR Article 7)
  async withdrawConsent(userId, consentType, req) {
    await this.recordConsent(userId, consentType, false, req);

    // If marketing consent withdrawn, stop all marketing emails
    if (consentType === 'marketing') {
      await this.stopMarketingEmails(userId);
    }

    // If analytics consent withdrawn, anonymize future tracking
    if (consentType === 'analytics') {
      await this.anonymizeAnalytics(userId);
    }
  }

  // Get consent history for data portability
  async getConsentHistory(userId) {
    return get(`
      SELECT consent_type, granted, created_at, privacy_policy_version
      FROM consent_audit
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [userId]);
  }

  getClientIP(req) {
    return req.headers['x-forwarded-for'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null);
  }

  async getCurrentPrivacyPolicyVersion() {
    // TODO: Implement privacy policy versioning
    return '1.0';
  }

  async stopMarketingEmails(userId) {
    // Update user notification preferences
    run(`
      UPDATE users
      SET notif_new_review = 0, notif_weekly_summary = 0
      WHERE id = ?
    `, [userId]);
  }

  async anonymizeAnalytics(userId) {
    // Mark user for analytics anonymization
    run(`
      UPDATE users
      SET analytics_opt_out = 1
      WHERE id = ?
    `, [userId]);
  }
}

module.exports = { ConsentManager };