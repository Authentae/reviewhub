// Audit log helper.
//
// logAudit(req, event, opts?)
//   req      — the Express request (used for IP + UA extraction; optional if you
//              call from a non-request context).
//   event    — short dotted event id, e.g. "user.login", "user.password_reset".
//   opts.userId   — associated user, or null for pre-auth events.
//   opts.metadata — object; serialised to JSON. Do NOT include secrets here.
//
// Writes are best-effort: a failure to log is never allowed to fail the
// underlying request. We swallow errors (and emit a console warning) so the
// audit table is never a single point of failure for the app.

const { run } = require('../db/schema');

// Truncate limits to keep the log compact and resist log-injection bloat.
const MAX_UA = 500;
const MAX_IP = 64;
const MAX_META = 4000;

function getIp(req) {
  if (!req) return null;
  // `req.ip` respects `trust proxy` when set (production). Fallback to the raw
  // socket address for local dev where trust proxy is off.
  const raw = req.ip || req.socket?.remoteAddress || null;
  if (!raw) return null;
  return String(raw).slice(0, MAX_IP);
}

function getUa(req) {
  if (!req) return null;
  const ua = req.headers?.['user-agent'];
  if (!ua) return null;
  return String(ua).slice(0, MAX_UA);
}

function logAudit(req, event, opts = {}) {
  try {
    const userId = opts.userId ?? null;
    const metadata = opts.metadata
      ? JSON.stringify(opts.metadata).slice(0, MAX_META)
      : null;
    run(
      'INSERT INTO audit_log (user_id, event, ip, user_agent, metadata) VALUES (?, ?, ?, ?, ?)',
      [userId, event, getIp(req), getUa(req), metadata]
    );
  } catch (err) {
    // Never fail the outer request because of the audit log.
    // eslint-disable-next-line no-console
    console.warn('[AUDIT] failed to record', event, err.message);
  }
}

module.exports = { logAudit };
