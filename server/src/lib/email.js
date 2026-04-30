const nodemailer = require('nodemailer');
const { makeUnsubToken } = require('./tokens');
const { PLATFORM_META } = require('./platforms');

// Display label for a platform id (e.g. 'wongnai' → 'Wongnai',
// 'tabelog' → 'Tabelog (食べログ)'). Falls back to the raw id when
// unrecognised so the email never renders a blank string.
function platformLabel(id) {
  return PLATFORM_META[id]?.label || id || '';
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

let _transporter = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) {
    // Dev fallback: log to console. Tests rely on this path too — see
    // tests/helpers.js, which clears any SMTP_* env vars at load time so the
    // suite never hits a real provider (would otherwise fail with 550 from
    // Resend's sandbox restriction). Tests that DO want a stub transporter
    // (e.g. tests/emailTemplates.test.js) set SMTP_HOST themselves and
    // monkey-patch nodemailer.createTransport before requiring this module.
    return null;
  }
  if (!_transporter) {
    // Tighter timeouts than nodemailer's defaults (~10 min). On a PaaS that
    // blocks outbound 587 (Railway, Fly, Render's free plan), the connection
    // hangs for the full default timeout — by which point a user clicking
    // "Resend verification" sees a successful toast but the request thread
    // is stuck. 8s is enough for a healthy handshake from any region while
    // still surfacing port-block issues quickly.
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 30_000,
    });
  }
  return _transporter;
}

// Operator-facing hint when an SMTP error looks like a blocked-port symptom.
// Runs on both boot-verify failures and runtime send failures so the operator
// sees an actionable line in logs no matter when things break. Returns the
// hint string (or '' when nothing matches) so the caller can attach it.
function _portBlockHint(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  const code = String(err?.code || '');
  const isTimeoutOrRefused =
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'ESOCKET' ||
    msg.includes('connection timeout') ||
    msg.includes('connect etimedout') ||
    msg.includes('connect econnrefused');
  if (!isTimeoutOrRefused) return '';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const host = String(process.env.SMTP_HOST || '');
  if (port === 587 && /resend\.com$/.test(host)) {
    return ' — Railway/Fly/many PaaS providers block outbound :587 by default. Switch SMTP_PORT to 2587 (Resend\'s alternate) and redeploy.';
  }
  if (port === 587) {
    return ' — outbound :587 may be blocked by your host. Try your provider\'s alternate submission port (2587/465/2525).';
  }
  return '';
}

// Verify SMTP connection on startup if configured
async function verifySmtp() {
  const transporter = getTransporter();
  if (!transporter) return;
  try {
    await transporter.verify();
    console.log('[EMAIL] SMTP connection verified');

    // Warn loudly when SMTP_FROM is still on a provider's "dev" sender
    // domain. These are sandbox-only addresses (Resend's `onboarding@resend.dev`,
    // SendGrid's `test@sendgrid.net`, Postmark's `inbound-test@postmarkapp.com`)
    // — the connection verifies fine and sends return 250 OK at the SMTP layer,
    // but the provider silently drops anything addressed to recipients other
    // than the account's verified owner email. Symptom: zero emails arrive,
    // server logs show success. Boot warning surfaces this BEFORE customers
    // hit the dead path.
    const from = String(process.env.SMTP_FROM || '');
    const devSenders = ['@resend.dev', '@sendgrid.net', '@postmarkapp.com', '@mailtrap.io'];
    const matched = devSenders.find((d) => from.toLowerCase().includes(d));
    if (matched) {
      console.warn(
        `[EMAIL] SMTP_FROM uses a dev/sandbox sender (${matched}). ` +
        `Most providers only deliver from these to the account owner — ` +
        `customers will NOT receive emails. Verify a real domain at your ` +
        `provider and switch SMTP_FROM to noreply@<yourdomain> before launch.`
      );
    }
  } catch (err) {
    console.warn(`[EMAIL] SMTP configuration error: ${err.message}${_portBlockHint(err)}`);
    // Reset so a bad transporter doesn't persist
    _transporter = null;
  }
}

