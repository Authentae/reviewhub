// POST /api/support — public-or-authed support ticket intake.
//
// Email-to-founder + DB row. Mirrors the audit-request endpoint pattern:
//   - Public (no auth required) so users can submit before/after deleting account
//   - Honeypot anti-bot
//   - Rate limited (5/hour/IP — support tickets shouldn't be high-volume)
//   - CR/LF stripped from anything that lands in email headers
//   - Email goes to ADMIN_EMAIL with replyTo set to the user's address
//   - Subject prefixed with [SUPPORT][category] so the founder can filter
//
// Why not just an email link? (a) Mobile users hate mailto:. (b) Signed-in
// users get auto-fill so the bar is one form field high. (c) The DB row
// gives the founder a list view ("inbox") for follow-up — email-as-CRM
// stops scaling around ~20 tickets.

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { run, get, insert } = require('../db/schema');
const { captureException } = require('../lib/errorReporter');
const { authMiddleware } = require('../middleware/auth');

// Auth middleware that DOESN'T 401 — sets req.user when a token is
// present, but lets anonymous requests through. Lets the support form
// auto-fill from a logged-in account while still being available to
// anonymous users (e.g. someone whose login is broken).
function authOptional(req, res, next) {
  if (req.headers.authorization || req.cookies?.token) {
    return authMiddleware(req, res, (err) => {
      // Swallow auth errors — anonymous tickets are fine.
      if (err) req.user = undefined;
      next();
    });
  }
  next();
}

const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many support requests from this IP. Try again in an hour, or email hello@reviewhub.review directly.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const VALID_CATEGORIES = ['bug', 'billing', 'account', 'feature', 'other'];

router.post('/', supportLimiter, authOptional, async (req, res) => {
  try {
    const { subject, category, message, email: bodyEmail, url, website } = req.body || {};

    // Honeypot — bots that fill every input return fake-200. We do NOT
    // insert a row, do NOT email the founder.
    if (website && String(website).trim() !== '') {
      return res.json({ success: true });
    }

    const stripHdr = (s) => String(s ?? '').replace(/[\r\n]/g, ' ');

    const email = stripHdr(String(bodyEmail || req.user?.email || '').trim().toLowerCase().slice(0, 254));
    const subj = stripHdr(String(subject || '').trim().slice(0, 200));
    const cat = String(category || '').trim().toLowerCase();
    const msg = String(message || '').trim().slice(0, 10000);
    const cleanUrl = stripHdr(String(url || '').trim().slice(0, 500));

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email is required so we can reply to you.' });
    }
    if (!subj) {
      return res.status(400).json({ error: 'Please give the issue a short subject.' });
    }
    if (!VALID_CATEGORIES.includes(cat)) {
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }
    if (!msg || msg.length < 5) {
      return res.status(400).json({ error: 'Please describe the issue in a few sentences.' });
    }

    const ip = (req.ip || req.socket?.remoteAddress || '').slice(0, 64);
    const ua = (req.headers['user-agent'] || '').slice(0, 500);

    const id = insert(
      `INSERT INTO support_tickets
         (user_id, email, category, subject, message, url, user_agent, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user?.id || null, email, cat, subj, msg, cleanUrl || null, ua, ip]
    );

    // Priority routing — Business plan customers pay for "priority support".
    // Make that concrete by tagging the founder-notification subject with
    // [PRIORITY], so a high-volume support inbox sorts them visibly first.
    // No SLA promised; this is the minimum implementation that doesn't
    // make the marketing claim a lie.
    let isPriority = false;
    if (req.user?.id) {
      try {
        const { planAllows } = require('../lib/billing/plans');
        const sub = get('SELECT plan FROM subscriptions WHERE user_id = ?', [req.user.id]);
        if (sub && planAllows(sub.plan, 'priority_support')) isPriority = true;
      } catch { /* best-effort — degrade to non-priority */ }
    }

    // Email the founder. Fire-and-forget — submitter's UX shouldn't block
    // on SMTP. If email fails, the DB row still exists for follow-up via
    // the /owner inbox view.
    const adminEmail = process.env.ADMIN_EMAIL || '';
    if (adminEmail && process.env.SMTP_HOST) {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      const userLabel = req.user?.id ? `user #${req.user.id} (${email})` : `anonymous (${email})`;
      const text = [
        `[Support ticket #${id}]`,
        `Category: ${cat.toUpperCase()}`,
        `Subject:  ${subj}`,
        `From:     ${userLabel}`,
        cleanUrl ? `URL:      ${cleanUrl}` : null,
        `IP:       ${ip || 'unknown'}`,
        `UA:       ${ua}`,
        '',
        '──── message ────',
        '',
        msg,
        '',
        '─────────────────',
        '',
        `Reply directly to ${email} — replyTo is set so just hitting Reply works.`,
        `Mark resolved: UPDATE support_tickets SET status='resolved', resolved_at=datetime('now') WHERE id=${id};`,
      ].filter(Boolean).join('\n');

      transporter.sendMail({
        from: process.env.SMTP_FROM || 'ReviewHub <noreply@reviewhub.review>',
        to: adminEmail,
        replyTo: email,
        subject: `${isPriority ? '[PRIORITY]' : '[SUPPORT]'}[${cat.toUpperCase()}] ${subj}`,
        text,
      }).catch((err) => {
        captureException(err, { route: 'support', op: 'notify-founder', ticketId: id });
      });
    } else {
      // Dev / mis-configured: still log so an operator looking at logs
      // sees the ticket landed.
      console.log(`[SUPPORT] ticket #${id} from ${email}: [${cat}] ${subj}`);
    }

    return res.json({ success: true, ticket_id: id });
  } catch (err) {
    captureException(err, { route: 'support' });
    return res.status(500).json({ error: 'Server error. Email hello@reviewhub.review directly if this keeps happening.' });
  }
});

// GET /api/support/me — list a logged-in user's own tickets so they can
// see the history of what they've reported. Admins see everyone's via the
// owner-dashboard route (separate). Returns at most the last 50.
router.get('/me', authMiddleware, (req, res) => {
  try {
    const { all } = require('../db/schema');
    const tickets = all(
      `SELECT id, category, subject, status, created_at, resolved_at
       FROM support_tickets
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ tickets });
  } catch (err) {
    captureException(err, { route: 'support', op: 'list-mine' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
