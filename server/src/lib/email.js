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

const NEW_REVIEW_STRINGS = {
  en: {
    subjectPrefix: 'New',
    subjectFor: 'review for',
    headlinePrefix: 'New Review on',
    leftA: 'left a',
    starReview: 'star review for',
    sentiment: 'Sentiment',
    cta: 'View & Respond',
    footer: 'ReviewHub · Manage notifications in Settings',
    textHeadline: (platform) => `New Review on ${platform}`,
    textIntro: (name, rating, biz) => `${name} left a ${rating}-star review for ${biz}`,
    textViewAt: 'View and respond:',
  },
  th: {
    subjectPrefix: 'รีวิวใหม่',
    subjectFor: 'สำหรับ',
    headlinePrefix: 'รีวิวใหม่บน',
    leftA: 'ให้รีวิว',
    starReview: 'ดาวสำหรับ',
    sentiment: 'ความรู้สึก',
    cta: 'ดูและตอบกลับ',
    footer: 'ReviewHub · จัดการการแจ้งเตือนในหน้า Settings',
    textHeadline: (platform) => `รีวิวใหม่บน ${platform}`,
    textIntro: (name, rating, biz) => `${name} ให้รีวิว ${rating} ดาวสำหรับ ${biz}`,
    textViewAt: 'ดูและตอบกลับ:',
  },
};

async function sendNewReviewNotification(userEmail, review, businessName, lang = 'en') {
  const s = NEW_REVIEW_STRINGS[lang] || NEW_REVIEW_STRINGS.en;
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

  // Strip newlines/carriage returns from values used in email headers to prevent header injection
  const stripHeaderChars = (str) => String(str ?? '').replace(/[\r\n]/g, ' ');

  const safePlatform = escapeHtml(platformLabel(review.platform));
  const safeName = escapeHtml(review.reviewer_name);
  const safeText = escapeHtml(review.review_text || '(no text)');
  const safeSentiment = escapeHtml(review.sentiment);
  const safeBizName = escapeHtml(businessName);
  const safeClientUrl = escapeHtml(process.env.CLIENT_URL || 'http://localhost:5173');

  // Subject uses stripHeaderChars to prevent email header injection
  const subject = `${s.subjectPrefix} ${stripHeaderChars(platformLabel(review.platform))} ${s.subjectFor} ${stripHeaderChars(businessName)} — ${stars}`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1e4d5e">${s.headlinePrefix} ${safePlatform}</h2>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0">
        <p><strong>${safeName}</strong> ${s.leftA} <strong>${review.rating} ${s.starReview}</strong> <strong>${safeBizName}</strong></p>
        <p style="color:#374151">&ldquo;${safeText}&rdquo;</p>
        <p style="font-size:12px;color:#6b7280">${s.sentiment}: ${safeSentiment} · ${new Date().toLocaleDateString()}</p>
      </div>
      <a href="${safeClientUrl}/dashboard"
         style="background:#1e4d5e;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
        ${escapeHtml(s.cta)}
      </a>
      <p style="font-size:11px;color:#9ca3af;margin-top:24px">${s.footer}</p>
    </div>`;

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EMAIL] New review notification → ${userEmail}: ${subject}`);
    return;
  }

  const text = [
    s.textHeadline(platformLabel(review.platform)),
    s.textIntro(review.reviewer_name, review.rating, businessName),
    `"${review.review_text || '(no text)'}"`,
    `${s.sentiment}: ${review.sentiment}`,
    ``,
    `${s.textViewAt} ${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard`,
    ``,
    s.footer,
  ].join('\n');

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'ReviewHub <noreply@reviewhub.review>',
    to: userEmail,
    subject,
    html,
    text,
  });
}

// Localised strings for the verification email. English is the source of
// truth; other locales fall back to English for any missing key. To add a
// language: copy the `en` block, translate, drop in. The `lang` param to
// sendVerificationEmail picks the matching block.
const VERIFY_STRINGS = {
  en: {
    subject: 'Confirm your email — one click and you\'re in',
    headline: "One click and you're in.",
    body: "Confirm your email and you'll be drafting AI replies in under a minute. This link expires in 24 hours.",
    cta: 'Confirm my email',
    pasteHint: 'Or paste this into your browser:',
    ignoreFooter: "Didn't sign up? You can safely ignore this email — no account will be created.",
    textHeader: 'Welcome to ReviewHub',
    textBody: 'Confirm your email address to finish setting up your account.',
    textValid: 'This link is valid for 24 hours:',
    textIgnore: "If you didn't create a ReviewHub account, you can ignore this email.",
  },
  th: {
    subject: 'ยืนยันอีเมลของคุณ — คลิกเดียวเสร็จ',
    headline: 'คลิกเดียว ก็เริ่มใช้งานได้เลย',
    body: 'ยืนยันอีเมลของคุณ แล้วคุณจะร่างคำตอบรีวิวด้วย AI ได้ในไม่ถึงนาที ลิงก์นี้หมดอายุภายใน 24 ชั่วโมง',
    cta: 'ยืนยันอีเมล',
    pasteHint: 'หรือคัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:',
    ignoreFooter: 'ไม่ได้สมัครใช่ไหม? คุณสามารถละเลยอีเมลนี้ได้อย่างปลอดภัย — จะไม่มีการสร้างบัญชี',
    textHeader: 'ยินดีต้อนรับสู่ ReviewHub',
    textBody: 'ยืนยันอีเมลของคุณเพื่อเริ่มใช้งานบัญชี',
    textValid: 'ลิงก์นี้ใช้ได้ภายใน 24 ชั่วโมง:',
    textIgnore: 'หากคุณไม่ได้สมัครบัญชี ReviewHub สามารถละเลยอีเมลนี้ได้',
  },
};