// Exported for the send wrapper (and tests) — same hint logic that fires at
// boot also runs on runtime sendMail failures.
const portBlockHint = _portBlockHint;

async function sendNewReviewNotification(userEmail, review, businessName) {
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

  // Strip newlines/carriage returns from values used in email headers to prevent header injection
  const stripHeaderChars = (s) => String(s ?? '').replace(/[\r\n]/g, ' ');

  const safePlatform = escapeHtml(platformLabel(review.platform));
  const safeName = escapeHtml(review.reviewer_name);
  const safeText = escapeHtml(review.review_text || '(no text)');
  const safeSentiment = escapeHtml(review.sentiment);
  const safeBizName = escapeHtml(businessName);
  const safeClientUrl = escapeHtml(process.env.CLIENT_URL || 'http://localhost:5173');

  // Subject uses stripHeaderChars to prevent email header injection
  const subject = `New ${stripHeaderChars(platformLabel(review.platform))} review for ${stripHeaderChars(businessName)} — ${stars}`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#2563eb">New Review on ${safePlatform}</h2>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0">
        <p><strong>${safeName}</strong> left a <strong>${review.rating}-star</strong> review for <strong>${safeBizName}</strong></p>
        <p style="color:#374151">&ldquo;${safeText}&rdquo;</p>
        <p style="font-size:12px;color:#6b7280">Sentiment: ${safeSentiment} · ${new Date().toLocaleDateString()}</p>
      </div>
      <a href="${safeClientUrl}/dashboard"
         style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
        View &amp; Respond
      </a>
      <p style="font-size:11px;color:#9ca3af;margin-top:24px">ReviewHub · Manage notifications in Settings</p>
    </div>`;

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EMAIL] New review notification → ${userEmail}: ${subject}`);
    return;
  }

  const text = [
    `New Review on ${platformLabel(review.platform)}`,
    `${review.reviewer_name} left a ${review.rating}-star review for ${businessName}`,
    `"${review.review_text || '(no text)'}"`,
    `Sentiment: ${review.sentiment}`,
    ``,
    `View and respond: ${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard`,
    ``,
    `ReviewHub · Manage notifications in Settings`,
  ].join('\n');

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'ReviewHub <noreply@reviewhub.review>',
    to: userEmail,
    subject,
    html,
    text,
  });
}

