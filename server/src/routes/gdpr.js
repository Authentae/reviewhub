// GDPR Compliance API Routes
// Routes for data subject rights, consent management, and privacy controls

const express = require('express');
const { ConsentManager } = require('../lib/gdpr/consentManager');
const { DataSubjectRights } = require('../lib/gdpr/dataSubjectRights');
const { authMiddleware: requireAuth } = require('../middleware/auth');
const { get, run, insert } = require('../db/schema');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { captureException } = require('../lib/errorReporter');

const router = express.Router();
const consentManager = new ConsentManager();
const dataRights = new DataSubjectRights();

// Rate limiting for sensitive GDPR operations
const gdprRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: { error: 'Too many GDPR requests. Please try again later.' }
});

// GET /api/gdpr/privacy-policy - Current privacy policy
router.get('/privacy-policy', async (req, res) => {
  try {
    const policy = get(`
      SELECT version, content, effective_date
      FROM privacy_policy_versions
      ORDER BY effective_date DESC LIMIT 1
    `);

    if (!policy) {
      return res.status(404).json({ error: 'Privacy policy not found' });
    }

    res.json(policy);
  } catch (error) {
    captureException(error, { route: 'gdpr', op: 'privacy-policy' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/gdpr/consent-status - User's current consent status
router.get('/consent-status', requireAuth, async (req, res) => {
  try {
    const consents = await Promise.all(
      consentManager.consentTypes.map(async (type) => ({
        type,
        granted: await consentManager.verifyConsent(req.user.id, type)
      }))
    );

    res.json({ consents });
  } catch (error) {
    captureException(error, { route: 'gdpr', op: 'consent-status', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to retrieve consent status' });
  }
});

// POST /api/gdpr/consent - Record user consent.
// Rate-limited because each call writes a row to consent_audit (immutable
// trail) — without a cap, an attacker (or a buggy client) could fill the
// table with thousands of duplicate consent flips per second. The 5-per-15-
// min limit comfortably covers a real user re-toggling preferences in the
// CookieConsent UI but cuts off any automated abuse.
router.post('/consent', requireAuth, gdprRateLimit, async (req, res) => {
  try {
    const { consentType, granted } = req.body;

    if (!consentManager.consentTypes.includes(consentType)) {
      return res.status(400).json({ error: 'Invalid consent type' });
    }

    const consentRecord = await consentManager.recordConsent(
      req.user.id,
      consentType,
      granted,
      req
    );

    res.json({ success: true, consentRecord });
  } catch (error) {
    captureException(error, { route: 'gdpr', op: 'consent-recording', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to record consent' });
  }
});

// POST /api/gdpr/data-export - Request data export (Article 15 & 20)
router.post('/data-export', requireAuth, gdprRateLimit, async (req, res) => {
  try {
    const { format = 'json' } = req.body;

    // Log the data export request
    run(`
      INSERT INTO audit_log (user_id, event, ip, user_agent, metadata)
      VALUES (?, ?, ?, ?, ?)
    `, [
      req.user.id,
      'gdpr_data_export',
      req.ip,
      req.get('User-Agent'),
      JSON.stringify({ format })
    ]);

    const exportData = await dataRights.exportUserData(req.user.id, format);

    // Update user record
    run(`
      UPDATE users
      SET data_portability_requested_at = ?
      WHERE id = ?
    `, [new Date().toISOString(), req.user.id]);

    res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="gdpr-export-${req.user.id}.${format}"`);
    res.send(exportData);
  } catch (error) {
    captureException(error, { route: 'gdpr', op: 'data-export', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to generate data export' });
  }
});

// POST /api/gdpr/erasure-request - Request account deletion (Article 17)
router.post('/erasure-request', requireAuth, gdprRateLimit, async (req, res) => {
  try {
    // Generate secure erasure token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour expiry

    // Store token
    run(`
      UPDATE users
      SET erasure_token_hash = ?, erasure_token_expires = ?
      WHERE id = ?
    `, [tokenHash, expiresAt.toISOString(), req.user.id]);

    // Log erasure request
    run(`
      INSERT INTO audit_log (user_id, event, ip, user_agent, metadata)
      VALUES (?, ?, ?, ?, ?)
    `, [
      req.user.id,
      'gdpr_erasure_requested',
      req.ip,
      req.get('User-Agent'),
      JSON.stringify({ token_expires: expiresAt.toISOString() })
    ]);

    // SECURITY: never log the plaintext erasure token. Anyone with log
    // access (Railway operators, log aggregators, leaked .log files) could
    // replay the token to permanently delete this user's data — irreversible
    // by definition (Article 17 — right to be forgotten). The DB only ever
    // stores SHA-256(token); the plaintext exists in memory for the
    // duration of this request only.
    //
    // The token reaches the user via email (the request happens against
    // an authenticated session, so we have the address on req.user.email).
    // TODO: wire sendErasureConfirmation in lib/email.js. Until then the
    // token is unreachable to the user, which is a privacy-safe failure
    // mode (the data simply won't be deleted) rather than the previous
    // log-leak failure mode.

    res.json({
      success: true,
      message: 'Erasure request initiated. Check your email for confirmation.',
      // tokenPreview removed: leaking the first 8 chars halves entropy and
      // gives a brute-forcer a meaningful head start on the remaining 56.
    });
  } catch (error) {
    captureException(error, { route: 'gdpr', op: 'erasure-request', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to process erasure request' });
  }
});

// POST /api/gdpr/confirm-erasure - Confirm account deletion with token
router.post('/confirm-erasure', gdprRateLimit, async (req, res) => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ error: 'User ID and token required' });
    }

    const erasureResult = await dataRights.processErasureRequest(userId, token);

    res.json({
      success: true,
      message: 'Account successfully deleted in compliance with GDPR Article 17',
      erasureId: erasureResult.erasure_id,
      categoriesErased: erasureResult.data_categories
    });
  } catch (error) {
    captureException(error, { route: 'gdpr', op: 'erasure-confirmation' });

    if (error.message === 'Invalid erasure request token') {
      return res.status(400).json({ error: 'Invalid or expired erasure token' });
    }

    res.status(500).json({ error: 'Failed to process account deletion' });
  }
});

// POST /api/gdpr/processing-restriction - Restrict data processing (Article 18)
router.post('/processing-restriction', requireAuth, gdprRateLimit, async (req, res) => {
  try {
    const { restrictions } = req.body;

    if (!Array.isArray(restrictions)) {
      return res.status(400).json({ error: 'Restrictions must be an array' });
    }

    await dataRights.restrictProcessing(req.user.id, restrictions);

    // Log restriction request
    run(`
      INSERT INTO audit_log (user_id, event, ip, user_agent, metadata)
      VALUES (?, ?, ?, ?, ?)
    `, [
      req.user.id,
      'gdpr_processing_restricted',
      req.ip,
      req.get('User-Agent'),
      JSON.stringify({ restrictions })
    ]);

    res.json({
      success: true,
      message: 'Processing restrictions applied',
      restrictions
    });
  } catch (error) {
    captureException(error, { route: 'gdpr', op: 'processing-restriction', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to apply processing restrictions' });
  }
});

// GET /api/gdpr/breach-notification - Data breach notifications (Article 33/34)
router.get('/breach-notification', async (req, res) => {
  try {
    // Public endpoint for breach notifications
    const breaches = get(`
      SELECT incident_id, notification_date, description, affected_data,
             mitigation_measures, contact_dpo
      FROM breach_notifications
      WHERE public_notification = 1
      ORDER BY notification_date DESC
    `);

    res.json({ breaches: breaches || [] });
  } catch (error) {
    captureException(error, { route: 'gdpr', op: 'breach-notification' });
    res.status(500).json({ error: 'Failed to retrieve breach notifications' });
  }
});

module.exports = router;