// GDPR Privacy Policy Generator and Manager
// Compliant with GDPR Articles 12-14

const { get, run, insert } = require('../../db/schema');

class PrivacyPolicyManager {
  constructor() {
    this.currentVersion = '1.0';
    this.lastUpdated = '2026-04-25';
  }

  // Generate GDPR-compliant privacy policy
  generatePrivacyPolicy() {
    return `
# Privacy Policy

**Last Updated**: ${this.lastUpdated}
**Version**: ${this.currentVersion}

## 1. Data Controller

**ReviewHub**
Data Controller and Data Protection Contact
Email: privacy@reviewhub.review
Website: https://reviewhub.review

## 2. What Information We Collect

### Personal Data Categories:
- **Account Information**: Email address, encrypted password, account preferences
- **Business Information**: Business name, platform connections (Google via OAuth; CSV/manual import for 25+ platforms including Yelp, Facebook, TripAdvisor, Trustpilot, Wongnai, Tabelog, Naver Place, Dianping, TheFork, HolidayCheck, Reclame Aqui)
- **Review Data**: Reviews and responses managed through our platform
- **Usage Data**: Application usage patterns and feature interactions
- **Communication Data**: Customer support interactions and feedback
- **Technical Data**: IP address, browser type, device information, log files
- **Payment Data**: Billing information processed by our payment providers

### Special Categories:
We do not intentionally collect sensitive personal data (racial origin, political opinions, religious beliefs, health data, etc.).

## 3. Legal Basis for Processing

| Purpose | Legal Basis | Data Categories |
|---------|-------------|-----------------|
| Account management | Contract performance (GDPR Art. 6(1)(b)) | Account information |
| Service delivery | Contract performance | Business & review data |
| Payment processing | Contract performance | Payment data |
| Customer support | Legitimate interest (GDPR Art. 6(1)(f)) | Communication data |
| Security & fraud prevention | Legitimate interest | Technical data |
| Analytics (if consented) | Consent (GDPR Art. 6(1)(a)) | Usage data |
| Marketing (if consented) | Consent | Contact information |
| Legal compliance | Legal obligation (GDPR Art. 6(1)(c)) | All relevant data |

## 4. How We Use Your Information

We process personal data for:
- **Service Provision**: Managing your review responses and platform integrations
- **Account Management**: Authentication, billing, and customer support
- **Legal Compliance**: Preventing fraud, enforcing terms, regulatory requirements
- **Consent-Based**: Analytics, product improvement, marketing communications

## 5. Data Sharing and Third Parties

### Payment Processors:
- **LemonSqueezy**: Subscription billing and payment processing
- **Stripe** (if configured): Alternative payment processing
- Data shared: Contact details, billing information, purchase history

### Review Platforms:
- **Google My Business**: OAuth-authenticated review pull + response posting via the Google My Business API
- **Other review platforms** (Yelp, Facebook, TripAdvisor, Trustpilot, Wongnai, Tabelog, Naver, Dianping, etc.): no automated API connection; reviews are imported manually via CSV. We do not transmit any data to these platforms on your behalf.
- Data shared with Google: Business identifiers, review responses you explicitly authorize

### Service Providers:
- **Hosting Providers**: Infrastructure and data storage
- **Email Providers**: Transactional emails and notifications
- Data shared: Minimum necessary for service provision

### Legal Requirements:
We may disclose data when required by law, court order, or to protect our rights.

## 6. Data Retention

| Data Category | Retention Period | Justification |
|---------------|------------------|---------------|
| Account data | Account lifetime + 3 months | Contract completion |
| Review data | Account lifetime + 1 year | Business analytics |
| Payment records | 7 years after last transaction | Tax and legal requirements |
| Support tickets | 3 years | Service improvement |
| Audit logs | 1 year | Security and compliance |
| Marketing consents | Until withdrawn + 1 month | Consent management |

## 7. International Data Transfers

**Primary Processing**: European Economic Area (EEA)
**Third Countries**: United States (adequate protections via Standard Contractual Clauses)

All international transfers include appropriate safeguards per GDPR Article 46.

## 8. Your Rights Under GDPR

You have the following rights regarding your personal data:

### Right to Access (Article 15)
Request a copy of all personal data we hold about you.

### Right to Rectification (Article 16)
Correct inaccurate or incomplete personal data.

### Right to Erasure (Article 17)
Request deletion of your personal data ("right to be forgotten").

### Right to Restrict Processing (Article 18)
Limit how we use your personal data in specific circumstances.

### Right to Data Portability (Article 20)
Receive your data in a portable format for transfer to another service.

### Right to Object (Article 21)
Object to processing based on legitimate interests or direct marketing.

### Rights Related to Automated Processing (Article 22)
Protection against solely automated decision-making with significant effects.

## 9. How to Exercise Your Rights

**Email**: privacy@reviewhub.review
**Response Time**: Within 30 days
**Verification**: Identity verification required for security
**Fee**: Generally free (reasonable fee for excessive requests)

## 10. Data Security Measures

We implement appropriate technical and organizational measures:
- **Encryption**: Data encrypted at rest and in transit
- **Access Controls**: Role-based access with multi-factor authentication
- **Monitoring**: Continuous security monitoring and incident response
- **Auditing**: Regular security assessments and penetration testing
- **Training**: Staff privacy and security training

## 11. Data Breach Notification

In case of a data breach affecting your personal data:
- **Supervisory Authority**: Notified within 72 hours
- **Individual Notification**: If high risk to your rights and freedoms
- **Breach Register**: Available at /api/gdpr/breach-notification

## 12. Consent Management

For processing requiring consent:
- **Freely Given**: No pre-ticked boxes or bundled consent
- **Specific**: Separate consent for different purposes
- **Informed**: Clear information about processing
- **Withdrawable**: Easy withdrawal at any time

Manage your consents in your account settings.

## 13. Children's Privacy

Our service is not intended for children under 16. We do not knowingly collect personal data from children. If you're under 16, please do not use our service or provide personal information.

## 14. Cookies and Tracking

### Essential Cookies:
- Authentication tokens
- Session management
- Security features

### Optional Cookies (require consent):
- Analytics tracking
- Performance optimization
- User preference storage

Cookie settings available in your account dashboard.

## 15. Data Protection Officer

For privacy-related questions:
**Email**: dpo@reviewhub.review
**Role**: Independent oversight of data protection practices

## 16. Supervisory Authority

You have the right to lodge a complaint with your local data protection authority:
- **EU Residents**: Your national DPA or Irish Data Protection Commission
- **Contact**: https://edpb.europa.eu/about-edpb/about-edpb/members_en

## 17. Changes to This Policy

Policy changes:
- **Notification**: 30 days advance notice via email
- **Material Changes**: New consent required where legally necessary
- **Version History**: Previous versions available upon request

## 18. Contact Information

**General Privacy Questions**: privacy@reviewhub.review
**Data Protection Officer**: dpo@reviewhub.review
**Security Issues**: security@reviewhub.review
**Legal Department**: legal@reviewhub.review

---

*This privacy policy is designed to comply with GDPR requirements and is regularly reviewed by legal counsel specializing in data protection law.*
`;
  }