// Send the email-verification link. `verifyUrl` is the full URL the user clicks
// (already includes the token query param). Plaintext + HTML versions are sent
// so clients without HTML support still work.
async function sendVerificationEmail(userEmail, verifyUrl) {
  // Subject updated to match the design spec — action-oriented, invites one tap.
  const subject = 'Confirm your email — one click and you\'re in';
  const safeUrl = escapeHtml(verifyUrl);
  // Table-based HTML per email-client best practice. Inline styles only; no
  // <style> block (most webmail strips it). Design reference:
  // docs/launch/asset-index.html (template 1 · Verification email).
  const html = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <tr><td align="center" style="padding:32px 24px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
      <tr><td style="padding-bottom:24px;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="width:36px;vertical-align:middle;" bgcolor="#1e4d5e">
              <div style="width:36px;height:36px;border-radius:8px;background-color:#1e4d5e;text-align:center;line-height:36px;">
                <span style="color:#fbf8f1;font-size:18px;font-weight:700;">★</span>
              </div>
            </td>
            <td style="padding-left:10px;vertical-align:middle;font-size:17px;font-weight:700;color:#1d242c;letter-spacing:-0.01em;">ReviewHub</td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding-bottom:16px;font-size:26px;font-weight:700;color:#1d242c;letter-spacing:-0.02em;line-height:1.2;">
        One click and you're in.
      </td></tr>
      <tr><td style="padding-bottom:28px;font-size:15px;color:#3a4248;line-height:1.55;">
        Confirm your email and you'll be drafting AI replies in under a minute. This link expires in 24 hours.
      </td></tr>
      <tr><td style="padding-bottom:28px;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeUrl}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="22%" stroke="f" fillcolor="#1e4d5e">
          <w:anchorlock/>
          <center style="color:#fbf8f1;font-family:sans-serif;font-size:15px;font-weight:700;">Confirm my email</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <a href="${safeUrl}" bgcolor="#1e4d5e" style="display:inline-block;background-color:#1e4d5e;color:#fbf8f1;font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;mso-padding-alt:0;" target="_blank">Confirm my email &rarr;</a>
        <!--<![endif]-->
      </td></tr>
      <tr><td style="padding-bottom:24px;font-size:13px;color:#7a8189;line-height:1.55;">
        Or paste this into your browser:<br><span style="color:#1e4d5e;word-break:break-all;">${safeUrl}</span>
      </td></tr>
      <tr><td style="border-top:1px solid #e2e8f0;padding-top:20px;padding-bottom:32px;font-size:12px;color:#94a3b8;line-height:1.55;">
        Didn't sign up? You can safely ignore this email — no account will be created.
      </td></tr>
    </table>
  </td></tr>
</table>`;
  const text = [
    'Welcome to ReviewHub',
    '',
    'Confirm your email address to finish setting up your account.',
    'This link is valid for 24 hours:',
    verifyUrl,
    '',
    "If you didn't create a ReviewHub account, you can ignore this email.",
  ].join('\n');

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EMAIL] Verification → ${userEmail}: ${verifyUrl}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'ReviewHub <noreply@reviewhub.review>',
    to: userEmail,
    subject,
    html,
    text,
  });
}

// Send the password-reset link. Valid for 1 hour.
async function sendPasswordResetEmail(userEmail, resetUrl) {
  const subject = 'Reset your ReviewHub password';
  const safeUrl = escapeHtml(resetUrl);
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#2563eb">Password reset</h2>
      <p>We received a request to reset the password for your ReviewHub account. This link is valid for 1 hour.</p>
      <p style="margin:24px 0">
        <a href="${safeUrl}"
           style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
          Reset password
        </a>
      </p>
      <p style="font-size:12px;color:#6b7280">If the button doesn't work, paste this URL into your browser:<br>${safeUrl}</p>
      <p style="font-size:11px;color:#9ca3af;margin-top:24px">If you didn't request this, you can safely ignore this email — your password won't change.</p>
    </div>`;
  const text = [
    'Password reset',
    '',
    'We received a request to reset the password for your ReviewHub account.',
    'This link is valid for 1 hour:',
    resetUrl,
    '',
    "If you didn't request this, you can safely ignore this email.",
  ].join('\n');

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EMAIL] Password reset → ${userEmail}: ${resetUrl}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'ReviewHub <noreply@reviewhub.review>',
    to: userEmail,
    subject,
    html,
    text,
  });
}

