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

// Strip CR / LF — anything that lands in an email HEADER (Subject, To,
// From, Reply-To) needs this. Without it, a user-controlled string with
// "\r\nBcc: …" in it could inject extra headers. Defense-in-depth: even
// when the upstream value is stored in our DB by an authenticated user,
// we don't want the address book or admin tooling to accidentally leak.
function stripHdr(str) {
  return String(str ?? '').replace(/[\r\n]/g, ' ');
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
  es: {
    subjectPrefix: 'Nueva',
    subjectFor: 'reseña para',
    headlinePrefix: 'Nueva reseña en',
    leftA: 'dejó una',
    starReview: 'reseña de estrellas para',
    sentiment: 'Sentimiento',
    cta: 'Ver y responder',
    footer: 'ReviewHub · Gestiona las notificaciones en Ajustes',
    textHeadline: (platform) => `Nueva reseña en ${platform}`,
    textIntro: (name, rating, biz) => `${name} dejó una reseña de ${rating} estrellas para ${biz}`,
    textViewAt: 'Ver y responder:',
  },
  ja: {
    subjectPrefix: '新着',
    subjectFor: '・',
    headlinePrefix: '新着口コミ：',
    leftA: 'さんが',
    starReview: 'つ星の口コミを投稿しました：',
    sentiment: '感情',
    cta: '確認して返信',
    footer: 'ReviewHub · 通知設定は「設定」から変更できます',
    textHeadline: (platform) => `${platform} に新着口コミ`,
    textIntro: (name, rating, biz) => `${name}さんが ${biz} に ${rating}つ星の口コミを投稿しました`,
    textViewAt: '確認して返信：',
  },
};