  // Install privacy policy into database
  async installPrivacyPolicy() {
    const content = this.generatePrivacyPolicy();

    try {
      insert(`
        INSERT INTO privacy_policy_versions (version, content, effective_date)
        VALUES (?, ?, ?)
      `, [this.currentVersion, content, this.lastUpdated]);

      console.log(`[GDPR] Privacy policy v${this.currentVersion} installed`);
      return { version: this.currentVersion, installed: true };
    } catch (error) {
      console.error('[GDPR] Privacy policy installation failed:', error);
      throw error;
    }
  }

  // Check if privacy policy needs user acceptance
  async requiresAcceptance(userId) {
    const user = get(`
      SELECT terms_version_accepted
      FROM users WHERE id = ?
    `, [userId]);

    return !user || user.terms_version_accepted !== this.currentVersion;
  }

  // Record privacy policy acceptance
  async recordAcceptance(userId, req) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    run(`
      UPDATE users
      SET terms_accepted_at = ?, terms_version_accepted = ?,
          terms_accept_ip = ?, terms_accept_ua = ?
      WHERE id = ?
    `, [
      new Date().toISOString(),
      this.currentVersion,
      ip,
      userAgent,
      userId
    ]);

    // Log acceptance in audit trail
    run(`
      INSERT INTO audit_log (user_id, event, ip, user_agent, metadata)
      VALUES (?, ?, ?, ?, ?)
    `, [
      userId,
      'privacy_policy_accepted',
      ip,
      userAgent,
      JSON.stringify({ version: this.currentVersion })
    ]);
  }

  // Get current policy for API
  async getCurrentPolicy() {
    return get(`
      SELECT version, content, effective_date
      FROM privacy_policy_versions
      ORDER BY effective_date DESC LIMIT 1
    `);
  }
}

module.exports = { PrivacyPolicyManager };