// Weekly digest: summary stats for the past 7 days. `stats` is whatever
// runWeeklyDigest prepares — minimal, just enough to render a readable email.
async function sendWeeklyDigest(userEmail, stats) {
  const {
    userId,
    business_name, total, avg_rating = null,
    positive = 0, negative = 0, unresponded = 0,
    recentReviews = [],
  } = stats;
  // Signed one-click unsub token. The same token goes into both the email
  // footer link (for users who click) AND the List-Unsubscribe header (for
  // mail clients' automated probes — RFC 8058). Without a userId we can
  // still send the digest but the footer falls back to the in-app login
  // route, which is OK for back-compat with old call sites.
  const unsubToken = userId ? makeUnsubToken(userId, 'digest') : null;
  const apiBase = process.env.CLIENT_URL || 'http://localhost:5173';
  const oneClickUnsubUrl = unsubToken
    ? `${apiBase}/api/auth/unsubscribe?token=${encodeURIComponent(unsubToken)}`
    : `${apiBase}/settings?unsub=digest`;
  const safeBiz = escapeHtml(business_name);
  const safeUrl = escapeHtml(process.env.CLIENT_URL || 'http://localhost:5173');
  // Subject is drawn from the numbers so the preview-pane line tells you
  // exactly what's inside. Design spec: "7 new reviews this week · 3 need a reply".
  const subject = total > 0 && unresponded > 0
    ? `${total} new review${total === 1 ? '' : 's'} this week · ${unresponded} need${unresponded === 1 ? 's' : ''} a reply`
    : `Your review week — ${safeBiz}`;

  // Sentiment-split sparkline bar — fills only as wide as each segment's share
  // of total reviews. Degrades to a single-color bar if total is zero.
  const sentimentBar = total > 0 ? (() => {
    const posPct = Math.round((positive / total) * 100);
    const negPct = Math.round((negative / total) * 100);
    const neuPct = Math.max(0, 100 - posPct - negPct);
    return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;border-radius:8px;overflow:hidden;">
      <tr>
        ${posPct > 0 ? `<td width="${posPct}%" height="6" style="background:#22c55e;font-size:0;line-height:0;">&nbsp;</td>` : ''}
        ${neuPct > 0 ? `<td width="${neuPct}%" height="6" style="background:#f59e0b;font-size:0;line-height:0;">&nbsp;</td>` : ''}
        ${negPct > 0 ? `<td width="${negPct}%" height="6" style="background:#dc2626;font-size:0;line-height:0;">&nbsp;</td>` : ''}
      </tr>
    </table>
    <div style="font-size:11px;color:#94a3b8;margin-top:6px;">${positive} positive · ${total - positive - negative} neutral · ${negative} critical</div>`;
  })() : '';

  // Critical callout — most negative unresponded review, if one exists. Uses
  // the design's red-tinted card with a prominent "Draft reply" CTA.
  const criticalReview = recentReviews.find(r => r.rating <= 2 && !r.response_text);
  const criticalBlock = criticalReview ? `
    <tr><td style="padding:0 28px 16px;">
      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">⚠ Needs a reply</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;">
        <tr><td style="padding:14px 16px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="font-size:13px;color:#991b1b;font-weight:700;">${escapeHtml(criticalReview.reviewer_name || 'Anonymous')} · ${'★'.repeat(criticalReview.rating)}${'☆'.repeat(5 - criticalReview.rating)}</td>
              <td align="right" style="font-size:11px;color:#991b1b;">${escapeHtml(criticalReview.platform.charAt(0).toUpperCase() + criticalReview.platform.slice(1))}</td>
            </tr>
          </table>
          <div style="font-size:13px;color:#7f1d1d;line-height:1.5;margin-top:6px;">"${escapeHtml((criticalReview.review_text || '').slice(0, 160))}${(criticalReview.review_text || '').length > 160 ? '…' : ''}"</div>
          <a href="${safeUrl}/dashboard?responded=no" style="display:inline-block;margin-top:12px;background:#dc2626;color:#fff;font-size:12px;font-weight:700;text-decoration:none;padding:8px 14px;border-radius:7px;">✨ Draft reply</a>
        </td></tr>
      </table>
    </td></tr>` : '';

  // Highlight callout — best positive review of the week, if any.
  const highlightReview = recentReviews.find(r => r.rating >= 5);
  const highlightBlock = highlightReview ? `
    <tr><td style="padding:0 28px 24px;">
      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">✨ Highlight of the week</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">
        <tr><td style="padding:14px 16px;font-size:13px;color:#166534;line-height:1.5;">
          <b>${escapeHtml(highlightReview.reviewer_name || 'Anonymous')} · ★★★★★</b> — <i>"${escapeHtml((highlightReview.review_text || '').slice(0, 140))}${(highlightReview.review_text || '').length > 140 ? '…' : ''}"</i>
        </td></tr>
      </table>
    </td></tr>` : '';

  // Week label — "Week of Apr 19 – 25" format.
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const weekLabel = `Week of ${monthNames[weekStart.getMonth()]} ${weekStart.getDate()} – ${now.getDate()}`;

  const html = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <tr><td align="center" style="padding:24px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#1e3a8a,#4338ca);padding:28px 28px 24px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="font-size:12px;color:rgba(255,255,255,0.7);font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">${weekLabel}</td>
            <td align="right" style="font-size:12px;color:rgba(255,255,255,0.7);font-weight:600;">${safeBiz}</td>
          </tr>
          <tr><td colspan="2" style="padding-top:8px;font-size:26px;color:#fff;font-weight:700;letter-spacing:-0.02em;">Your review week</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:24px 28px 8px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="33%"><div style="font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">${total}</div><div style="font-size:12px;color:#64748b;margin-top:2px;">new reviews</div></td>
            <td width="33%"><div style="font-size:28px;font-weight:800;color:#f59e0b;letter-spacing:-0.02em;">${avg_rating != null ? avg_rating : '—'} ★</div><div style="font-size:12px;color:#64748b;margin-top:2px;">avg rating</div></td>
            <td width="33%"><div style="font-size:28px;font-weight:800;color:#dc2626;letter-spacing:-0.02em;">${unresponded}</div><div style="font-size:12px;color:#64748b;margin-top:2px;">need a reply</div></td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:8px 28px 24px;">${sentimentBar}</td></tr>
      ${criticalBlock}
      ${highlightBlock}
      <tr><td align="center" style="padding:0 28px 32px;">
        <a href="${safeUrl}/dashboard" style="display:inline-block;background:#0f172a;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 24px;border-radius:10px;">Open dashboard →</a>
      </td></tr>
      <tr><td style="border-top:1px solid #e2e8f0;padding:18px 28px;font-size:11px;color:#94a3b8;line-height:1.55;" align="center">
        You get this every Monday. <a href="${safeUrl}/settings" style="color:#94a3b8;">Change frequency</a> · <a href="${escapeHtml(oneClickUnsubUrl)}" style="color:#94a3b8;">Unsubscribe</a>
      </td></tr>
    </table>
  </td></tr>
</table>`;

  const reviewsText = recentReviews.length > 0 ? [
    '',
    'Recent reviews:',
    ...recentReviews.map(r => {
      const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
      const excerpt = r.review_text ? r.review_text.slice(0, 160) + (r.review_text.length > 160 ? '…' : '') : '(no text)';
      const responded = r.response_text ? '' : ' [no response yet]';
      return `  ${r.reviewer_name || 'Anonymous'} ${stars} (${r.platform})${responded}\n  "${excerpt}"`;
    }),
  ] : [];

  const text = [
    `Weekly digest for ${business_name}`,
    '',
    `New reviews: ${total}`,
    avg_rating != null ? `Average rating: ${avg_rating}` : null,
    `Positive: ${positive}`,
    `Negative: ${negative}`,
    `Awaiting response: ${unresponded}`,
    ...reviewsText,
    '',
    `Open dashboard: ${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard`,
  ].filter(s => s !== null).join('\n');

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EMAIL] Weekly digest → ${userEmail}: ${total} new review(s) this week`);
    return;
  }
  // List-Unsubscribe + List-Unsubscribe-Post per RFC 8058 — Gmail/Yahoo
  // require these for bulk senders or deliverability tanks. The URL is signed
  // with HMAC so Gmail's automated POST (no cookies, no session) can identify
  // the user from the token alone — no login wall, no failed unsub probes.
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'ReviewHub <noreply@reviewhub.review>',
    to: userEmail,
    subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${oneClickUnsubUrl}>, <mailto:unsubscribe@reviewhub.review?subject=unsubscribe%20digest>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
}

// Review request: ask a customer to leave a review on a specific platform.
// trackUrl is the click-tracking redirect URL (our server logs the click then
// redirects to the real platform review URL).
async function sendReviewRequest({ customerEmail, customerName, businessName, platform, message, trackUrl, isFollowUp = false }) {
  const safeName = escapeHtml(customerName);
  const safeBiz = escapeHtml(businessName);
  const safePlatform = escapeHtml(platform.charAt(0).toUpperCase() + platform.slice(1));
  const safeMsg = message ? escapeHtml(message) : null;
  const safeUrl = escapeHtml(trackUrl);

  // Subjects follow the design spec — personal + low-pressure. The
  // follow-up uses "Last one, promise 🙏" phrasing so recipients don't
  // feel harassed.
  const subject = isFollowUp
    ? `Last one, promise 🙏`
    : `Thanks for stopping by — ${businessName}`;
  const introText = isFollowUp
    ? `One gentle nudge and then I'll stop. 🙏`
    : `Thanks for swinging by ${safeBiz} — hope it hit the spot.`;
  const asksText = isFollowUp
    ? `If the visit was good, would you drop a line on ${safePlatform}? If it wasn't — I genuinely want to hear why. Reply to this email directly and it goes straight to me.`
    : `If you have 20 seconds, a quick review on ${safePlatform} would mean the world to us. We're a tiny team and every word genuinely helps other neighbors find us.`;

  // Personal-letter aesthetic: Georgia serif for the greeting + sign-off,
  // sans for body. 5-star inline row on the primary request email so users
  // can tap-to-rate. Follow-up shows a primary "leave a review" CTA plus
  // a "tell me privately" mailto fallback for low-friction negative feedback.
  const html = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <tr><td align="center" style="padding:${isFollowUp ? '40' : '36'}px 24px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
      <tr><td style="font-family:Georgia,serif;font-size:${isFollowUp ? '26' : '28'}px;color:#0f172a;line-height:1.3;letter-spacing:-0.01em;padding-bottom:18px;">
        Hi ${safeName},
      </td></tr>
      <tr><td style="font-size:16px;color:#334155;line-height:1.6;padding-bottom:16px;">
        ${escapeHtml(introText)}
      </td></tr>
      <tr><td style="font-size:16px;color:#334155;line-height:1.6;padding-bottom:24px;">
        ${escapeHtml(asksText)}
      </td></tr>
      ${safeMsg ? `<tr><td style="padding-bottom:20px;">
        <blockquote style="border-left:3px solid #2563eb;margin:0;padding:10px 16px;color:#4b5563;font-style:italic;background:#f8fafc;border-radius:4px;">${safeMsg}</blockquote>
      </td></tr>` : ''}
      ${isFollowUp ? `
      <tr><td align="center" style="padding:8px 0 24px;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:0 6px;">
              <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#6366f1);color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;">Leave a ${safePlatform} review</a>
            </td>
            <td style="padding:0 6px;">
              <a href="mailto:support@reviewhub.review?subject=Feedback%20about%20${encodeURIComponent(businessName)}" style="display:inline-block;background:#f1f5f9;color:#0f172a;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:10px;">Tell me privately</a>
            </td>
          </tr>
        </table>
      </td></tr>` : `
      <tr><td align="center" style="padding:8px 0 24px;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:0 4px;"><a href="${safeUrl}" style="text-decoration:none;font-size:32px;color:#f59e0b;">★</a></td>
            <td style="padding:0 4px;"><a href="${safeUrl}" style="text-decoration:none;font-size:32px;color:#f59e0b;">★</a></td>
            <td style="padding:0 4px;"><a href="${safeUrl}" style="text-decoration:none;font-size:32px;color:#f59e0b;">★</a></td>
            <td style="padding:0 4px;"><a href="${safeUrl}" style="text-decoration:none;font-size:32px;color:#f59e0b;">★</a></td>
            <td style="padding:0 4px;"><a href="${safeUrl}" style="text-decoration:none;font-size:32px;color:#f59e0b;">★</a></td>
          </tr>
        </table>
        <div style="font-size:12px;color:#94a3b8;margin-top:8px;">Tap a star to leave a review on ${safePlatform}</div>
      </td></tr>`}
      <tr><td style="font-size:${isFollowUp ? '14' : '16'}px;color:#${isFollowUp ? '64748b' : '334155'};line-height:1.6;padding-bottom:8px;">
        ${isFollowUp ? 'Either way — thanks for being here.' : 'Either way, thanks for being here.'}
      </td></tr>
      <tr><td style="font-family:Georgia,serif;font-size:17px;color:#0f172a;padding-bottom:32px;font-style:italic;">
        — ${safeBiz}
      </td></tr>
      <tr><td style="border-top:1px solid #e2e8f0;padding-top:16px;padding-bottom:24px;font-size:11px;color:#94a3b8;line-height:1.55;" align="center">
        You received this because ${safeBiz} invited you to share your experience.<br>
        <span style="color:#cbd5e1;">Sent via ReviewHub</span>
      </td></tr>
    </table>
  </td></tr>
</table>`;
  const introPlain = isFollowUp
    ? `Hi ${customerName}, one gentle nudge and then I'll stop. If the visit was good, a quick review on ${platform} would mean a lot. If it wasn't, reply to this email directly.`
    : `Thanks for swinging by ${businessName} — hope it hit the spot. If you have 20 seconds, a quick review on ${platform} would mean the world to us.`;
  const text = [
    `Hi ${customerName},`,
    '',
    introPlain,
    safeMsg ? `\n"${message}"\n` : '',
    `Leave a review: ${trackUrl}`,
    '',
    `You received this because ${businessName} invited you.`,
  ].filter(s => s !== null).join('\n');

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EMAIL] Review request → ${customerEmail}: ${businessName} on ${platform}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'ReviewHub <noreply@reviewhub.review>',
    to: customerEmail,
    subject,
    html,
    text,
  });
}

// 2FA challenge code. The code is prominent in both the subject preheader
// and the body so users on mobile lockscreens see it without opening the
// mail. Intentionally terse — these arrive on every login attempt.
async function sendMfaCode(userEmail, code, purpose = 'login') {
  const safeCode = escapeHtml(code);
  const subject = purpose === 'enable'
    ? `Your ReviewHub verification code: ${code}`
    : `Your ReviewHub sign-in code: ${code}`;
  const intro = purpose === 'enable'
    ? 'Enter this code to turn on two-factor authentication:'
    : 'Enter this code to finish signing in:';
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#2563eb">${purpose === 'enable' ? 'Enable 2FA' : 'Sign-in code'}</h2>
      <p>${intro}</p>
      <p style="font-size:32px;letter-spacing:6px;font-weight:700;background:#f3f4f6;padding:16px;text-align:center;border-radius:8px;font-family:monospace">
        ${safeCode}
      </p>
      <p style="font-size:12px;color:#6b7280">This code is valid for 10 minutes. If you didn't request it, you can ignore this email — your account is safe.</p>
    </div>`;
  const text = [
    purpose === 'enable' ? 'Enable 2FA' : 'Sign-in code',
    '',
    intro,
    '',
    `    ${code}`,
    '',
    "This code is valid for 10 minutes. If you didn't request it, you can ignore this email.",
  ].join('\n');

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EMAIL] MFA code (${purpose}) → ${userEmail}: ${code}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'ReviewHub <noreply@reviewhub.review>',
    to: userEmail,
    subject,
    html,
    text,
  });
}

