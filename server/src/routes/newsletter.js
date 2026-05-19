// POST /api/newsletter — generic newsletter signup capture from Landing,
// /blog index, blog posts, and any other surface that drops in the
// NewsletterSignup widget. Public (no auth). Idempotent via UNIQUE(email)
// at the DB layer — same email twice = 200 without inserting twice.
//
// Why this exists: every blog visitor and Landing visitor today leaves
// without a way for us to remarket. The strategy doc 2026-05-20 flagged
// this as the lead-capture gap. We're collecting to local SQLite for
// now; export-and-import to ConvertKit/Loops/Mailchimp when the list
// crosses ~50 signups. Free, no third-party setup, ship today.
//
// Source tracking: the client sends a `source` string ('landing',
// 'blog-index', 'blog-post:<slug>', etc.) so we can attribute which
// surfaces drive signups. Capped at 64 chars to keep the table clean
// against arbitrary input.

const express = require('express');
const router = express.Router();
const { insert, get } = require('../db/schema');
const { captureException } = require('../lib/errorReporter');

const rateLimit = require('express-rate-limit');
// 5 submissions per IP per 15 min — same shape as waitlist. Covers
// honest re-clicks, stops mass insertion. Bypassed under NODE_ENV=test
// because supertest reuses 127.0.0.1 across cases.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again in a few minutes' },
  skip: () => process.env.NODE_ENV === 'test',
});

function isValidEmail(s) {
  if (typeof s !== 'string') return false;
  const trimmed = s.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

router.post('/', limiter, async (req, res) => {
  try {
    // Honeypot — bots that fill every input return fake-200. We do NOT
    // insert a row, do NOT mark the email as subscribed. Field name
    // 'website' chosen because it's the most common honeypot label that
    // dumb bots auto-fill.
    if (req.body?.website && String(req.body.website).trim() !== '') {
      return res.json({ ok: true });
    }

    const rawEmail = (req.body?.email || '').toString().trim().toLowerCase();
    const rawSource = (req.body?.source || 'unknown').toString().trim().toLowerCase().slice(0, 64);

    if (!isValidEmail(rawEmail)) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    // Idempotency check — same email twice = no duplicate row, no error.
    // Frontend treats 200 as success either way (subscribed or already
    // subscribed) so the UX is identical.
    const existing = get(
      'SELECT id, created_at FROM newsletter_signups WHERE email = ?',
      [rawEmail]
    );
    if (existing) {
      return res.status(200).json({ ok: true, already: true });
    }

    insert(
      'INSERT INTO newsletter_signups (email, source) VALUES (?, ?)',
      [rawEmail, rawSource]
    );

    return res.status(200).json({ ok: true });
  } catch (err) {
    captureException(err, { route: 'newsletter', op: 'create' });
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