async function sendNewReviewNotification(userEmail, review, businessName, lang = 'en') {
  const s = NEW_REVIEW_STRINGS[lang] || NEW_REVIEW_STRINGS.en;
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

  // stripHdr (top-of-file helper) strips newlines from values used in
  // email headers — prevents header injection when business_name or
  // platform-label contain user-controlled CR/LF.
  const stripHeaderChars = stripHdr;

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
  es: {
    subject: 'Confirma tu email — un clic y estás dentro',
    headline: 'Un clic y estás dentro.',
    body: 'Confirma tu email y en menos de un minuto estarás generando respuestas con IA. Este enlace expira en 24 horas.',
    cta: 'Confirmar mi email',
    pasteHint: 'O pega esto en tu navegador:',
    ignoreFooter: '¿No te registraste? Puedes ignorar este email tranquilamente — no se creará ninguna cuenta.',
    textHeader: 'Bienvenido a ReviewHub',
    textBody: 'Confirma tu email para terminar de configurar tu cuenta.',
    textValid: 'El enlace es válido durante 24 horas:',
    textIgnore: 'Si no creaste una cuenta de ReviewHub, ignora este email.',
  },
  ja: {
    subject: 'メールアドレスを確認 — クリック1回で完了',
    headline: 'クリック1回で完了です。',
    body: 'メールを確認したら、1分以内にAIで返信を作成できるようになります。このリンクは24時間で期限切れになります。',
    cta: 'メールを確認',
    pasteHint: 'またはこのURLをブラウザに貼り付けてください：',
    ignoreFooter: '登録していませんか？このメールは無視して大丈夫です — アカウントは作成されません。',
    textHeader: 'ReviewHubへようこそ',
    textBody: 'アカウントの設定を完了するため、メールアドレスを確認してください。',
    textValid: 'このリンクは24時間有効です：',
    textIgnore: 'ReviewHubのアカウントを作成していない場合は、このメールを無視してください。',
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
  es: {
    subject: 'Restablecer tu contraseña de ReviewHub',
    headline: 'Restablecer contraseña',
    body: 'Recibimos una petición para restablecer la contraseña de tu cuenta de ReviewHub. Este enlace es válido durante 1 hora.',
    cta: 'Restablecer contraseña',
    pasteHint: 'Si el botón no funciona, pega esta URL en tu navegador:',
    ignoreFooter: 'Si no fuiste tú, puedes ignorar este email — tu contraseña no cambiará.',
    textValid: 'El enlace es válido durante 1 hora:',
    textIgnore: 'Si no fuiste tú, puedes ignorar este email.',
  },
  ja: {
    subject: 'ReviewHubのパスワードを再設定',
    headline: 'パスワード再設定',
    body: 'ReviewHubアカウントのパスワード再設定リクエストを受け付けました。このリンクは1時間有効です。',
    cta: 'パスワードを再設定',
    pasteHint: 'ボタンが動作しない場合は、このURLをブラウザに貼り付けてください：',
    ignoreFooter: 'リクエストした覚えがない場合は、このメールを無視してください — パスワードは変わりません。',
    textValid: 'このリンクは1時間有効です：',
    textIgnore: 'リクエストした覚えがない場合は、このメールを無視してください。',
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

// Localised strings for the weekly digest. Most strings here are short
// labels or chart legends; full sentences are kept short because the
// digest is a scan-not-read experience by design.
const DIGEST_STRINGS = {
  en: {
    subjectActive: (total, unresponded) => `${total} new review${total === 1 ? '' : 's'} this week · ${unresponded} need${unresponded === 1 ? 's' : ''} a reply`,
    subjectFallback: (biz) => `Your review week — ${biz}`,
    headline: 'Your review week',
    sentimentLegend: (pos, neu, neg) => `${pos} positive · ${neu} neutral · ${neg} critical`,
    statNewReviews: 'new reviews',
    statAvgRating: 'avg rating',
    statNeedReply: 'need a reply',
    needsReplyEyebrow: '⚠ Needs a reply',
    draftReplyBtn: '✨ Draft reply',
    highlightEyebrow: '✨ Highlight of the week',
    openDashboard: 'Open dashboard →',
    footer: 'You get this every Monday.',
    changeFrequency: 'Change frequency',
    unsubscribe: 'Unsubscribe',
    weekLabel: (start, end, monthName) => `Week of ${monthName} ${start} – ${end}`,
    monthNames: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    textHeadline: (biz) => `Weekly digest for ${biz}`,
    textNewReviews: 'New reviews',
    textAvgRating: 'Average rating',
    textPositive: 'Positive',
    textNegative: 'Negative',
    textAwaiting: 'Awaiting response',
    textRecentReviews: 'Recent reviews:',
    textNoResponseYet: '[no response yet]',
    textNoText: '(no text)',
    textOpenDashboard: 'Open dashboard:',
  },
  th: {
    subjectActive: (total, unresponded) => `${total} รีวิวใหม่สัปดาห์นี้ · ${unresponded} อันรอตอบ`,
    subjectFallback: (biz) => `สรุปรีวิวสัปดาห์ของคุณ — ${biz}`,
    headline: 'สรุปรีวิวสัปดาห์ของคุณ',
    sentimentLegend: (pos, neu, neg) => `ชม ${pos} · กลางๆ ${neu} · แย่ ${neg}`,
    statNewReviews: 'รีวิวใหม่',
    statAvgRating: 'คะแนนเฉลี่ย',
    statNeedReply: 'รอตอบ',
    needsReplyEyebrow: '⚠ รอคุณตอบ',
    draftReplyBtn: '✨ ร่างคำตอบ',
    highlightEyebrow: '✨ รีวิวเด่นประจำสัปดาห์',
    openDashboard: 'เปิดแดชบอร์ด →',
    footer: 'อีเมลนี้ส่งให้ทุกวันจันทร์',
    changeFrequency: 'เปลี่ยนความถี่',
    unsubscribe: 'ยกเลิกการรับ',
    weekLabel: (start, end, monthName) => `สัปดาห์ ${start} – ${end} ${monthName}`,
    monthNames: ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'],
    textHeadline: (biz) => `สรุปรีวิวรายสัปดาห์ของ ${biz}`,
    textNewReviews: 'รีวิวใหม่',
    textAvgRating: 'คะแนนเฉลี่ย',
    textPositive: 'ชม',
    textNegative: 'แย่',
    textAwaiting: 'รอตอบ',
    textRecentReviews: 'รีวิวล่าสุด:',
    textNoResponseYet: '[ยังไม่ได้ตอบ]',
    textNoText: '(ไม่มีข้อความ)',
    textOpenDashboard: 'เปิดแดชบอร์ด:',
  },
  es: {
    subjectActive: (total, unresponded) => `${total} reseña${total === 1 ? '' : 's'} nueva${total === 1 ? '' : 's'} esta semana · ${unresponded} esperando respuesta`,
    subjectFallback: (biz) => `Tu semana de reseñas — ${biz}`,
    headline: 'Tu semana de reseñas',
    sentimentLegend: (pos, neu, neg) => `${pos} positivas · ${neu} neutras · ${neg} críticas`,
    statNewReviews: 'reseñas nuevas',
    statAvgRating: 'media',
    statNeedReply: 'esperan respuesta',
    needsReplyEyebrow: '⚠ Esperando respuesta',
    draftReplyBtn: '✨ Redactar respuesta',
    highlightEyebrow: '✨ Reseña destacada de la semana',
    openDashboard: 'Abrir panel →',
    footer: 'Recibes esto cada lunes.',
    changeFrequency: 'Cambiar frecuencia',
    unsubscribe: 'Darme de baja',
    weekLabel: (start, end, monthName) => `Semana del ${start} al ${end} de ${monthName}`,
    monthNames: ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'],
    textHeadline: (biz) => `Resumen semanal de ${biz}`,
    textNewReviews: 'Reseñas nuevas',
    textAvgRating: 'Media',
    textPositive: 'Positivas',
    textNegative: 'Críticas',
    textAwaiting: 'Esperando respuesta',
    textRecentReviews: 'Reseñas recientes:',
    textNoResponseYet: '[sin respuesta aún]',
    textNoText: '(sin texto)',
    textOpenDashboard: 'Abrir panel:',
  },
  ja: {
    subjectActive: (total, unresponded) => `今週の新着口コミ ${total}件 · 返信待ち ${unresponded}件`,
    subjectFallback: (biz) => `今週の口コミまとめ — ${biz}`,
    headline: '今週の口コミ',
    sentimentLegend: (pos, neu, neg) => `好評 ${pos} · 中立 ${neu} · 不満 ${neg}`,
    statNewReviews: '新着口コミ',
    statAvgRating: '平均評価',
    statNeedReply: '返信待ち',
    needsReplyEyebrow: '⚠ 返信が必要',
    draftReplyBtn: '✨ 返信を作成',
    highlightEyebrow: '✨ 今週のハイライト',
    openDashboard: 'ダッシュボードを開く →',
    footer: '毎週月曜日にお届けしています。',
    changeFrequency: '頻度を変更',
    unsubscribe: '配信停止',
    weekLabel: (start, end, monthName) => `${monthName}${start}日 – ${end}日の週`,
    monthNames: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
    textHeadline: (biz) => `${biz}の週次サマリー`,
    textNewReviews: '新着口コミ',
    textAvgRating: '平均評価',
    textPositive: '好評',
    textNegative: '不満',
    textAwaiting: '返信待ち',
    textRecentReviews: '最近の口コミ：',
    textNoResponseYet: '[未返信]',
    textNoText: '(テキストなし)',
    textOpenDashboard: 'ダッシュボードを開く：',
  },
};

// Weekly digest: summary stats for the past 7 days. `stats` is whatever
// runWeeklyDigest prepares — minimal, just enough to render a readable email.
async function sendWeeklyDigest(userEmail, stats) {
  const {
    userId,
    business_name, total, avg_rating = null,
    positive = 0, negative = 0, unresponded = 0,
    recentReviews = [],
    lang = 'en',
  } = stats;
  const s = DIGEST_STRINGS[lang] || DIGEST_STRINGS.en;
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
  // business_name goes in the fallback subject — strip CR/LF for header safety.
  const subject = total > 0 && unresponded > 0
    ? s.subjectActive(total, unresponded)
    : s.subjectFallback(stripHdr(business_name));

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
    <div style="font-size:11px;color:#7a8189;margin-top:6px;">${s.sentimentLegend(positive, total - positive - negative, negative)}</div>`;
  })() : '';

  // Critical callout — most negative unresponded review, if one exists. Uses
  // the design's red-tinted card with a prominent "Draft reply" CTA.
  const criticalReview = recentReviews.find(r => r.rating <= 2 && !r.response_text);
  const criticalBlock = criticalReview ? `
    <tr><td style="padding:0 28px 16px;">
      <div style="font-size:11px;font-weight:700;color:#7a8189;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">${s.needsReplyEyebrow}</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;">
        <tr><td style="padding:14px 16px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="font-size:13px;color:#a06d1c;font-weight:700;">${escapeHtml(criticalReview.reviewer_name || 'Anonymous')} · ${'★'.repeat(criticalReview.rating)}${'☆'.repeat(5 - criticalReview.rating)}</td>
              <td align="right" style="font-size:11px;color:#a06d1c;">${escapeHtml(criticalReview.platform.charAt(0).toUpperCase() + criticalReview.platform.slice(1))}</td>
            </tr>
          </table>
          <div style="font-size:13px;color:#7f1d1d;line-height:1.5;margin-top:6px;">"${escapeHtml((criticalReview.review_text || '').slice(0, 160))}${(criticalReview.review_text || '').length > 160 ? '…' : ''}"</div>
          <a href="${safeUrl}/dashboard?responded=no" style="display:inline-block;margin-top:12px;background:#b85450;color:#fff;font-size:12px;font-weight:700;text-decoration:none;padding:8px 14px;border-radius:7px;">${s.draftReplyBtn}</a>
        </td></tr>
      </table>
    </td></tr>` : '';

  // Highlight callout — best positive review of the week, if any.
  const highlightReview = recentReviews.find(r => r.rating >= 5);
  const highlightBlock = highlightReview ? `
    <tr><td style="padding:0 28px 24px;">
      <div style="font-size:11px;font-weight:700;color:#7a8189;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">${s.highlightEyebrow}</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">
        <tr><td style="padding:14px 16px;font-size:13px;color:#166534;line-height:1.5;">
          <b>${escapeHtml(highlightReview.reviewer_name || 'Anonymous')} · ★★★★★</b> — <i>"${escapeHtml((highlightReview.review_text || '').slice(0, 140))}${(highlightReview.review_text || '').length > 140 ? '…' : ''}"</i>
        </td></tr>
      </table>
    </td></tr>` : '';

  // Week label — locale-specific format. Each locale's monthNames list +
  // weekLabel formatter handles the regional convention.
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  const weekLabel = s.weekLabel(weekStart.getDate(), now.getDate(), s.monthNames[weekStart.getMonth()]);

  const html = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4eee0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <tr><td align="center" style="padding:24px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;">
      <tr><td style="background-color:#1e4d5e;padding:28px 28px 24px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="font-size:12px;color:rgba(255,255,255,0.7);font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">${weekLabel}</td>
            <td align="right" style="font-size:12px;color:rgba(255,255,255,0.7);font-weight:600;">${safeBiz}</td>
          </tr>
          <tr><td colspan="2" style="padding-top:8px;font-size:26px;color:#fff;font-weight:700;letter-spacing:-0.02em;">${s.headline}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:24px 28px 8px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="33%"><div style="font-size:28px;font-weight:800;color:#1d242c;letter-spacing:-0.02em;">${total}</div><div style="font-size:12px;color:#7a8189;margin-top:2px;">${s.statNewReviews}</div></td>
            <td width="33%"><div style="font-size:28px;font-weight:800;color:#c48a2c;letter-spacing:-0.02em;">${avg_rating != null ? avg_rating : '—'} ★</div><div style="font-size:12px;color:#7a8189;margin-top:2px;">${s.statAvgRating}</div></td>
            <td width="33%"><div style="font-size:28px;font-weight:800;color:#b85450;letter-spacing:-0.02em;">${unresponded}</div><div style="font-size:12px;color:#7a8189;margin-top:2px;">${s.statNeedReply}</div></td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:8px 28px 24px;">${sentimentBar}</td></tr>
      ${criticalBlock}
      ${highlightBlock}
      <tr><td align="center" style="padding:0 28px 32px;">
        <a href="${safeUrl}/dashboard" style="display:inline-block;background:#1d242c;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 24px;border-radius:10px;">${s.openDashboard}</a>
      </td></tr>
      <tr><td style="border-top:1px solid #e6dfce;padding:18px 28px;font-size:11px;color:#7a8189;line-height:1.55;" align="center">
        ${s.footer} <a href="${safeUrl}/settings" style="color:#7a8189;">${s.changeFrequency}</a> · <a href="${escapeHtml(oneClickUnsubUrl)}" style="color:#7a8189;">${s.unsubscribe}</a>
      </td></tr>
    </table>
  </td></tr>
</table>`;

  const reviewsText = recentReviews.length > 0 ? [
    '',
    s.textRecentReviews,
    ...recentReviews.map(r => {
      const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
      const excerpt = r.review_text ? r.review_text.slice(0, 160) + (r.review_text.length > 160 ? '…' : '') : s.textNoText;
      const responded = r.response_text ? '' : ` ${s.textNoResponseYet}`;
      return `  ${r.reviewer_name || 'Anonymous'} ${stars} (${r.platform})${responded}\n  "${excerpt}"`;
    }),
  ] : [];

  const text = [
    s.textHeadline(business_name),
    '',
    `${s.textNewReviews}: ${total}`,
    avg_rating != null ? `${s.textAvgRating}: ${avg_rating}` : null,
    `${s.textPositive}: ${positive}`,
    `${s.textNegative}: ${negative}`,
    `${s.textAwaiting}: ${unresponded}`,
    ...reviewsText,
    '',
    `${s.textOpenDashboard} ${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard`,
  ].filter((line) => line !== null).join('\n');

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

// Localised strings for the review-request email. Sent to the
// restaurant/business CUSTOMER asking them to leave a review — so this
// is the most public-facing email we send (the END-USER of our user
// sees it). Lang choice: `lang` from the businessOwner — the request
// is in the language the business operates in, not the customer's
// preferred locale (which we don't know).
const REVIEW_REQUEST_STRINGS = {
  en: {
    subject: (biz) => `Thanks for stopping by — ${biz}`,
    subjectFollowUp: 'Last one, promise 🙏',
    intro: (biz) => `Thanks for swinging by ${biz} — hope it hit the spot.`,
    introFollowUp: `One gentle nudge and then I'll stop. 🙏`,
    asks: (platform) => `If you have 20 seconds, a quick review on ${platform} would mean the world to us. We're a tiny team and every word genuinely helps other neighbors find us.`,
    asksFollowUp: (platform) => `If the visit was good, would you drop a line on ${platform}? If it wasn't — I genuinely want to hear why. Reply to this email directly and it goes straight to me.`,
    hi: 'Hi',
    leaveReviewBtn: (platform) => `Leave a ${platform} review`,
    tellPrivately: 'Tell me privately',
    tapToRate: (platform) => `Tap a star to leave a review on ${platform}`,
    eitherWay: 'Either way, thanks for being here.',
    eitherWayFollowUp: 'Either way — thanks for being here.',
    receivedFooter: (biz) => `You received this because ${biz} invited you to share your experience.`,
    sentVia: 'Sent via ReviewHub',
    textLeaveReview: 'Leave a review',
    textReceived: (biz) => `You received this because ${biz} invited you.`,
  },
  th: {
    subject: (biz) => `ขอบคุณที่แวะมา — ${biz}`,
    subjectFollowUp: 'ครั้งสุดท้ายแล้วนะ 🙏',
    intro: (biz) => `ขอบคุณที่แวะมาที่ ${biz} หวังว่าถูกใจนะคะ`,
    introFollowUp: 'รบกวนทักครั้งเดียว แล้วจะไม่กวนแล้วค่ะ 🙏',
    asks: (platform) => `ถ้ามีเวลาแค่ 20 วินาที ช่วยเขียนรีวิวสั้น ๆ ให้บน ${platform} ได้ไหมคะ เราเป็นทีมเล็ก ๆ ทุกคำของคุณช่วยให้ลูกค้าใหม่เจอเราได้`,
    asksFollowUp: (platform) => `ถ้าครั้งนั้นพอใจ ช่วยเขียนรีวิวบน ${platform} ได้ไหมคะ ถ้าไม่พอใจ ตอบกลับอีเมลนี้ได้เลย เข้าตรงถึงเจ้าของร้าน`,
    hi: 'สวัสดีค่ะ',
    leaveReviewBtn: (platform) => `เขียนรีวิวบน ${platform}`,
    tellPrivately: 'บอกเป็นการส่วนตัว',
    tapToRate: (platform) => `แตะดาวเพื่อเขียนรีวิวบน ${platform}`,
    eitherWay: 'ยังไงก็ตาม ขอบคุณที่มาค่ะ',
    eitherWayFollowUp: 'ยังไงก็ตาม — ขอบคุณที่อยู่กับเรานะคะ',
    receivedFooter: (biz) => `คุณได้รับอีเมลนี้เพราะ ${biz} เชิญให้แบ่งปันประสบการณ์`,
    sentVia: 'ส่งผ่าน ReviewHub',
    textLeaveReview: 'เขียนรีวิว',
    textReceived: (biz) => `คุณได้รับอีเมลนี้เพราะ ${biz} เชิญให้แบ่งปันประสบการณ์`,
  },
  es: {
    subject: (biz) => `Gracias por pasarte por — ${biz}`,
    subjectFollowUp: 'Última vez, lo prometo 🙏',
    intro: (biz) => `Gracias por pasarte por ${biz} — espero que disfrutaras.`,
    introFollowUp: 'Un recordatorio amable y ya te dejo en paz. 🙏',
    asks: (platform) => `Si tienes 20 segundos, una reseña rápida en ${platform} significaría muchísimo. Somos un equipo pequeño y cada palabra ayuda a que otros vecinos nos encuentren.`,
    asksFollowUp: (platform) => `Si la visita fue bien, ¿te animas a dejarnos una reseña en ${platform}? Si no fue bien — quiero saberlo de verdad. Responde a este email directamente y me llega a mí.`,
    hi: 'Hola',
    leaveReviewBtn: (platform) => `Dejar reseña en ${platform}`,
    tellPrivately: 'Cuéntamelo en privado',
    tapToRate: (platform) => `Toca una estrella para dejar reseña en ${platform}`,
    eitherWay: 'Sea como sea, gracias por venir.',
    eitherWayFollowUp: 'Sea como sea — gracias por estar aquí.',
    receivedFooter: (biz) => `Recibiste este email porque ${biz} te invitó a compartir tu experiencia.`,
    sentVia: 'Enviado vía ReviewHub',
    textLeaveReview: 'Dejar reseña',
    textReceived: (biz) => `Recibiste este email porque ${biz} te invitó.`,
  },
  ja: {
    subject: (biz) => `ご来店ありがとうございました — ${biz}`,
    subjectFollowUp: '最後のお願いです 🙏',
    intro: (biz) => `${biz}にお越しいただきありがとうございました。気に入っていただけたら嬉しいです。`,
    introFollowUp: 'もう一度だけお願いさせてください、これで最後です。 🙏',
    asks: (platform) => `20秒だけお時間をいただけたら、${platform}に短い口コミを書いていただけると本当に嬉しいです。私たちは小さなチームで、お客様の一言一言が新しいお客様との出会いにつながります。`,
    asksFollowUp: (platform) => `ご満足いただけたなら、${platform}に一言いただけませんか？ご満足いただけなかったなら、その理由を本気で知りたいです。このメールに直接返信していただければ、私のところに届きます。`,
    hi: 'こんにちは、',
    leaveReviewBtn: (platform) => `${platform}に口コミを書く`,
    tellPrivately: '個別にお伝えする',
    tapToRate: (platform) => `星をタップして${platform}に口コミを書く`,
    eitherWay: 'どちらにせよ、お越しいただきありがとうございました。',
    eitherWayFollowUp: 'どちらにせよ — ご利用いただきありがとうございます。',
    receivedFooter: (biz) => `このメールは、${biz}があなたの体験を共有するよう招待したため送信されました。`,
    sentVia: 'ReviewHubから送信',
    textLeaveReview: '口コミを書く',
    textReceived: (biz) => `このメールは、${biz}があなたを招待したため送信されました。`,
  },
};

// Review request: ask a customer to leave a review on a specific platform.
// trackUrl is the click-tracking redirect URL (our server logs the click then
// redirects to the real platform review URL). `lang` is the business owner's
// preferred locale (not the customer's — we don't know that).
async function sendReviewRequest({ customerEmail, customerName, businessName, platform, message, trackUrl, isFollowUp = false, lang = 'en' }) {
  const s = REVIEW_REQUEST_STRINGS[lang] || REVIEW_REQUEST_STRINGS.en;
  const safeName = escapeHtml(customerName);
  const safeBiz = escapeHtml(businessName);
  const safePlatform = escapeHtml(platform.charAt(0).toUpperCase() + platform.slice(1));
  const safeMsg = message ? escapeHtml(message) : null;
  const safeUrl = escapeHtml(trackUrl);

  // Subjects follow the design spec — personal + low-pressure. The
  // follow-up uses "Last one, promise 🙏" phrasing so recipients don't
  // feel harassed. businessName goes into the subject HEADER, so strip
  // CR/LF to prevent header injection (defense-in-depth).
  const subject = isFollowUp ? s.subjectFollowUp : s.subject(stripHdr(businessName));
  const introText = isFollowUp ? s.introFollowUp : s.intro(safeBiz);
  const asksText = isFollowUp ? s.asksFollowUp(safePlatform) : s.asks(safePlatform);

  // Personal-letter aesthetic: Georgia serif for the greeting + sign-off,
  // sans for body. 5-star inline row on the primary request email so users
  // can tap-to-rate. Follow-up shows a primary "leave a review" CTA plus
  // a "tell me privately" mailto fallback for low-friction negative feedback.
  const html = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <tr><td align="center" style="padding:${isFollowUp ? '40' : '36'}px 24px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
      <tr><td style="font-family:Georgia,serif;font-size:${isFollowUp ? '26' : '28'}px;color:#1d242c;line-height:1.3;letter-spacing:-0.01em;padding-bottom:18px;">
        ${s.hi} ${safeName},
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
              <a href="${safeUrl}" style="display:inline-block;background-color:#1e4d5e;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;">${s.leaveReviewBtn(safePlatform)}</a>
            </td>
            <td style="padding:0 6px;">
              <a href="mailto:support@reviewhub.review?subject=Feedback%20about%20${encodeURIComponent(businessName)}" style="display:inline-block;background:#f4eee0;color:#1d242c;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:10px;">${s.tellPrivately}</a>
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
        <div style="font-size:12px;color:#7a8189;margin-top:8px;">${s.tapToRate(safePlatform)}</div>
      </td></tr>`}
      <tr><td style="font-size:${isFollowUp ? '14' : '16'}px;color:#${isFollowUp ? '64748b' : '334155'};line-height:1.6;padding-bottom:8px;">
        ${isFollowUp ? s.eitherWayFollowUp : s.eitherWay}
      </td></tr>
      <tr><td style="font-family:Georgia,serif;font-size:17px;color:#1d242c;padding-bottom:32px;font-style:italic;">
        — ${safeBiz}
      </td></tr>
      <tr><td style="border-top:1px solid #e6dfce;padding-top:16px;padding-bottom:24px;font-size:11px;color:#7a8189;line-height:1.55;" align="center">
        ${s.receivedFooter(safeBiz)}<br>
        <span style="color:#cbd5e1;">${s.sentVia}</span>
      </td></tr>
    </table>
  </td></tr>
</table>`;
  // Plain-text body — same locale waterfall as the HTML.
  const introPlain = isFollowUp
    ? `${s.hi} ${customerName}, ${s.introFollowUp.replace(/^[^a-zA-Zก-๛أ-يあ-ヿ一-鿿가-힣]/, '')}\n${s.asksFollowUp(platform)}`
    : `${s.intro(businessName)}\n${s.asks(platform)}`;
  const text = [
    `${s.hi} ${customerName},`,
    '',
    introPlain,
    safeMsg ? `\n"${message}"\n` : '',
    `${s.textLeaveReview}: ${trackUrl}`,
    '',
    s.textReceived(businessName),
  ].filter((line) => line !== null).join('\n');

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
  es: {
    login: { subject: 'Tu código de acceso a ReviewHub', headline: 'Código de acceso', intro: 'Introduce este código para terminar de iniciar sesión:' },
    enable: { subject: 'Tu código de verificación de ReviewHub', headline: 'Activar 2FA', intro: 'Introduce este código para activar la verificación en dos pasos:' },
    validFooter: 'Este código es válido durante 10 minutos. Si no fuiste tú, puedes ignorar este email — tu cuenta está a salvo.',
    textValidFooter: 'Este código es válido durante 10 minutos. Si no fuiste tú, puedes ignorar este email.',
  },
  ja: {
    login: { subject: 'ReviewHub サインインコード', headline: 'サインインコード', intro: 'サインインを完了するには、このコードを入力してください：' },
    enable: { subject: 'ReviewHub 確認コード', headline: '2FAを有効化', intro: '二要素認証を有効にするには、このコードを入力してください：' },
    validFooter: 'このコードは10分間有効です。リクエストした覚えがない場合は、このメールを無視して大丈夫です — アカウントは安全です。',
    textValidFooter: 'このコードは10分間有効です。リクエストした覚えがない場合は、このメールを無視してください。',
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
  es: {
    subject: 'Confirma tu nuevo email de ReviewHub',
    headline: 'Confirma tu nuevo email',
    body1: 'Recibimos una petición para cambiar el email de tu cuenta de ReviewHub a esta dirección. Pulsa el botón para confirmar el cambio.',
    body2: 'El enlace es válido durante 1 hora. Si no fuiste tú, puedes ignorar este email — tu email actual no cambiará.',
    cta: 'Confirmar cambio de email',
    pasteHint: 'Si el botón no funciona, pega esta URL en tu navegador:',
    footer: 'ReviewHub · recibiste este email porque alguien introdujo esta dirección como nuevo email en su cuenta.',
    textIntro: 'Pulsa el enlace para confirmar el cambio de email a esta dirección:',
    textValid: 'Válido durante 1 hora. Si no fuiste tú, ignora este email.',
  },
  ja: {
    subject: 'ReviewHubの新しいメールアドレスを確認',
    headline: '新しいメールアドレスを確認',
    body1: 'ReviewHubアカウントのメールアドレスを、このアドレスに変更するリクエストを受け付けました。下のボタンをクリックして変更を確認してください。',
    body2: 'リンクは1時間有効です。リクエストした覚えがない場合は、このメールを無視して大丈夫です — 既存のメールアドレスはそのままです。',
    cta: 'メールアドレスの変更を確認',
    pasteHint: 'ボタンが動作しない場合は、このURLをブラウザに貼り付けてください：',
    footer: 'ReviewHub · このメールは、このアドレスがアカウントの新しいメールアドレスとして入力されたため送信されました。',
    textIntro: 'リンクをクリックして、アカウントのメールアドレスをこのアドレスに変更することを確認してください：',
    textValid: '1時間有効です。リクエストした覚えがない場合は、このメールを無視してください。',
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
  es: {
    subject: 'Cambio de email solicitado en tu cuenta de ReviewHub',
    headline: 'Cambio de email solicitado',
    introBlock: 'Alguien acaba de pedir cambiar el email de tu cuenta de ReviewHub a:',
    ifYou: 'Si fuiste tú, puedes ignorar este mensaje — el cambio solo se aplica si pulsas el enlace de confirmación que enviamos a la nueva dirección.',
    ifNot: 'Si no fuiste tú',
    ifNotBody: ', tu cuenta puede estar comprometida. Inicia sesión y cambia tu contraseña inmediatamente:',
    cta: 'Asegurar mi cuenta',
    footer: 'Recibiste este email porque alguien solicitó un cambio de email en ReviewHub. No hace falta hacer nada si fuiste tú.',
    textBody: (newEmail) => `Alguien acaba de pedir cambiar el email de tu cuenta a: ${newEmail}`,
    textCta: (url) => `Si no fuiste tú, inicia sesión y cambia tu contraseña ya: ${url}/forgot-password`,
  },
  ja: {
    subject: 'ReviewHubアカウントのメールアドレス変更リクエスト',
    headline: 'メールアドレス変更リクエスト',
    introBlock: '誰かがReviewHubアカウントのメールアドレスを以下に変更するようリクエストしました：',
    ifYou: 'ご自身でリクエストした場合は、このメッセージを無視して大丈夫です — 変更は新しいアドレスに送信した確認リンクをクリックして初めて反映されます。',
    ifNot: 'ご自身ではない場合',
    ifNotBody: '、アカウントが侵害されている可能性があります。今すぐサインインしてパスワードを変更してください：',
    cta: 'アカウントを保護',
    footer: 'このメールは、ReviewHubでメールアドレス変更がリクエストされたため送信されました。ご自身でリクエストした場合は何もする必要はありません。',
    textBody: (newEmail) => `誰かがアカウントのメールアドレスを以下に変更するようリクエストしました：${newEmail}`,
    textCta: (url) => `ご自身ではない場合、今すぐサインインしてパスワードを変更してください：${url}/forgot-password`,
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
  es: {
    subject: 'Confirma la eliminación de tu cuenta de ReviewHub',
    headline: 'Confirmar eliminación de cuenta',
    body: 'Pediste eliminar permanentemente tu cuenta de ReviewHub y todos los datos asociados. Esta acción es irreversible — una vez confirmada, tus reseñas, ajustes, historial y plataformas conectadas se eliminan y no se pueden recuperar.',
    cta: 'Confirmar eliminación',
    pasteHint: 'Si el botón no funciona, pega esta URL en tu navegador:',
    footer: 'El enlace es válido durante 24 horas. Si no pediste la eliminación, puedes ignorar este email — no se eliminará nada.',
    textBody: 'Pediste eliminar permanentemente tu cuenta de ReviewHub.',
    textIrreversible: 'Esta acción es irreversible. Para continuar, haz clic:',
    textValid: 'El enlace es válido durante 24 horas.',
    textIgnore: 'Si no fuiste tú, puedes ignorar este email.',
  },
  ja: {
    subject: 'ReviewHubアカウントの削除を確認',
    headline: 'アカウント削除を確認',
    body: 'ReviewHubアカウントと関連するすべてのデータの永久削除をリクエストしました。この操作は取り消せません — 確認すると、レビュー、設定、履歴、接続済みプラットフォームがすべて削除され、復元できません。',
    cta: '削除を確認',
    pasteHint: 'ボタンが動作しない場合は、このURLをブラウザに貼り付けてください：',
    footer: 'リンクは24時間有効です。削除をリクエストした覚えがない場合は、このメールを無視して大丈夫です — 何も削除されません。',
    textBody: 'ReviewHubアカウントの永久削除をリクエストしました。',
    textIrreversible: 'この操作は取り消せません。続行するにはクリック：',
    textValid: 'リンクは24時間有効です。',
    textIgnore: 'リクエストした覚えがない場合は、このメールを無視してください。',
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
- 3 AI replies / month
- 1 review platform
- Reply manually as much as you want

STARTER ($14/mo, ~฿490)
- Unlimited AI replies
- 2 platforms
- Email alerts on new + negative reviews
- Reusable response templates

PRO ($29/mo)
- Everything in Starter
- 6 platforms
- Weekly digest email
- Trend analytics
- CSV export

BUSINESS ($59/mo)
- Multi-location (up to 5 businesses)
- API + webhooks
- Priority support

Most owners hit the free-tier AI cap around week 2. If you're not at 3/month, no rush — keep the free tier as long as it works for you.

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

If it IS still useful — Starter starts at $14/mo with unlimited AI replies + new-review email alerts. The free plan still works for low-volume use.

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
- AI ตอบ 3 รีวิว/เดือน
- 1 แพลตฟอร์ม
- ตอบเองได้ไม่จำกัด

STARTER ($14/เดือน ~฿490)
- AI ตอบไม่จำกัด
- 2 แพลตฟอร์ม
- แจ้งเตือนรีวิวใหม่ + รีวิวแย่ทันที
- เทมเพลตคำตอบ

PRO ($29/เดือน)
- ทุกอย่างใน Starter
- 6 แพลตฟอร์ม
- สรุปรายสัปดาห์
- กราฟวิเคราะห์เทรนด์
- ดาวน์โหลด CSV

BUSINESS ($59/เดือน)
- หลายสาขา (สูงสุด 5)
- API + webhook
- support แบบ priority

ส่วนใหญ่จะชนเพดาน 3 รีวิวฟรี/เดือน ราวอาทิตย์ที่ 2 ถ้ายังไม่ถึง ใช้ฟรีไปเรื่อย ๆ ได้

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

ถ้ายังเป็นประโยชน์อยู่ — Starter เริ่ม $14/เดือน AI ตอบไม่จำกัด + แจ้งเตือนรีวิวใหม่ทางอีเมล แพ็กเกจฟรียังใช้ได้สำหรับคนปริมาณน้อย

→ ${clientUrl}/pricing

ขอบคุณที่ลองใช้ครับ/ค่ะ

— ReviewHub`,
    },
  },
  es: {
    0: {
      subject: 'Bienvenido a ReviewHub — vamos a por tu primera respuesta',
      body: (clientUrl) => `Hola,

Ya estás dentro. Orientación rápida:

1. Conecta tu primera plataforma de reseñas (1 min)
   → ${clientUrl}/dashboard

2. Elige cualquier reseña y pulsa "Borrador con IA"
   La IA te da 3 variantes de tono. Editas, copias, pegas en Google.
   Listo en 10 segundos.

3. ¿Quieres una auditoría gratis de 10 respuestas antes de comprometerte?
   → ${clientUrl}/audit (gratis, sin compromiso)

Si te atascas en algo, responde a este correo. Lo leo todos.

— ReviewHub
Bangkok`,
    },
    1: {
      subject: '¿Atascado configurando? Aquí va el atajo',
      body: (clientUrl) => `Hola,

Veo que aún no has conectado ninguna plataforma — la mayoría se atasca en el mismo paso. La ruta más rápida:

→ Google: inicia sesión con la cuenta de Google que es propietaria de tu ficha. Encontramos los listings automáticamente.
→ Yelp / Trustpilot / TripAdvisor: pega la URL pública. Igual de fácil.
→ Otras: importa por CSV (te pasamos una plantilla).

¿Sin acceso a tu Google Business Profile? Tiene arreglo — busca "transferir propiedad de Google Business Profile" o respóndeme y te guío paso a paso.

¿No es para ti? Respóndeme con una palabra y cierro el bucle. No te molesto más.

→ ${clientUrl}/dashboard

— ReviewHub`,
    },
    3: {
      subject: 'La respuesta que recuperó a un cliente (1 min de lectura)',
      body: (clientUrl) => `Hola,

Una historia corta:

Un cafetero de Bangkok que usa ReviewHub recibió esta reseña de 1 estrella:
"El café estaba frío y el camarero nos ignoró 20 minutos."

Los dueños suelen ignorarla o escribir un "Lamentamos profundamente la experiencia" defensivo. Él usó ReviewHub. La IA le redactó esto:

   "Hola [nombre], no es la experiencia que queremos para nadie y la culpa es mía — el martes por la mañana íbamos cortos de personal porque me equivoqué con los turnos. Café frío = inaceptable, eso lo arreglo hoy. Si quieres darnos otra oportunidad, escríbeme directamente @cafename y la próxima ronda corre por mi cuenta."

El cliente le escribió por DM, volvió, y editó la reseña a 5 estrellas.

Esa es la propuesta entera. Tres tonos por cada reseña. 10 segundos por respuesta.

→ ${clientUrl}/dashboard

— ReviewHub`,
    },
    7: {
      subject: 'Plan gratuito vs Starter — diferencias',
      body: (clientUrl) => `Hola,

Llevas una semana en el plan gratuito. Si Starter te ronda la cabeza, comparativa rápida:

FREE
- 3 respuestas IA / mes
- 1 plataforma
- Responde manualmente sin límite

STARTER ($14/mes, ~€13)
- Respuestas IA ilimitadas
- 2 plataformas
- Avisos por email de reseñas nuevas + negativas
- Plantillas de respuesta

PRO ($29/mes)
- Todo lo de Starter
- 6 plataformas
- Resumen semanal por email
- Análisis de tendencias
- Exportación CSV

BUSINESS ($59/mes)
- Multi-negocio (hasta 5)
- API + webhooks
- Soporte prioritario

La mayoría llega al techo de IA del plan Free hacia la semana 2. Si no estás en 3/mes, no hay prisa — sigue con Free todo el tiempo que quieras.

→ ${clientUrl}/pricing

Si tienes dudas sobre cuál te encaja, respóndeme.

— ReviewHub`,
    },
    14: {
      subject: 'Una última cosa antes de que deje de mandarte correos',
      body: (clientUrl) => `Hola,

No voy a seguir mandándote estos — éste es el último, te lo prometo.

Si ReviewHub no es lo tuyo, me encantaría saber por qué. Respóndeme con una frase:

- ¿Herramienta equivocada? (no tienes tantas reseñas que gestionar)
- ¿Mal momento? (tienes otras prioridades ahora)
- ¿UX que rechinó? (algo concreto que te frustró)
- ¿Precio? (¿con qué importe sí lo usarías?)

Leo todas las respuestas y dan forma a lo que construyo a continuación.

Si SÍ te resulta útil — Starter empieza en $14/mes con respuestas IA ilimitadas + avisos por email de reseñas nuevas. El plan gratuito sigue funcionando para volúmenes bajos.

→ ${clientUrl}/pricing

Sea como sea, gracias por probarlo.

— ReviewHub`,
    },
  },
  ja: {
    0: {
      subject: 'ReviewHubへようこそ — 最初の口コミに返信してみましょう',
      body: (clientUrl) => `こんにちは、

登録ありがとうございます。簡単な案内です：

1. 最初の口コミプラットフォームを接続（1分）
   → ${clientUrl}/dashboard

2. 口コミを選んで「AIで下書き」をクリック
   AIが3種類のトーンの下書きを作ります。編集して、コピーして、Googleに貼り付け。
   10秒で完了です。

3. 登録前に、無料で10件分の返信診断を試してみたいですか？
   → ${clientUrl}/audit （無料、押し売りなし）

詰まったらこのメールに返信してください。私が全部読みます。

— ReviewHub
Bangkok`,
    },
    1: {
      subject: 'セットアップで止まっていますか？60秒で説明します',
      body: (clientUrl) => `こんにちは、

まだ口コミプラットフォームを接続されていないようです — みんな同じところで止まります。最短ルート：

→ Google: お店のオーナー権限を持っているGoogleアカウントでログイン。リスティングを自動で見つけます。
→ 食べログ / Retty / ホットペッパー: URLを貼り付けてください。新着口コミを定期的にチェックします。
→ Yelp / TripAdvisor: URLを貼り付けるだけ。

Google Business Profileのオーナー権限がない場合も解決できます — 「Google Business Profile オーナー譲渡」で検索するか、このメールに返信してください。手順を案内します。

合わなさそう？「不要」とだけ返信いただければ、もう連絡しません。

→ ${clientUrl}/dashboard

— ReviewHub`,
    },
    3: {
      subject: 'お客様を取り戻した返信 (1分で読めます)',
      body: (clientUrl) => `こんにちは、

短い話です：

ReviewHubを使っているバンコクのカフェオーナーが、こんな1つ星の口コミを受け取りました：
「コーヒーが冷めていて、店員に20分も無視された。」

ふつうはオーナーは無視するか、「お客様の声を真摯に受け止めます」みたいな防御的な返信を書きます。彼はReviewHubを使い、AIが書いたのはこちら：

   「[名前]さん、本当に申し訳ありません。火曜の朝、シフトを組み間違えて人手が足りませんでした — 完全に私のミスです。冷めたコーヒーは絶対にあってはならないこと、今日中に仕組みを直します。次に近くを通る時、@cafename にDMください。次の一杯は私のおごりです。」

このお客様はDMを返してくれて、再来店し、口コミを5つ星に書き直しました。

それが全てです。一つの口コミに3種類のトーン。1件10秒。

→ ${clientUrl}/dashboard

— ReviewHub`,
    },
    7: {
      subject: '無料プラン vs Starter — どこが違うか',
      body: (clientUrl) => `こんにちは、

無料プランで1週間お使いいただきました。Starterが気になっていたら、比較です：

FREE
- AI返信: 月3件
- 口コミプラットフォーム: 1つ
- 手動返信は無制限

STARTER ($14/月、約2,100円)
- AI返信: 無制限
- プラットフォーム: 2つ
- 新着 + 低評価レビューのメール通知
- 返信テンプレート

PRO ($29/月)
- Starterの全機能
- プラットフォーム: 6つ
- 週次サマリーメール
- トレンド分析
- CSVエクスポート

BUSINESS ($59/月)
- 複数店舗（最大5店舗）
- API + Webhook
- 優先サポート

ほとんどの方は2週目あたりで無料プランのAI上限（月3件）に達します。月3件に達していないなら、急ぐ必要はありません — 無料プランで気が済むまで使ってください。

→ ${clientUrl}/pricing

どれが合うか相談したければ、返信してください。

— ReviewHub`,
    },
    14: {
      subject: 'メールを止める前に、最後にひとつだけ',
      body: (clientUrl) => `こんにちは、

これ以上メールはお送りしません — 約束します、これが最後です。

ReviewHubが合わなかったとしたら、なぜか教えていただけませんか。一文でも結構です：

- 道具違い？ (返信が必要な口コミがそんなに多くない)
- タイミング？ (今は他のことで忙しい)
- UXが合わなかった？ (具体的に何が引っかかった？)
- 価格？ ($Xなら使う、という金額があれば)

全部読みますし、いただいた答えが次に作るものを決めます。

それでも役に立ちそうなら — Starterは月$14、AI返信50件 + 週次メール。無料プランも引き続き、少量利用にはお使いいただけます。

→ ${clientUrl}/pricing

どちらにせよ、試していただきありがとうございました。

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