// Confirm a pending email change by emailing the NEW address. Separate from
// sendVerificationEmail so the subject + body make sense for "change"
// rather than "verify for the first time".
async function sendEmailChangeConfirmation(newEmail, confirmUrl) {
  const subject = 'Confirm your new ReviewHub email';
  const safeUrl = escapeHtml(confirmUrl);
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#2563eb">Confirm your new email</h2>
      <p>We received a request to change the email on your ReviewHub account to this address. Click the button below to confirm the change.</p>
      <p>The link is valid for 1 hour. If you didn't request this, you can safely ignore this email — your existing email will stay as it is.</p>
      <p style="margin:24px 0">
        <a href="${safeUrl}"
           style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
          Confirm email change
        </a>
      </p>
      <p style="font-size:12px;color:#6b7280">If the button doesn't work, paste this URL into your browser:<br>${safeUrl}</p>
      <p style="font-size:11px;color:#9ca3af;margin-top:24px">ReviewHub · you're receiving this because someone entered this address as a new email on their account.</p>
    </div>`;
  const text = [
    'Confirm your new ReviewHub email',
    '',
    'Click the link to confirm changing your account email to this address:',
    confirmUrl,
    '',
    'Valid for 1 hour. If you did not request this, ignore this email.',
  ].join('\n');

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EMAIL] Email-change confirm → ${newEmail}: ${confirmUrl}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'ReviewHub <noreply@reviewhub.review>',
    to: newEmail,
    subject,
    html,
    text,
  });
}

// Alert the CURRENT email address that an email-change was just requested
// for their account. Goes out to the old address at the same time the confirm
// link goes to the new address — if the change was malicious, the legitimate
// account owner learns about it before the attacker completes verification.
// Includes no action link (user who didn't initiate should reset password
// via the standard forgot-password flow).
async function sendEmailChangeAlert(oldEmail, newEmail) {
  const safeNew = escapeHtml(newEmail);
  const safeUrl = escapeHtml(process.env.CLIENT_URL || 'http://localhost:5173');
  const subject = 'Email change requested on your ReviewHub account';
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#b45309">Email change requested</h2>
      <p>Someone just requested to change the email on your ReviewHub account to:</p>
      <p style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;margin:16px 0;font-family:monospace">
        ${safeNew}
      </p>
      <p>If that was you, you can ignore this message — the change only takes effect after you click the confirm link we sent to the new address.</p>
      <p><strong>If it wasn't you</strong>, your account may be compromised. Sign in and change your password immediately:</p>
      <p style="margin:16px 0">
        <a href="${safeUrl}/forgot-password"
           style="background:#dc2626;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
          Secure your account
        </a>
      </p>
      <p style="font-size:11px;color:#9ca3af;margin-top:24px">
        You received this because someone requested an email change on ReviewHub. No action is required unless you didn't initiate this.
      </p>
    </div>`;
  const text = [
    'Email change requested on your ReviewHub account',
    '',
    `Someone just requested to change the email on your account to: ${newEmail}`,
    '',
    `If it wasn't you, sign in and change your password now: ${process.env.CLIENT_URL || 'http://localhost:5173'}/forgot-password`,
  ].join('\n');

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EMAIL] Email-change alert → ${oldEmail}: new=${newEmail}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'ReviewHub <noreply@reviewhub.review>',
    to: oldEmail,
    subject,
    html,
    text,
  });
}