// Send the email-verification link. `verifyUrl` is the full URL the user clicks
// (already includes the token query param). `lang` is the user's preferred
// locale (currently 'en' or 'th' — others fall back to en). Plaintext + HTML
// versions are sent so clients without HTML support still work.
async function sendVerificationEmail(userEmail, verifyUrl, lang = 'en') {
  const s = VERIFY_STRINGS[lang] || VERIFY_STRINGS.en;
  const subject = s.subject;
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
            <td style="width:36px;vertical-align:middle;">
              <!-- Editorial brand mark — Unicode sparkle (✦, U+2726) on
                   a teal-deep tile. Renders identically in Gmail, Apple Mail,
                   Outlook web, Outlook desktop, iOS Mail, Hotmail/Outlook.com.
                   Inline SVG would render slightly sharper but Hotmail's CSP
                   strips it (leaving an empty tile), so we use a Unicode
                   character that every email client renders natively. The
                   shape is close to the website's 4-point editorial sparkle
                   mark (client/src/components/Logo.jsx + favicon.svg). -->
              <table cellpadding="0" cellspacing="0" border="0" style="border-radius:8px;background-color:#1e4d5e;" bgcolor="#1e4d5e">
                <tr><td align="center" valign="middle" width="36" height="36" style="width:36px;height:36px;line-height:36px;">
                  <span style="color:#fbf8f1;font-size:20px;line-height:36px;font-weight:400;">&#10022;</span>
                </td></tr>
              </table>
            </td>
            <td style="padding-left:10px;vertical-align:middle;font-size:17px;font-weight:700;color:#1d242c;letter-spacing:-0.01em;">ReviewHub</td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding-bottom:16px;font-size:26px;font-weight:700;color:#1d242c;letter-spacing:-0.02em;line-height:1.2;">
        ${s.headline}
      </td></tr>
      <tr><td style="padding-bottom:28px;font-size:15px;color:#3a4248;line-height:1.55;">
        ${s.body}
      </td></tr>
      <tr><td style="padding-bottom:28px;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeUrl}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="22%" stroke="f" fillcolor="#1e4d5e">
          <w:anchorlock/>
          <center style="color:#fbf8f1;font-family:sans-serif;font-size:15px;font-weight:700;">${escapeHtml(s.cta)}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <a href="${safeUrl}" bgcolor="#1e4d5e" style="display:inline-block;background-color:#1e4d5e;color:#fbf8f1;font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;mso-padding-alt:0;" target="_blank">${escapeHtml(s.cta)} &rarr;</a>
        <!--<![endif]-->
      </td></tr>
      <tr><td style="padding-bottom:24px;font-size:13px;color:#7a8189;line-height:1.55;">
        ${s.pasteHint}<br><span style="color:#1e4d5e;word-break:break-all;">${safeUrl}</span>
      </td></tr>
      <tr><td style="border-top:1px solid #e6dfce;padding-top:20px;padding-bottom:32px;font-size:12px;color:#7a8189;line-height:1.55;">
        ${s.ignoreFooter}
      </td></tr>
    </table>
  </td></tr>
</table>`;
  const text = [
    s.textHeader,
    '',
    s.textBody,
    s.textValid,
    verifyUrl,
    '',
    s.textIgnore,
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

// Localised strings for password-reset email. See VERIFY_STRINGS comment.
const RESET_STRINGS = {
  en: {
    subject: 'Reset your ReviewHub password',
    headline: 'Password reset',
    body: 'We received a request to reset the password for your ReviewHub account. This link is valid for 1 hour.',
    cta: 'Reset password',
    pasteHint: "If the button doesn't work, paste this URL into your browser:",
    ignoreFooter: "If you didn't request this, you can safely ignore this email — your password won't change.",
    textValid: 'This link is valid for 1 hour:',
    textIgnore: "If you didn't request this, you can safely ignore this email.",
  },
  th: {
    subject: 'รีเซ็ตรหัสผ่าน ReviewHub ของคุณ',
    headline: 'รีเซ็ตรหัสผ่าน',
    body: 'เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชี ReviewHub ของคุณ ลิงก์นี้ใช้ได้ภายใน 1 ชั่วโมง',
    cta: 'รีเซ็ตรหัสผ่าน',
    pasteHint: 'หากปุ่มใช้งานไม่ได้ ให้คัดลอก URL นี้ไปวางในเบราว์เซอร์:',
    ignoreFooter: 'หากคุณไม่ได้ส่งคำขอนี้ สามารถละเลยอีเมลนี้ได้อย่างปลอดภัย — รหัสผ่านของคุณจะไม่เปลี่ยนแปลง',
    textValid: 'ลิงก์นี้ใช้ได้ภายใน 1 ชั่วโมง:',
    textIgnore: 'หากคุณไม่ได้ส่งคำขอนี้ สามารถละเลยอีเมลนี้ได้อย่างปลอดภัย',
  },
};

// Send the password-reset link. Valid for 1 hour.
async function sendPasswordResetEmail(userEmail, resetUrl, lang = 'en') {
  const s = RESET_STRINGS[lang] || RESET_STRINGS.en;
  const subject = s.subject;
  const safeUrl = escapeHtml(resetUrl);
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1e4d5e">${s.headline}</h2>
      <p>${s.body}</p>
      <p style="margin:24px 0">
        <a href="${safeUrl}"
           style="background:#1e4d5e;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
          ${escapeHtml(s.cta)}
        </a>
      </p>
      <p style="font-size:12px;color:#6b7280">${s.pasteHint}<br>${safeUrl}</p>
      <p style="font-size:11px;color:#9ca3af;margin-top:24px">${s.ignoreFooter}</p>
    </div>`;
  const text = [
    s.headline,
    '',
    s.body,
    s.textValid,
    resetUrl,
    '',
    s.textIgnore,
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
    return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4eee0;border-radius:8px;overflow:hidden;">
      <tr>
        ${posPct > 0 ? `<td width="${posPct}%" height="6" style="background:#7a9b78;font-size:0;line-height:0;">&nbsp;</td>` : ''}
        ${neuPct > 0 ? `<td width="${neuPct}%" height="6" style="background:#c48a2c;font-size:0;line-height:0;">&nbsp;</td>` : ''}
        ${negPct > 0 ? `<td width="${negPct}%" height="6" style="background:#b85450;font-size:0;line-height:0;">&nbsp;</td>` : ''}
      </tr>
    </table>
    <div style="font-size:11px;color:#7a8189;margin-top:6px;">${positive} positive · ${total - positive - negative} neutral · ${negative} critical</div>`;
  })() : '';

  // Critical callout — most negative unresponded review, if one exists. Uses
  // the design's red-tinted card with a prominent "Draft reply" CTA.
  const criticalReview = recentReviews.find(r => r.rating <= 2 && !r.response_text);
  const criticalBlock = criticalReview ? `
    <tr><td style="padding:0 28px 16px;">
      <div style="font-size:11px;font-weight:700;color:#7a8189;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">⚠ Needs a reply</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;">
        <tr><td style="padding:14px 16px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="font-size:13px;color:#a06d1c;font-weight:700;">${escapeHtml(criticalReview.reviewer_name || 'Anonymous')} · ${'★'.repeat(criticalReview.rating)}${'☆'.repeat(5 - criticalReview.rating)}</td>
              <td align="right" style="font-size:11px;color:#a06d1c;">${escapeHtml(criticalReview.platform.charAt(0).toUpperCase() + criticalReview.platform.slice(1))}</td>
            </tr>
          </table>
          <div style="font-size:13px;color:#7f1d1d;line-height:1.5;margin-top:6px;">"${escapeHtml((criticalReview.review_text || '').slice(0, 160))}${(criticalReview.review_text || '').length > 160 ? '…' : ''}"</div>
          <a href="${safeUrl}/dashboard?responded=no" style="display:inline-block;margin-top:12px;background:#b85450;color:#fff;font-size:12px;font-weight:700;text-decoration:none;padding:8px 14px;border-radius:7px;">✨ Draft reply</a>
        </td></tr>
      </table>
    </td></tr>` : '';

  // Highlight callout — best positive review of the week, if any.
  const highlightReview = recentReviews.find(r => r.rating >= 5);
  const highlightBlock = highlightReview ? `
    <tr><td style="padding:0 28px 24px;">
      <div style="font-size:11px;font-weight:700;color:#7a8189;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">✨ Highlight of the week</div>
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

  const html = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4eee0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <tr><td align="center" style="padding:24px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;">
      <tr><td style="background-color:#1e4d5e;padding:28px 28px 24px;">
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
            <td width="33%"><div style="font-size:28px;font-weight:800;color:#1d242c;letter-spacing:-0.02em;">${total}</div><div style="font-size:12px;color:#7a8189;margin-top:2px;">new reviews</div></td>
            <td width="33%"><div style="font-size:28px;font-weight:800;color:#c48a2c;letter-spacing:-0.02em;">${avg_rating != null ? avg_rating : '—'} ★</div><div style="font-size:12px;color:#7a8189;margin-top:2px;">avg rating</div></td>
            <td width="33%"><div style="font-size:28px;font-weight:800;color:#b85450;letter-spacing:-0.02em;">${unresponded}</div><div style="font-size:12px;color:#7a8189;margin-top:2px;">need a reply</div></td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:8px 28px 24px;">${sentimentBar}</td></tr>
      ${criticalBlock}
      ${highlightBlock}
      <tr><td align="center" style="padding:0 28px 32px;">
        <a href="${safeUrl}/dashboard" style="display:inline-block;background:#1d242c;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 24px;border-radius:10px;">Open dashboard →</a>
      </td></tr>
      <tr><td style="border-top:1px solid #e6dfce;padding:18px 28px;font-size:11px;color:#7a8189;line-height:1.55;" align="center">
        You get this every Monday. <a href="${safeUrl}/settings" style="color:#7a8189;">Change frequency</a> · <a href="${escapeHtml(oneClickUnsubUrl)}" style="color:#7a8189;">Unsubscribe</a>
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
      <tr><td style="font-family:Georgia,serif;font-size:${isFollowUp ? '26' : '28'}px;color:#1d242c;line-height:1.3;letter-spacing:-0.01em;padding-bottom:18px;">
        Hi ${safeName},
      </td></tr>
      <tr><td style="font-size:16px;color:#334155;line-height:1.6;padding-bottom:16px;">
        ${escapeHtml(introText)}
      </td></tr>
      <tr><td style="font-size:16px;color:#334155;line-height:1.6;padding-bottom:24px;">
        ${escapeHtml(asksText)}
      </td></tr>
      ${safeMsg ? `<tr><td style="padding-bottom:20px;">
        <blockquote style="border-left:3px solid #1e4d5e;margin:0;padding:10px 16px;color:#4b5563;font-style:italic;background:#f4eee0;border-radius:4px;">${safeMsg}</blockquote>
      </td></tr>` : ''}
      ${isFollowUp ? `
      <tr><td align="center" style="padding:8px 0 24px;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:0 6px;">
              <a href="${safeUrl}" style="display:inline-block;background-color:#1e4d5e;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;">Leave a ${safePlatform} review</a>
            </td>
            <td style="padding:0 6px;">
              <a href="mailto:support@reviewhub.review?subject=Feedback%20about%20${encodeURIComponent(businessName)}" style="display:inline-block;background:#f4eee0;color:#1d242c;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:10px;">Tell me privately</a>
            </td>
          </tr>
        </table>
      </td></tr>` : `
      <tr><td align="center" style="padding:8px 0 24px;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:0 4px;"><a href="${safeUrl}" style="text-decoration:none;font-size:32px;color:#c48a2c;">★</a></td>
            <td style="padding:0 4px;"><a href="${safeUrl}" style="text-decoration:none;font-size:32px;color:#c48a2c;">★</a></td>
            <td style="padding:0 4px;"><a href="${safeUrl}" style="text-decoration:none;font-size:32px;color:#c48a2c;">★</a></td>
            <td style="padding:0 4px;"><a href="${safeUrl}" style="text-decoration:none;font-size:32px;color:#c48a2c;">★</a></td>
            <td style="padding:0 4px;"><a href="${safeUrl}" style="text-decoration:none;font-size:32px;color:#c48a2c;">★</a></td>
          </tr>
        </table>
        <div style="font-size:12px;color:#7a8189;margin-top:8px;">Tap a star to leave a review on ${safePlatform}</div>
      </td></tr>`}
      <tr><td style="font-size:${isFollowUp ? '14' : '16'}px;color:#${isFollowUp ? '64748b' : '334155'};line-height:1.6;padding-bottom:8px;">
        ${isFollowUp ? 'Either way — thanks for being here.' : 'Either way, thanks for being here.'}
      </td></tr>
      <tr><td style="font-family:Georgia,serif;font-size:17px;color:#1d242c;padding-bottom:32px;font-style:italic;">
        — ${safeBiz}
      </td></tr>
      <tr><td style="border-top:1px solid #e6dfce;padding-top:16px;padding-bottom:24px;font-size:11px;color:#7a8189;line-height:1.55;" align="center">
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

// Localised strings for the 2FA email. Two-key shape: { login, enable }
// for each language so the subject + headline match the purpose.
const MFA_STRINGS = {
  en: {
    login: { subject: 'Your ReviewHub sign-in code', headline: 'Sign-in code', intro: 'Enter this code to finish signing in:' },
    enable: { subject: 'Your ReviewHub verification code', headline: 'Enable 2FA', intro: 'Enter this code to turn on two-factor authentication:' },
    validFooter: "This code is valid for 10 minutes. If you didn't request it, you can ignore this email — your account is safe.",
    textValidFooter: "This code is valid for 10 minutes. If you didn't request it, you can ignore this email.",
  },
  th: {
    login: { subject: 'รหัสเข้าสู่ระบบ ReviewHub ของคุณ', headline: 'รหัสเข้าสู่ระบบ', intro: 'กรอกรหัสนี้เพื่อเข้าสู่ระบบ:' },
    enable: { subject: 'รหัสยืนยัน ReviewHub ของคุณ', headline: 'เปิดใช้งาน 2FA', intro: 'กรอกรหัสนี้เพื่อเปิดใช้การยืนยันตัวตนสองขั้นตอน:' },
    validFooter: 'รหัสนี้ใช้ได้ 10 นาที หากคุณไม่ได้ส่งคำขอ สามารถละเลยอีเมลนี้ได้ — บัญชีของคุณปลอดภัย',
    textValidFooter: 'รหัสนี้ใช้ได้ 10 นาที หากคุณไม่ได้ส่งคำขอ สามารถละเลยอีเมลนี้ได้',
  },
};

// 2FA challenge code. The code is prominent in both the subject preheader
// and the body so users on mobile lockscreens see it without opening the
// mail. Intentionally terse — these arrive on every login attempt.
async function sendMfaCode(userEmail, code, purpose = 'login', lang = 'en') {
  const safeCode = escapeHtml(code);
  const ls = MFA_STRINGS[lang] || MFA_STRINGS.en;
  const p = ls[purpose] || ls.login;
  const subject = `${p.subject}: ${code}`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#1e4d5e">${p.headline}</h2>
      <p>${p.intro}</p>
      <p style="font-size:32px;letter-spacing:6px;font-weight:700;background:#f3f4f6;padding:16px;text-align:center;border-radius:8px;font-family:monospace">
        ${safeCode}
      </p>
      <p style="font-size:12px;color:#6b7280">${ls.validFooter}</p>
    </div>`;
  const text = [
    p.headline,
    '',
    p.intro,
    '',
    `    ${code}`,
    '',
    ls.textValidFooter,
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
const CHANGE_STRINGS = {
  en: {
    subject: 'Confirm your new ReviewHub email',
    headline: 'Confirm your new email',
    body1: 'We received a request to change the email on your ReviewHub account to this address. Click the button below to confirm the change.',
    body2: "The link is valid for 1 hour. If you didn't request this, you can safely ignore this email — your existing email will stay as it is.",
    cta: 'Confirm email change',
    pasteHint: "If the button doesn't work, paste this URL into your browser:",
    footer: "ReviewHub · you're receiving this because someone entered this address as a new email on their account.",
    textIntro: 'Click the link to confirm changing your account email to this address:',
    textValid: 'Valid for 1 hour. If you did not request this, ignore this email.',
  },
  th: {
    subject: 'ยืนยันอีเมลใหม่ของ ReviewHub',
    headline: 'ยืนยันอีเมลใหม่ของคุณ',
    body1: 'เราได้รับคำขอเปลี่ยนอีเมลของบัญชี ReviewHub เป็นอีเมลนี้ คลิกปุ่มด้านล่างเพื่อยืนยันการเปลี่ยนแปลง',
    body2: 'ลิงก์ใช้ได้ภายใน 1 ชั่วโมง หากคุณไม่ได้ส่งคำขอ สามารถละเลยอีเมลนี้ได้ — อีเมลเดิมจะยังคงอยู่',
    cta: 'ยืนยันการเปลี่ยนอีเมล',
    pasteHint: 'หากปุ่มใช้ไม่ได้ ให้คัดลอก URL นี้ไปวางในเบราว์เซอร์:',
    footer: 'ReviewHub · คุณได้รับอีเมลนี้เพราะมีผู้ระบุอีเมลนี้เป็นอีเมลใหม่บนบัญชีของพวกเขา',
    textIntro: 'คลิกลิงก์เพื่อยืนยันการเปลี่ยนอีเมลบัญชีเป็นอีเมลนี้:',
    textValid: 'ใช้ได้ภายใน 1 ชั่วโมง หากคุณไม่ได้ส่งคำขอ ให้ละเลยอีเมลนี้',
  },
};

async function sendEmailChangeConfirmation(newEmail, confirmUrl, lang = 'en') {
  const s = CHANGE_STRINGS[lang] || CHANGE_STRINGS.en;
  const subject = s.subject;
  const safeUrl = escapeHtml(confirmUrl);
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1e4d5e">${s.headline}</h2>
      <p>${s.body1}</p>
      <p>${s.body2}</p>
      <p style="margin:24px 0">
        <a href="${safeUrl}"
           style="background:#1e4d5e;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
          ${escapeHtml(s.cta)}
        </a>
      </p>
      <p style="font-size:12px;color:#6b7280">${s.pasteHint}<br>${safeUrl}</p>
      <p style="font-size:11px;color:#9ca3af;margin-top:24px">${s.footer}</p>
    </div>`;
  const text = [
    s.subject,
    '',
    s.textIntro,
    confirmUrl,
    '',
    s.textValid,
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
const ALERT_STRINGS = {
  en: {
    subject: 'Email change requested on your ReviewHub account',
    headline: 'Email change requested',
    introBlock: 'Someone just requested to change the email on your ReviewHub account to:',
    ifYou: 'If that was you, you can ignore this message — the change only takes effect after you click the confirm link we sent to the new address.',
    ifNot: "If it wasn't you",
    ifNotBody: ', your account may be compromised. Sign in and change your password immediately:',
    cta: 'Secure your account',
    footer: "You received this because someone requested an email change on ReviewHub. No action is required unless you didn't initiate this.",
    textBody: (newEmail) => `Someone just requested to change the email on your account to: ${newEmail}`,
    textCta: (url) => `If it wasn't you, sign in and change your password now: ${url}/forgot-password`,
  },
  th: {
    subject: 'มีคำขอเปลี่ยนอีเมลในบัญชี ReviewHub ของคุณ',
    headline: 'มีคำขอเปลี่ยนอีเมล',
    introBlock: 'มีผู้ส่งคำขอเปลี่ยนอีเมลของบัญชี ReviewHub ของคุณเป็น:',
    ifYou: 'หากเป็นคุณเอง สามารถละเลยข้อความนี้ได้ — การเปลี่ยนแปลงจะมีผลก็ต่อเมื่อคลิกลิงก์ยืนยันที่ส่งไปยังอีเมลใหม่',
    ifNot: 'หากไม่ใช่คุณ',
    ifNotBody: ' บัญชีของคุณอาจถูกบุกรุก เข้าสู่ระบบและเปลี่ยนรหัสผ่านทันที:',
    cta: 'รักษาความปลอดภัยบัญชี',
    footer: 'คุณได้รับอีเมลนี้เพราะมีผู้ขอเปลี่ยนอีเมลบน ReviewHub ไม่ต้องทำอะไรหากเป็นคุณเอง',
    textBody: (newEmail) => `มีผู้ส่งคำขอเปลี่ยนอีเมลของบัญชีคุณเป็น: ${newEmail}`,
    textCta: (url) => `หากไม่ใช่คุณ ให้เข้าสู่ระบบและเปลี่ยนรหัสผ่านทันที: ${url}/forgot-password`,
  },
};

async function sendEmailChangeAlert(oldEmail, newEmail, lang = 'en') {
  const s = ALERT_STRINGS[lang] || ALERT_STRINGS.en;
  const safeNew = escapeHtml(newEmail);
  const safeUrl = escapeHtml(process.env.CLIENT_URL || 'http://localhost:5173');
  const subject = s.subject;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#b45309">${s.headline}</h2>
      <p>${s.introBlock}</p>
      <p style="background:#fef3c7;border-left:4px solid #c48a2c;padding:12px 16px;margin:16px 0;font-family:monospace">
        ${safeNew}
      </p>
      <p>${s.ifYou}</p>
      <p><strong>${s.ifNot}</strong>${s.ifNotBody}</p>
      <p style="margin:16px 0">
        <a href="${safeUrl}/forgot-password"
           style="background:#b85450;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
          ${escapeHtml(s.cta)}
        </a>
      </p>
      <p style="font-size:11px;color:#9ca3af;margin-top:24px">
        ${s.footer}
      </p>
    </div>`;
  const text = [
    s.subject,
    '',
    s.textBody(newEmail),
    '',
    s.textCta(process.env.CLIENT_URL || 'http://localhost:5173'),
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
const ERASURE_STRINGS = {
  en: {
    subject: 'Confirm your ReviewHub account deletion',
    headline: 'Confirm account deletion',
    body: 'You requested permanent deletion of your ReviewHub account and all associated data. This action is irreversible — once confirmed, your reviews, settings, audit trail, and connected platforms are removed and cannot be recovered.',
    cta: 'Confirm deletion',
    pasteHint: "If the button doesn't work, paste this URL into your browser:",
    footer: 'This link is valid for 24 hours. If you did not request deletion, you can safely ignore this email — nothing will be removed.',
    textBody: 'You requested permanent deletion of your ReviewHub account.',
    textIrreversible: 'This action is irreversible. To proceed, click:',
    textValid: 'This link is valid for 24 hours.',
    textIgnore: "If you didn't request this, you can safely ignore this email.",
  },
  th: {
    subject: 'ยืนยันการลบบัญชี ReviewHub ของคุณ',
    headline: 'ยืนยันการลบบัญชี',
    body: 'คุณได้ส่งคำขอลบบัญชี ReviewHub และข้อมูลที่เกี่ยวข้องอย่างถาวร การกระทำนี้ไม่สามารถย้อนกลับได้ — เมื่อยืนยันแล้ว รีวิว การตั้งค่า ประวัติ และแพลตฟอร์มที่เชื่อมต่อทั้งหมดจะถูกลบและไม่สามารถกู้คืนได้',
    cta: 'ยืนยันการลบ',
    pasteHint: 'หากปุ่มใช้ไม่ได้ ให้คัดลอก URL นี้ไปวางในเบราว์เซอร์:',
    footer: 'ลิงก์นี้ใช้ได้ภายใน 24 ชั่วโมง หากคุณไม่ได้ส่งคำขอลบ สามารถละเลยอีเมลนี้ได้อย่างปลอดภัย — ไม่มีอะไรจะถูกลบ',
    textBody: 'คุณได้ส่งคำขอลบบัญชี ReviewHub อย่างถาวร',
    textIrreversible: 'การกระทำนี้ไม่สามารถย้อนกลับได้ หากต้องการดำเนินการต่อ ให้คลิก:',
    textValid: 'ลิงก์นี้ใช้ได้ภายใน 24 ชั่วโมง',
    textIgnore: 'หากคุณไม่ได้ส่งคำขอนี้ สามารถละเลยอีเมลนี้ได้อย่างปลอดภัย',
  },
};

async function sendErasureConfirmation(userEmail, confirmUrl, lang = 'en') {
  const s = ERASURE_STRINGS[lang] || ERASURE_STRINGS.en;
  const subject = s.subject;
  const safeUrl = escapeHtml(confirmUrl);
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#b85450">${s.headline}</h2>
      <p>${s.body}</p>
      <p style="margin:24px 0">
        <a href="${safeUrl}"
           style="background:#b85450;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
          ${escapeHtml(s.cta)}
        </a>
      </p>
      <p style="font-size:12px;color:#6b7280">${s.pasteHint}<br>${safeUrl}</p>
      <p style="font-size:11px;color:#9ca3af;margin-top:24px">${s.footer}</p>
    </div>`;
  const text = [
    s.subject,
    '',
    s.textBody,
    s.textIrreversible,
    confirmUrl,
    '',
    s.textValid,
    s.textIgnore,
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

// Lifecycle / onboarding emails (day 0/1/3/7/14). Templates live in
// docs/gtm/onboarding-email-sequence.md as the source of truth; the
// strings below mirror that doc. Plain prose, no fancy HTML — these are
// founder-style conversion emails, not transactional templates. Markdown-
// style line breaks are preserved with a single <br> per newline so the
// HTML renders close to the plaintext.
const ONBOARDING_STRINGS = {
  en: {
    0: {
      subject: "Welcome to ReviewHub — let's reply to your first review",
      body: (clientUrl) => `Hi there,

You're in. Quick orientation:

1. Connect your first review platform (1 min)
   → ${clientUrl}/dashboard

2. Pick any review and click "Draft reply"
   AI gives you 3 tone variants. Edit, copy, paste on Google.
   Done in 10 seconds.

3. Want a personalized 10-reply audit before you commit?
   → ${clientUrl}/audit (free, no upsell)

Reply to this email if you get stuck. I read every one.

— ReviewHub
Bangkok`,
    },
    1: {
      subject: 'Stuck on setup? 60-second walkthrough',
      body: (clientUrl) => `Hi there,

Noticed you haven't connected a review platform yet — most people get stuck on the same step. Here's the fastest path:

→ Google: Sign in with the Google account that owns your business profile. We auto-find listings.
→ Wongnai: Paste your Wongnai URL. We poll it for new reviews.
→ Yelp / Trustpilot / TripAdvisor: Paste the URL. Same idea.

If you don't have access to your Google Business Profile, that's fixable — search "transfer Google Business Profile ownership" or reply and I'll walk you through it.

Not for you? Reply with one word and I'll close the loop. No follow-ups.

→ ${clientUrl}/dashboard

— ReviewHub`,
    },
    3: {
      subject: 'The reply that brought a customer back (1-min read)',
      body: (clientUrl) => `Hi there,

Quick story:

A Bangkok cafe owner I work with had a 1-star review:
"Coffee was cold, server ignored us for 20 minutes."

Most owners would either ignore it or write a defensive "We strive for excellence" reply. He used ReviewHub. The AI drafted this:

   "Hi [name], this isn't the experience we want anyone to have, and the wait is on me — Tuesday morning we were short-staffed and I pulled the wrong shift schedule. Cold coffee = unacceptable, that's a process I'm fixing today. Would love to make it right next time you're nearby — drop me a DM @cafename and your next round is on the house."

The reviewer DMed back, came in, left a 5-star edit.

That's the entire pitch. Three tone variants on every review. 10 seconds per reply.

→ ${clientUrl}/dashboard

— ReviewHub`,
    },
    7: {
      subject: 'Free plan — what you get vs Starter',
      body: (clientUrl) => `Hi there,

You've been on the free plan for a week. Quick comparison if Starter is on your radar:

FREE
- 5 AI replies / month
- 1 review platform
- Manual review check-in

STARTER ($14/mo, ~฿490)
- 50 AI replies / month
- 3 platforms
- Auto-import every 6h
- Email + weekly digest

PRO ($29/mo)
- Unlimited replies
- Wongnai included
- Auto-reply rules
- Priority support
- Multi-business (up to 3)

Most owners hit the free-plan ceiling around week 2. If you're not at 5/month, no rush — keep the free tier as long as it works for you.

→ ${clientUrl}/pricing

Reply if you have questions about which fits your business.

— ReviewHub`,
    },
    14: {
      subject: 'One last thing before I stop emailing you',
      body: (clientUrl) => `Hi there,

I won't keep sending these — last one promised.

If ReviewHub isn't the right fit, I'd genuinely love to know why. Hit reply with one sentence:

- Wrong tool? (you don't have many reviews to deal with)
- Wrong moment? (busy with other priorities)
- Wrong UX? (something specific frustrated you)
- Wrong price? (would $X make it work)

I read every reply and the answers shape what I build next.

If it IS still useful — Starter plan starts at $14/mo and includes 50 AI replies + email digest. The free plan still works for low-volume use.

→ ${clientUrl}/pricing

Either way, thanks for trying it.

— ReviewHub`,
    },
  },
  th: {
    0: {
      subject: 'ยินดีต้อนรับ — มาตอบรีวิวแรกกัน',
      body: (clientUrl) => `สวัสดีครับ/ค่ะ

ยินดีต้อนรับสู่ ReviewHub!

ขั้นตอนเริ่มต้น:

1. เชื่อมแพลตฟอร์มรีวิวอันแรก (1 นาที)
   → ${clientUrl}/dashboard

2. เลือกรีวิว แล้วกด "Draft reply"
   AI จะให้คำตอบ 3 แบบให้เลือก แก้ไข copy ไปวางบน Google
   เสร็จใน 10 วินาที

3. อยากรับ audit ฟรี 10 รีวิวก่อนตัดสินใจ?
   → ${clientUrl}/audit (ฟรีจริง ไม่บังคับขาย)

ติดอะไร ตอบกลับอีเมลนี้ได้ ผม/ดิฉันอ่านทุกฉบับ

— ReviewHub
Bangkok`,
    },
    1: {
      subject: 'ติดอยู่ตรงไหน? 60 วินาทีพอ',
      body: (clientUrl) => `สวัสดีครับ/ค่ะ

เห็นว่ายังไม่ได้เชื่อมแพลตฟอร์มรีวิว — คนส่วนใหญ่ติดที่ขั้นนี้แหละ ลองทางลัดนี้:

→ Google: เข้าสู่ระบบด้วย Google account ที่เป็นเจ้าของ business profile เราจะหาให้อัตโนมัติ
→ Wongnai: paste URL ร้านบน Wongnai เราตรวจรีวิวใหม่ให้
→ Yelp / Trustpilot / TripAdvisor: paste URL เช่นกัน

ถ้าไม่มีสิทธิ์เข้า Google Business Profile บอกมาได้ ผม/ดิฉันแนะนำขั้นตอนโอนสิทธิ์ให้

ไม่ใช่สิ่งที่คุณต้องการ? ตอบกลับมาคำเดียว จะหยุดส่งทันที

→ ${clientUrl}/dashboard

— ReviewHub`,
    },
    3: {
      subject: 'คำตอบที่ดึงลูกค้ากลับมา (อ่าน 1 นาที)',
      body: (clientUrl) => `สวัสดีครับ/ค่ะ

เรื่องสั้น ๆ:

ร้านกาแฟในกรุงเทพที่ใช้ ReviewHub ได้รีวิว 1 ดาว:
"กาแฟเย็น พนักงานไม่สนใจตั้ง 20 นาที"

เจ้าของร้านส่วนใหญ่จะเงียบ หรือตอบแบบป้องกัน เจ้าของร้านนี้ใช้ AI เราตอบว่า:

   "ขอบคุณที่บอกครับ ผมรับผิดชอบเอง — เช้าวันนั้นพนักงานน้อยเพราะผมจัดตารางผิด กาแฟเย็นไม่ใช่มาตรฐานเรา จะแก้ระบบวันนี้ ครั้งหน้าที่แวะ DM @cafename มา รอบนั้นผมเลี้ยงเอง"

ลูกค้าคนนั้น DM กลับ มาร้านอีก แก้รีวิวเป็น 5 ดาว

นี่แหละคือทั้งหมด — คำตอบ 3 โทนทุกรีวิว 10 วินาทีเสร็จ

→ ${clientUrl}/dashboard

— ReviewHub`,
    },
    7: {
      subject: 'แพ็กเกจฟรี vs Starter — ต่างกันยังไง',
      body: (clientUrl) => `สวัสดีครับ/ค่ะ

ใช้แพ็กเกจฟรีมาครบสัปดาห์แล้ว — เปรียบเทียบกับ Starter ถ้ากำลังคิดอยู่:

FREE
- AI ตอบ 5 รีวิว/เดือน
- 1 แพลตฟอร์ม
- เช็คเอง

STARTER ($14/เดือน ~฿490)
- AI ตอบ 50 รีวิว/เดือน
- 3 แพลตฟอร์ม
- import อัตโนมัติทุก 6 ชม.
- email + สรุปรายสัปดาห์

PRO ($29/เดือน)
- ตอบไม่จำกัด
- Wongnai รวมอยู่แล้ว
- กฎ auto-reply
- support แบบ priority
- ร้านหลายสาขา (สูงสุด 3)

ส่วนใหญ่จะชนเพดาน 5 รีวิวอาทิตย์ที่ 2 ถ้ายังไม่ถึง ใช้ฟรีไปเรื่อย ๆ ได้

→ ${clientUrl}/pricing

ตอบกลับมาได้ ถ้าอยากปรึกษาว่าควรเลือกอะไร

— ReviewHub`,
    },
    14: {
      subject: 'สิ่งสุดท้ายก่อนจะหยุดส่งอีเมล',
      body: (clientUrl) => `สวัสดีครับ/ค่ะ

จะไม่ส่งอีเมลแบบนี้แล้ว — อันนี้อันสุดท้าย

ถ้า ReviewHub ไม่เหมาะกับคุณ อยากรู้จริง ๆ ตอบกลับมาประโยคเดียวก็พอ:

- ผิดเครื่องมือ? (รีวิวไม่เยอะพอจะใช้)
- ผิดเวลา? (ยุ่งกับอย่างอื่น)
- UX ไม่ดี? (มีอะไรที่ใช้แล้วหงุดหงิด)
- แพงเกิน? ($X ถึงจะใช้)

ผมอ่านทุกฉบับ และคำตอบของคุณจะกลายเป็นสิ่งที่ผมสร้างต่อไป

ถ้ายังเป็นประโยชน์อยู่ — Starter เริ่ม $14/เดือน 50 รีวิว + สรุปอีเมล แพ็กเกจฟรียังใช้ได้สำหรับคนปริมาณน้อย

→ ${clientUrl}/pricing

ขอบคุณที่ลองใช้ครับ/ค่ะ

— ReviewHub`,
    },
  },
};

// Send a single onboarding email. `dayNumber` ∈ {0,1,3,7,14}; `unsubUrl` is
// the signed one-click List-Unsubscribe URL (RFC 8058) — required for any
// bulk-ish lifecycle email so Gmail/Yahoo deliverability stays clean.
async function sendOnboardingEmail(userEmail, dayNumber, lang = 'en', unsubUrl = '') {
  const ls = ONBOARDING_STRINGS[lang] || ONBOARDING_STRINGS.en;
  const tpl = ls[dayNumber];
  if (!tpl) throw new Error(`unknown onboarding day: ${dayNumber}`);
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const text = tpl.body(clientUrl);
  // Render plaintext as plain HTML — no styling, just <br> for newlines so
  // the email reads like a personal note rather than a marketing template.
  const htmlBody = escapeHtml(text).replace(/\n/g, '<br>');
  const unsubFooter = unsubUrl
    ? `<br><br><span style="font-size:11px;color:#9ca3af">${lang === 'th' ? 'ไม่อยากรับอีเมลแบบนี้?' : 'No more emails like this?'} <a href="${escapeHtml(unsubUrl)}" style="color:#9ca3af">${lang === 'th' ? 'กดยกเลิก' : 'Unsubscribe'}</a></span>`
    : '';
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;color:#1d242c;line-height:1.6;max-width:560px;margin:0 auto;padding:24px 16px;">${htmlBody}${unsubFooter}</div>`;
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EMAIL] Onboarding day-${dayNumber} (${lang}) → ${userEmail}: ${tpl.subject}`);
    return;
  }
  const headers = unsubUrl ? {
    'List-Unsubscribe': `<${unsubUrl}>, <mailto:unsubscribe@reviewhub.review?subject=unsubscribe%20onboarding>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  } : undefined;
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'ReviewHub <hello@reviewhub.review>',
    to: userEmail,
    subject: tpl.subject,
    html,
    text,
    headers,
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
  sendOnboardingEmail,
  verifySmtp,
  portBlockHint,
};