// GDPR Article 17 erasure-request confirmation. Sent in response to a
// /api/gdpr/erasure-request POST. The user must click the link inside
// (which lands on the SPA's confirm page → POSTs the token to
// /api/gdpr/confirm-erasure) for the actual deletion to fire.
//
// Why a confirmation step at all: erasure is irreversible. Two factors
// guard it — (a) the requester must be authenticated to start the flow,
// (b) they must hold the inbox to complete it. Cuts off "I left my laptop
// open at the cafe and someone clicked Delete Account" scenarios.
async function sendErasureConfirmation(userEmail, confirmUrl) {
  const subject = 'Confirm your ReviewHub account deletion';
  const safeUrl = escapeHtml(confirmUrl);
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#dc2626">Confirm account deletion</h2>
      <p>You requested permanent deletion of your ReviewHub account and all associated data. This action is irreversible — once confirmed, your reviews, settings, audit trail, and connected platforms are removed and cannot be recovered.</p>
      <p style="margin:24px 0">
        <a href="${safeUrl}"
           style="background:#dc2626;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
          Confirm deletion
        </a>
      </p>
      <p style="font-size:12px;color:#6b7280">If the button doesn't work, paste this URL into your browser:<br>${safeUrl}</p>
      <p style="font-size:11px;color:#9ca3af;margin-top:24px">This link is valid for 24 hours. If you did not request deletion, you can safely ignore this email — nothing will be removed.</p>
    </div>`;
  const text = [
    'Confirm ReviewHub account deletion',
    '',
    'You requested permanent deletion of your ReviewHub account.',
    'This action is irreversible. To proceed, click:',
    confirmUrl,
    '',
    'This link is valid for 24 hours.',
    "If you didn't request this, you can safely ignore this email.",
  ].join('\n');

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EMAIL] Erasure confirmation → ${userEmail}: ${confirmUrl}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'ReviewHub <noreply@reviewhub.review>',
    to: userEmail,
    subject,
    html,
    text,
  });
}

module.exports = {
  sendNewReviewNotification,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWeeklyDigest,
  sendMfaCode,
  sendEmailChangeAlert,
  sendEmailChangeConfirmation,
  sendReviewRequest,
  sendErasureConfirmation,
  verifySmtp,
  portBlockHint,
};
