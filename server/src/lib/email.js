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

You're in. One step left:

→ Connect your Google account (1 minute)
   ${clientUrl}/dashboard

After that, every new review lands in your inbox with an AI-drafted reply. You approve, it posts. The first few drafts will feel slightly off-tone — edit them, and the system learns your voice.

Two things worth knowing day one:

- The drafts are starting points, not finished replies. Edit anything you want before posting; ReviewHub picks up your edits and gets closer next time.
- For 1-star reviews, the system writes very differently than for 5-stars — specific acknowledgment, ownership, no "we strive for excellence" filler. You'll see.

Reply to this email if you get stuck. I read every one.

— Earth
ReviewHub · Bangkok`,
    },
    1: {
      subject: 'Stuck on setup? 60-second walkthrough',
      body: (clientUrl) => `Hi there,

Noticed you haven't connected a review platform yet — most people get stuck on the same step. Here's the fastest path:

→ Google: Sign in with the Google account that owns your business profile. We auto-find listings.
→ Wongnai: Paste your Wongnai URL. We poll it for new reviews.
→ Yelp / Trustpilot / TripAdvisor: Paste the URL. Same idea.

If you don't have access to your Google Business Profile, that's fixable — we wrote a step-by-step guide here: https://reviewhub.review/blog/transfer-google-business-profile-ownership (or just reply and I'll walk you through it).

Not for you? Reply with one word and I'll close the loop. No follow-ups.

→ ${clientUrl}/dashboard

— Earth
ReviewHub · Bangkok`,
    },
    3: {
      subject: 'The reply that brought a customer back (1-min read)',
      body: (clientUrl) => `Hi there,

Quick story:

A Sukhumvit-area café owner I work with (anonymized at her request) had a 1-star review:
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

You've been on the free plan for a week. Short version:

→ FREE: 3 AI replies / month, 1 review platform.
→ STARTER ($14/mo, ~฿490): unlimited AI replies, new-review email alerts, reusable templates.

Most owners hit the 3-replies cap around week 2. If you haven't yet, the free tier is fine to stay on — no rush.

The full plan comparison (with Pro and Business) plus a "$14/mo vs hiring a VA" cost breakdown is at:

→ ${clientUrl}/pricing

Reply with any questions about which plan fits your business. I read every one.

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
- It worked, just unsubscribing from these emails (totally fine — reply "stop")

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
      body: (clientUrl) => `สวัสดีครับ

ยินดีต้อนรับสู่ ReviewHub! เหลืออีกขั้นตอนเดียว:

→ เชื่อม Google account (1 นาที)
   ${clientUrl}/dashboard

หลังจากนั้นทุกรีวิวใหม่จะมาถึง inbox พร้อมคำตอบที่ AI ร่างให้แล้ว คุณกด approve มันก็โพสต์ ช่วงแรกๆ คำตอบอาจจะยังไม่ตรงโทนของคุณเป๊ะ แก้ไขได้ ระบบเรียนรู้จากการแก้แต่ละครั้ง

สองเรื่องที่ควรรู้ตั้งแต่วันแรก:

- คำตอบที่ระบบร่างให้เป็น "จุดตั้งต้น" ไม่ใช่คำตอบสำเร็จรูป แก้ก่อนโพสต์ได้เลย แล้วระบบจะใกล้เคียงโทนของคุณมากขึ้นเรื่อยๆ
- รีวิว 1 ดาว ระบบจะเขียนต่างจากรีวิว 5 ดาวมาก — ขอโทษเฉพาะเรื่อง รับผิดชอบ ไม่มีคำพูดทั่วไปแบบ "เรามุ่งมั่นพัฒนา"

ติดอะไรตอบกลับอีเมลนี้ได้ ผมอ่านทุกฉบับ

— Earth
ReviewHub · Bangkok`,
    },
    1: {
      subject: 'ติดอยู่ตรงไหน? 60 วินาทีพอ',
      body: (clientUrl) => `สวัสดีครับ/ค่ะ

เห็นว่ายังไม่ได้เชื่อมแพลตฟอร์มรีวิว — คนส่วนใหญ่ติดที่ขั้นนี้แหละ ลองทางลัดนี้:

→ Google: เข้าสู่ระบบด้วย Google account ที่เป็นเจ้าของ business profile เราจะหาให้อัตโนมัติ
→ Wongnai: paste URL ร้านบน Wongnai เราตรวจรีวิวใหม่ให้
→ Yelp / Trustpilot / TripAdvisor: paste URL เช่นกัน

ถ้าไม่มีสิทธิ์เข้า Google Business Profile แก้ได้ครับ/ค่ะ — เราเขียนคู่มือทีละขั้นไว้ที่ https://reviewhub.review/blog/transfer-google-business-profile-ownership (หรือตอบกลับมา จะแนะนำให้)

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

Ya estás dentro. Solo queda un paso:

→ Conecta tu cuenta de Google (1 minuto)
   ${clientUrl}/dashboard

Después de eso, cada reseña nueva llega a tu bandeja con un borrador de respuesta hecho con IA. Tú apruebas, se publica. Los primeros borradores van a sentirse algo descalibrados — edítalos, y el sistema aprende tu voz.

Dos cosas que vale la pena saber el primer día:

- Los borradores son puntos de partida, no respuestas finales. Edita lo que quieras antes de publicar; ReviewHub aprende de tus ediciones.
- Para reseñas de 1 estrella, el sistema escribe muy distinto que para 5 estrellas — reconocimiento específico, asumir responsabilidad, sin frases tipo "nos esforzamos por la excelencia".

Si te atascas, responde a este correo. Lo leo todos.

— Earth
ReviewHub · Bangkok`,
    },
    1: {
      subject: '¿Atascado configurando? Aquí va el atajo',
      body: (clientUrl) => `Hola,

Veo que aún no has conectado ninguna plataforma — la mayoría se atasca en el mismo paso. La ruta más rápida:

→ Google: inicia sesión con la cuenta de Google que es propietaria de tu ficha. Encontramos los listings automáticamente.
→ Yelp / Trustpilot / TripAdvisor: pega la URL pública. Igual de fácil.
→ Otras: importa por CSV (te pasamos una plantilla).

¿Sin acceso a tu Google Business Profile? Tiene arreglo — escribimos una guía paso a paso aquí: https://reviewhub.review/blog/transfer-google-business-profile-ownership (o respóndeme y te guío).

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

登録ありがとうございます。あと一歩だけ：

→ Googleアカウントを接続（1分）
   ${clientUrl}/dashboard

接続後、新しい口コミが届くたびにAIが下書きを作って受信箱に届きます。承認すれば自動投稿。最初の数件はトーンが少しずれるかもしれませんが、編集していただければシステムがあなたの声を学習していきます。

最初の日に知っておくと良いこと2つ：

- 下書きは「出発点」であり、完成形ではありません。投稿前に好きなだけ編集してください。あなたの編集からReviewHubは学習します。
- 1つ星の口コミと5つ星の口コミでは、システムの書き方が大きく違います — 具体的に何が問題だったかを認め、責任を持つ。「努力します」のような決まり文句は使いません。

詰まったらこのメールに返信してください。私が全部読みます。

— Earth
ReviewHub · Bangkok`,
    },
    1: {
      subject: 'セットアップで止まっていますか？60秒で説明します',
      body: (clientUrl) => `こんにちは、

まだ口コミプラットフォームを接続されていないようです — みんな同じところで止まります。最短ルート：

→ Google: お店のオーナー権限を持っているGoogleアカウントでログイン。リスティングを自動で見つけます。
→ 食べログ / Retty / ホットペッパー: URLを貼り付けてください。新着口コミを定期的にチェックします。
→ Yelp / TripAdvisor: URLを貼り付けるだけ。

Google Business Profileのオーナー権限がない場合も解決できます — 手順をこちらにまとめました: https://reviewhub.review/blog/transfer-google-business-profile-ownership (またはこのメールに返信していただければ案内します)

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

それでも役に立ちそうなら — Starterは月$14、AI返信は無制限 + 新着レビューのメール通知。無料プランも引き続き、少量利用にはお使いいただけます。

→ ${clientUrl}/pricing

どちらにせよ、試していただきありがとうございました。

— ReviewHub`,
    },
  },
  de: {
    0: {
      subject: 'Willkommen bei ReviewHub — beantworten wir Ihre erste Bewertung',
      body: (clientUrl) => `Hallo,

Sie sind drin. Kurze Orientierung:

1. Verbinden Sie Ihre erste Bewertungsplattform (1 Min.)
   → ${clientUrl}/dashboard

2. Wählen Sie eine Bewertung und klicken Sie auf „Antwort entwerfen"
   Die KI erstellt 3 Tonvarianten. Bearbeiten, kopieren, in Google einfügen.
   In 10 Sekunden erledigt.

3. Möchten Sie vor dem Festlegen ein kostenloses Audit über 10 Antworten?
   → ${clientUrl}/audit (kostenlos, kein Verkaufsgespräch)

Antworten Sie auf diese E-Mail, wenn Sie hängenbleiben. Ich lese jede einzelne.

— ReviewHub
Bangkok`,
    },
    1: {
      subject: 'Beim Setup hängengeblieben? 60-Sekunden-Anleitung',
      body: (clientUrl) => `Hallo,

Sie haben noch keine Bewertungsplattform verbunden — die meisten bleiben am gleichen Schritt hängen. Der schnellste Weg:

→ Google: Mit dem Google-Konto anmelden, das Ihr Unternehmensprofil besitzt. Wir finden Listings automatisch.
→ Yelp / Trustpilot / TripAdvisor / HolidayCheck: URL einfügen. Wir prüfen regelmäßig auf neue Bewertungen.

Wenn Sie keinen Zugriff auf Ihr Google Business Profile haben, ist das lösbar — googeln Sie „Google Business Profile Inhaberschaft übertragen", oder antworten Sie und ich führe Sie durch.

Nicht das Richtige für Sie? Antworten Sie mit einem Wort und ich beende den Faden. Keine Folge-Mails.

→ ${clientUrl}/dashboard

— ReviewHub`,
    },
    3: {
      subject: 'Die Antwort, die einen Kunden zurückbrachte (1 Min. Lesezeit)',
      body: (clientUrl) => `Hallo,

Kurze Geschichte:

Ein Café-Besitzer in Bangkok, mit dem ich arbeite, bekam eine 1-Stern-Bewertung:
„Kaffee war kalt, Bedienung hat uns 20 Minuten ignoriert."

Die meisten Inhaber würden ignorieren oder eine defensive „Wir streben nach Exzellenz"-Antwort schreiben. Er nutzte ReviewHub. Die KI entwarf das hier:

   „Hi [Name], das ist nicht die Erfahrung, die wir jemandem wünschen, und die Wartezeit liegt an mir — Dienstagmorgen waren wir unterbesetzt und ich hatte den Schichtplan falsch gemacht. Kalter Kaffee = inakzeptabel, das stelle ich heute ab. Würde es gerne beim nächsten Besuch wiedergutmachen — schreiben Sie mir eine DM @cafename und Ihre nächste Runde geht aufs Haus."

Der Bewerter schrieb zurück, kam vorbei und änderte die Bewertung auf 5 Sterne.

Das ist das ganze Versprechen. Drei Tonvarianten zu jeder Bewertung. 10 Sekunden pro Antwort.

→ ${clientUrl}/dashboard

— ReviewHub`,
    },
    7: {
      subject: 'Free vs. Starter — was Sie unterscheidet',
      body: (clientUrl) => `Hallo,

Sie sind eine Woche im Free-Plan. Wenn Starter im Raum steht, kurzer Vergleich:

FREE
- 3 KI-Antworten / Monat
- 1 Bewertungsplattform
- Manuelle Antworten unbegrenzt

STARTER ($14/Mon., ca. 13 €)
- KI-Antworten unbegrenzt
- 2 Plattformen
- E-Mail-Alerts bei neuen + negativen Bewertungen
- Wiederverwendbare Antwortvorlagen

PRO ($29/Mon.)
- Alles aus Starter
- 6 Plattformen
- Wöchentliche Zusammenfassung per E-Mail
- Trend-Analytics
- CSV-Export

BUSINESS ($59/Mon.)
- Mehrere Standorte (bis zu 5 Unternehmen)
- API + Webhooks
- Priority Support

Die meisten erreichen das Free-Limit (3/Monat) etwa in Woche 2. Wenn Sie noch nicht bei 3/Monat sind, kein Druck — bleiben Sie auf Free, solange es passt.

→ ${clientUrl}/pricing

Antworten Sie, wenn Sie Fragen zur Plan-Wahl haben.

— ReviewHub`,
    },
    14: {
      subject: 'Eine letzte Sache, bevor ich aufhöre, Ihnen zu schreiben',
      body: (clientUrl) => `Hallo,

Ich werde keine weiteren dieser Mails schicken — versprochen, das ist die letzte.

Falls ReviewHub nicht das Richtige für Sie war, würde ich gerne wissen, warum. Ein Satz reicht:

- Falsches Tool? (nicht so viele Bewertungen zu managen)
- Falscher Zeitpunkt? (gerade andere Prioritäten)
- UX, die nicht gepasst hat? (was konkret hat geknirscht?)
- Preis? (bei welchem Betrag würden Sie es nutzen?)

Ich lese alle Antworten, und sie formen, was ich als nächstes baue.

Falls es DOCH nützlich ist — Starter beginnt bei $14/Mon. mit unbegrenzten KI-Antworten + E-Mail-Alerts bei neuen Bewertungen. Der Free-Plan funktioniert weiter für geringes Volumen.

→ ${clientUrl}/pricing

So oder so, danke fürs Ausprobieren.

— ReviewHub`,
    },
  },
  fr: {
    0: {
      subject: 'Bienvenue chez ReviewHub — répondons à votre premier avis',
      body: (clientUrl) => `Bonjour,

C'est bon, vous êtes inscrit. Petite orientation :

1. Connectez votre première plateforme d'avis (1 min)
   → ${clientUrl}/dashboard

2. Choisissez n'importe quel avis et cliquez sur « Brouillon IA »
   L'IA propose 3 variantes de ton. Vous éditez, copiez, collez sur Google.
   Fait en 10 secondes.

3. Vous voulez un audit gratuit de 10 réponses avant de vous engager ?
   → ${clientUrl}/audit (gratuit, sans relance)

Si vous bloquez, répondez à ce mail. Je lis chacune des réponses.

— ReviewHub
Bangkok`,
    },
    1: {
      subject: 'Bloqué à la configuration ? Voici le raccourci',
      body: (clientUrl) => `Bonjour,

J'ai vu que vous n'aviez pas encore connecté de plateforme — la plupart des gens bloquent au même endroit. Le chemin le plus rapide :

→ Google : Connectez-vous avec le compte Google qui possède votre fiche d'établissement. On retrouve les annonces automatiquement.
→ Yelp / Trustpilot / TripAdvisor / TheFork : collez l'URL. On vérifie régulièrement.

Si vous n'avez pas accès à votre Google Business Profile, c'est rattrapable — cherchez « transférer la propriété d'une fiche Google Business », ou répondez et je vous guide.

Pas pour vous ? Répondez avec un mot et je clos la boucle. Pas de relance.

→ ${clientUrl}/dashboard

— ReviewHub`,
    },
    3: {
      subject: 'La réponse qui a ramené un client (1 min de lecture)',
      body: (clientUrl) => `Bonjour,

Petite histoire :

Un patron de café à Bangkok avec qui je travaille a reçu un avis 1 étoile :
« Café froid, serveur nous a ignorés pendant 20 minutes. »

La plupart des patrons ignoreraient ou écriraient une réponse défensive type « Nous visons l'excellence ». Lui a utilisé ReviewHub. L'IA a proposé ceci :

   « Bonjour [nom], ce n'est pas l'expérience que je veux pour qui que ce soit, et l'attente, c'est de ma faute — mardi matin nous étions en sous-effectif et j'avais mal posé le planning. Café froid = inacceptable, je règle ce processus aujourd'hui. J'aimerais me racheter à votre prochain passage — envoyez-moi un DM @cafename et la prochaine tournée est offerte. »

La personne a répondu en DM, est revenue, a réédité son avis en 5 étoiles.

C'est tout le pitch. Trois variantes de ton sur chaque avis. 10 secondes par réponse.

→ ${clientUrl}/dashboard

— ReviewHub`,
    },
    7: {
      subject: 'Free vs Starter — ce qui change',
      body: (clientUrl) => `Bonjour,

Vous êtes en plan gratuit depuis une semaine. Si Starter trotte dans votre tête, comparatif rapide :

FREE
- 3 réponses IA / mois
- 1 plateforme
- Réponses manuelles illimitées

STARTER ($14/mois, ~13 €)
- Réponses IA illimitées
- 2 plateformes
- Alertes email sur les nouveaux avis + avis négatifs
- Modèles de réponse réutilisables

PRO ($29/mois)
- Tout Starter
- 6 plateformes
- Résumé hebdomadaire par email
- Analytics de tendance
- Export CSV

BUSINESS ($59/mois)
- Multi-établissement (jusqu'à 5)
- API + webhooks
- Support prioritaire

La plupart atteignent le plafond Free (3/mois) en semaine 2. Si vous n'y êtes pas, pas de pression — restez sur Free tant que ça vous convient.

→ ${clientUrl}/pricing

Répondez si vous voulez en discuter.

— ReviewHub`,
    },
    14: {
      subject: 'Une dernière chose avant que j\'arrête de vous écrire',
      body: (clientUrl) => `Bonjour,

Je n'enverrai plus ce type de mail — promis, c'est le dernier.

Si ReviewHub ne vous convenait pas, j'aimerais comprendre pourquoi. Une phrase suffit :

- Mauvais outil ? (pas tant d'avis à gérer)
- Mauvais moment ? (priorités ailleurs)
- UX qui a coincé ? (qu'est-ce qui a frustré, concrètement ?)
- Prix ? (à quel montant l'utiliseriez-vous ?)

Je lis toutes les réponses et elles façonnent ce que je construis ensuite.

Si c'est QUAND MÊME utile — Starter commence à $14/mois avec des réponses IA illimitées + alertes email sur les nouveaux avis. Le plan gratuit reste utilisable en faible volume.

→ ${clientUrl}/pricing

Quoi qu'il en soit, merci d'avoir testé.

— ReviewHub`,
    },
  },
  it: {
    0: {
      subject: 'Benvenuto su ReviewHub — rispondiamo alla tua prima recensione',
      body: (clientUrl) => `Ciao,

Sei dentro. Orientamento veloce:

1. Collega la tua prima piattaforma di recensioni (1 min)
   → ${clientUrl}/dashboard

2. Scegli una recensione qualsiasi e clicca "Bozza con IA"
   L'IA crea 3 varianti di tono. Modifichi, copi, incolli su Google.
   Fatto in 10 secondi.

3. Vuoi un audit gratis su 10 risposte prima di decidere?
   → ${clientUrl}/audit (gratuito, senza pressioni)

Se ti blocchi, rispondi a questa mail. Leggo tutte le risposte.

— ReviewHub
Bangkok`,
    },
    1: {
      subject: 'Bloccato sulla configurazione? Scorciatoia in 60 secondi',
      body: (clientUrl) => `Ciao,

Vedo che non hai ancora collegato una piattaforma — la maggior parte delle persone si blocca nello stesso punto. La via più veloce:

→ Google: accedi con l'account Google che possiede la scheda. Troviamo i listing automaticamente.
→ Yelp / Trustpilot / TripAdvisor / TheFork: incolla l'URL. Controlliamo regolarmente.

Se non hai accesso al tuo Google Business Profile, si risolve — cerca "trasferimento proprietà Google Business Profile", oppure rispondi e ti guido.

Non fa per te? Rispondi con una parola e chiudo il giro. Nessun follow-up.

→ ${clientUrl}/dashboard

— ReviewHub`,
    },
    3: {
      subject: 'La risposta che ha riportato un cliente (1 min di lettura)',
      body: (clientUrl) => `Ciao,

Storia veloce:

Un titolare di caffè a Bangkok con cui lavoro ha ricevuto una recensione 1 stella:
"Caffè freddo, cameriere ci ha ignorati per 20 minuti."

La maggior parte dei titolari ignorerebbe o scriverebbe una risposta difensiva tipo "Puntiamo all'eccellenza". Lui ha usato ReviewHub. L'IA ha proposto questa:

   "Ciao [nome], questa non è l'esperienza che voglio per nessuno, e l'attesa è colpa mia — martedì mattina eravamo sotto-organico e avevo sbagliato i turni. Caffè freddo = inaccettabile, sto sistemando il processo oggi. Mi piacerebbe rifarmi al tuo prossimo passaggio — mandami un DM @cafename e il prossimo giro lo offro io."

La persona ha risposto in DM, è tornata, ha modificato in 5 stelle.

Questo è tutto il pitch. Tre varianti di tono per ogni recensione. 10 secondi a risposta.

→ ${clientUrl}/dashboard

— ReviewHub`,
    },
    7: {
      subject: 'Free vs Starter — la differenza',
      body: (clientUrl) => `Ciao,

Sei su Free da una settimana. Se Starter ti gira in testa, confronto veloce:

FREE
- 3 risposte IA / mese
- 1 piattaforma
- Risposte manuali illimitate

STARTER ($14/mese, ~13 €)
- Risposte IA illimitate
- 2 piattaforme
- Avvisi email su nuove + recensioni negative
- Modelli di risposta riutilizzabili

PRO ($29/mese)
- Tutto Starter
- 6 piattaforme
- Riepilogo settimanale via email
- Analytics di tendenza
- Esportazione CSV

BUSINESS ($59/mese)
- Multi-sede (fino a 5)
- API + webhook
- Supporto prioritario

La maggior parte raggiunge il tetto Free (3/mese) verso la settimana 2. Se non sei a 3/mese, nessuna fretta — resta su Free finché ti basta.

→ ${clientUrl}/pricing

Rispondi se vuoi parlarne.

— ReviewHub`,
    },
    14: {
      subject: 'Un\'ultima cosa prima che smetto di scriverti',
      body: (clientUrl) => `Ciao,

Non manderò più questo tipo di email — promesso, è l'ultima.

Se ReviewHub non era adatto a te, mi piacerebbe sapere perché. Basta una frase:

- Strumento sbagliato? (non così tante recensioni da gestire)
- Momento sbagliato? (priorità altrove)
- UX che non ha funzionato? (qualcosa di specifico che ha frustrato?)
- Prezzo? (a quale cifra lo useresti?)

Leggo tutte le risposte e plasmano cosa costruisco dopo.

Se INVECE serve — Starter parte da $14/mese con risposte IA illimitate + avvisi email sulle nuove recensioni. Il piano gratuito resta utilizzabile per volumi bassi.

→ ${clientUrl}/pricing

In ogni caso, grazie per averlo provato.

— ReviewHub`,
    },
  },
  pt: {
    0: {
      subject: 'Bem-vindo ao ReviewHub — vamos responder à sua primeira avaliação',
      body: (clientUrl) => `Olá,

Você está dentro. Orientação rápida:

1. Conecte sua primeira plataforma de avaliações (1 min)
   → ${clientUrl}/dashboard

2. Escolha qualquer avaliação e clique em "Rascunho com IA"
   A IA gera 3 variantes de tom. Edita, copia, cola no Google.
   Pronto em 10 segundos.

3. Quer uma auditoria grátis de 10 respostas antes de decidir?
   → ${clientUrl}/audit (gratuito, sem pressão)

Se travar, responda este email. Eu leio cada um.

— ReviewHub
Bangkok`,
    },
    1: {
      subject: 'Travado na configuração? Atalho de 60 segundos',
      body: (clientUrl) => `Olá,

Vi que você ainda não conectou uma plataforma — a maioria das pessoas trava no mesmo passo. O caminho mais rápido:

→ Google: faça login com a conta Google que é dona do seu perfil. A gente acha as listagens automaticamente.
→ Yelp / Trustpilot / TripAdvisor / Reclame Aqui: cole a URL. Verificamos regularmente.

Se não tem acesso ao seu Google Business Profile, dá pra resolver — pesquise "transferir titularidade Google Business Profile", ou responda e eu te oriento.

Não é pra você? Responda com uma palavra e eu fecho o ciclo. Sem follow-ups.

→ ${clientUrl}/dashboard

— ReviewHub`,
    },
    3: {
      subject: 'A resposta que trouxe um cliente de volta (1 min de leitura)',
      body: (clientUrl) => `Olá,

Histórinha rápida:

Um dono de café em Bangkok com quem trabalho recebeu uma avaliação de 1 estrela:
"Café frio, garçom nos ignorou por 20 minutos."

A maioria dos donos ignoraria ou escreveria uma resposta defensiva tipo "Buscamos a excelência". Ele usou ReviewHub. A IA sugeriu isto:

   "Oi [nome], essa não é a experiência que eu quero pra ninguém, e a espera é por minha conta — terça de manhã estávamos com pessoal reduzido e eu errei a escala. Café frio = inaceitável, estou ajustando o processo hoje. Adoraria compensar na próxima vez que passar — me manda DM @cafename e a próxima rodada é por minha conta."

A pessoa respondeu por DM, voltou, editou pra 5 estrelas.

Esse é o pitch inteiro. Três variantes de tom em cada avaliação. 10 segundos por resposta.

→ ${clientUrl}/dashboard

— ReviewHub`,
    },
    7: {
      subject: 'Free vs Starter — qual a diferença',
      body: (clientUrl) => `Olá,

Você está no plano Free há uma semana. Se Starter está rondando, comparativo rápido:

FREE
- 3 respostas com IA / mês
- 1 plataforma
- Respostas manuais ilimitadas

STARTER ($14/mês, ~R$ 70)
- Respostas com IA ilimitadas
- 2 plataformas
- Alertas por email em avaliações novas + negativas
- Modelos de resposta reutilizáveis

PRO ($29/mês)
- Tudo do Starter
- 6 plataformas
- Resumo semanal por email
- Analytics de tendência
- Exportação CSV

BUSINESS ($59/mês)
- Multi-negócio (até 5)
- API + webhooks
- Suporte prioritário

A maioria atinge o teto do Free (3/mês) por volta da semana 2. Se você não está em 3/mês, sem pressa — fique no Free enquanto resolver.

→ ${clientUrl}/pricing

Responde se quiser conversar sobre qual plano cabe.

— ReviewHub`,
    },
    14: {
      subject: 'Uma última coisa antes de eu parar de te escrever',
      body: (clientUrl) => `Olá,

Não vou mandar mais desse tipo — prometido, esse é o último.

Se o ReviewHub não foi pra você, eu adoraria saber por quê. Uma frase basta:

- Ferramenta errada? (não tem tantas avaliações pra gerenciar)
- Momento errado? (prioridades em outro lugar)
- UX que travou? (algo específico que frustrou?)
- Preço? (em qual valor você usaria?)

Leio todas as respostas, e elas moldam o que construo a seguir.

Se DE FATO ainda for útil — Starter começa em $14/mês com respostas IA ilimitadas + alertas por email em avaliações novas. O plano gratuito continua funcionando pra volumes baixos.

→ ${clientUrl}/pricing

De qualquer forma, obrigado por testar.

— ReviewHub`,
    },
  },
  zh: {
    0: {
      subject: '欢迎使用 ReviewHub — 我们来回复您的第一条评价',
      body: (clientUrl) => `您好，

您已成功注册。快速上手指引：

1. 连接您的第一个评价平台（约 1 分钟）
   → ${clientUrl}/dashboard

2. 选择任意一条评价，点击"AI 起草回复"
   AI 会生成 3 种语气版本。编辑后复制粘贴到 Google 即可。
   10 秒完成。

3. 想在决定订阅前先免费体验 10 条回复审计？
   → ${clientUrl}/audit （免费，没有推销）

遇到问题直接回复这封邮件，我会逐一阅读。

— ReviewHub
曼谷`,
    },
    1: {
      subject: '配置卡住了？60 秒快速指引',
      body: (clientUrl) => `您好，

注意到您还没有连接评价平台 — 大多数人都卡在同一步。最快的路径：

→ Google：用拥有店铺资料所有权的 Google 账号登录。我们会自动找到您的列表。
→ 大众点评 / Yelp / TripAdvisor：粘贴链接，我们会定期抓取新评价。

如果您没有 Google Business Profile 的所有权，也能解决 — 搜索"Google 商家资料所有权转移"，或回复邮件，我手把手带您操作。

觉得不合适？回复一个字"否"，我就关闭循环。不会再发邮件。

→ ${clientUrl}/dashboard

— ReviewHub`,
    },
    3: {
      subject: '一条让客人回头的回复（1 分钟阅读）',
      body: (clientUrl) => `您好，

简短分享一个故事：

我合作的一位曼谷咖啡店主收到了 1 星评价：
"咖啡是凉的，服务员忽视了我们 20 分钟。"

大多数店主要么置之不理，要么写一句防御性的"我们追求卓越"敷衍过去。他用了 ReviewHub，AI 起草了这条：

   "您好 [姓名]，这绝不是我们希望任何人遇到的体验，等待这件事是我的错 — 周二早上我们人手不足，我把排班搞错了。冷咖啡 = 不可接受，今天就改进流程。希望下次能为您补偿 — 给 @cafename 发条私信，下一杯我请。"

那位顾客回了私信，再次光顾，把评价改成了 5 星。

这就是整个产品的核心价值。每条评价 3 种语气版本，每条 10 秒搞定。

→ ${clientUrl}/dashboard

— ReviewHub`,
    },
    7: {
      subject: '免费版 vs Starter — 区别在哪',
      body: (clientUrl) => `您好，

您使用免费版已经一周了。如果在考虑 Starter，快速对比：

FREE
- 每月 3 条 AI 回复
- 1 个评价平台
- 手动回复不限量

STARTER（$14/月，约 ¥100）
- AI 回复不限量
- 2 个平台
- 新评价 + 差评邮件提醒
- 可复用的回复模板

PRO（$29/月）
- 包含 Starter 全部
- 6 个平台
- 每周邮件摘要
- 趋势分析
- CSV 导出

BUSINESS（$59/月）
- 多门店（最多 5 个）
- API + Webhook
- 优先支持

大部分用户在第二周左右达到免费版上限（3 条/月）。如果您还没到 3 条/月，不必着急 — 免费版可以一直用。

→ ${clientUrl}/pricing

如果想聊聊哪个套餐合适，直接回复。

— ReviewHub`,
    },
    14: {
      subject: '在我停止给您发邮件之前，最后一件事',
      body: (clientUrl) => `您好，

我不会再发这类邮件了 — 保证，这是最后一封。

如果 ReviewHub 不适合您，我很想知道原因。一句话就够：

- 工具不对？（评价没那么多需要管理）
- 时机不对？（现在有别的优先事项）
- UX 体验卡住了？（具体哪里让您觉得不顺？）
- 价格？（多少钱您会用？）

我会阅读所有回复，您的答案决定我接下来构建什么。

如果其实还有用 — Starter 月付 $14，AI 回复不限量 + 新评价邮件提醒。免费版仍可用于低用量场景。

→ ${clientUrl}/pricing

无论如何，感谢您试用。

— ReviewHub`,
    },
  },
  ko: {
    0: {
      subject: 'ReviewHub에 오신 것을 환영합니다 — 첫 번째 리뷰에 답글을 달아봅시다',
      body: (clientUrl) => `안녕하세요,

가입이 완료되었습니다. 간단한 안내입니다:

1. 첫 번째 리뷰 플랫폼을 연결하세요 (약 1분)
   → ${clientUrl}/dashboard

2. 아무 리뷰나 선택하고 "AI 답변 초안" 버튼을 클릭하세요
   AI가 3가지 톤의 답변을 만들어 드립니다. 편집하고 복사해서 Google에 붙여넣으세요.
   10초면 끝납니다.

3. 결제 전에 10개 답변에 대한 무료 진단을 받아보시겠어요?
   → ${clientUrl}/audit (무료, 영업 전화 없음)

막히는 부분이 있으면 이 이메일에 답장 주세요. 모두 직접 읽습니다.

— ReviewHub
방콕`,
    },
    1: {
      subject: '설정에서 막히셨나요? 60초 빠른 가이드',
      body: (clientUrl) => `안녕하세요,

아직 리뷰 플랫폼을 연결하지 않으셨네요 — 대부분 같은 단계에서 막힙니다. 가장 빠른 경로:

→ Google: 비즈니스 프로필 소유권이 있는 Google 계정으로 로그인하세요. 자동으로 등록 정보를 찾아드립니다.
→ 네이버 / Yelp / TripAdvisor / Trustpilot: URL을 붙여넣으세요. 정기적으로 확인합니다.

Google Business Profile 소유권이 없으시면 해결 가능합니다 — "Google 비즈니스 프로필 소유권 이전"을 검색하시거나 이 메일에 답장 주시면 안내해 드립니다.

맞지 않으시면? 한 단어만 답장 주시면 더 이상 보내지 않겠습니다. 후속 이메일 없음.

→ ${clientUrl}/dashboard

— ReviewHub`,
    },
    3: {
      subject: '고객을 다시 오게 만든 답글 (1분 읽기)',
      body: (clientUrl) => `안녕하세요,

짧은 이야기입니다:

저와 함께 일하는 방콕 카페 사장님이 1점 리뷰를 받았습니다:
"커피가 식어 있었고, 직원이 20분간 우리를 무시했어요."

대부분의 사장님은 무시하거나 "최고의 서비스를 위해 노력하겠습니다" 같은 방어적인 답글을 씁니다. 이분은 ReviewHub를 사용했고, AI는 이렇게 초안을 만들었습니다:

   "[이름]님, 누구에게도 이런 경험을 드리고 싶지 않았고, 기다리신 부분은 제 잘못입니다 — 화요일 아침 인력이 부족했는데 제가 스케줄을 잘못 짰습니다. 식은 커피는 절대 있어서는 안 되는 일이고, 오늘 안에 시스템을 고치겠습니다. 다음에 근처에 오시면 보상해 드리고 싶습니다 — @cafename으로 DM 보내주세요. 다음 잔은 제가 사겠습니다."

그 고객은 DM을 보내왔고, 다시 방문해서 리뷰를 5점으로 수정했습니다.

이것이 전부입니다. 리뷰마다 3가지 톤. 한 건당 10초.

→ ${clientUrl}/dashboard

— ReviewHub`,
    },
    7: {
      subject: '무료 플랜 vs Starter — 무엇이 다른가',
      body: (clientUrl) => `안녕하세요,

무료 플랜으로 일주일 사용하셨네요. Starter를 고민 중이시면 간단 비교:

FREE
- AI 답변 월 3건
- 리뷰 플랫폼 1개
- 수동 답변은 무제한

STARTER ($14/월, 약 19,000원)
- AI 답변 무제한
- 플랫폼 2개
- 신규 + 부정 리뷰 이메일 알림
- 재사용 가능한 답변 템플릿

PRO ($29/월)
- Starter 전체 포함
- 플랫폼 6개
- 주간 요약 이메일
- 트렌드 분석
- CSV 내보내기

BUSINESS ($59/월)
- 다중 매장 (최대 5개)
- API + 웹훅
- 우선 지원

대부분의 분들이 2주 차쯤 무료 한도(월 3건)에 도달합니다. 아직 월 3건에 못 미치셨다면 서두를 필요 없습니다 — 편하실 때까지 무료 플랜을 쓰세요.

→ ${clientUrl}/pricing

어떤 플랜이 맞을지 상의하고 싶으시면 답장 주세요.

— ReviewHub`,
    },
    14: {
      subject: '메일을 그만 보내기 전에 마지막 한 가지',
      body: (clientUrl) => `안녕하세요,

이런 종류의 이메일은 더 이상 보내지 않겠습니다 — 약속드립니다, 이게 마지막입니다.

ReviewHub가 맞지 않으셨다면 이유를 듣고 싶습니다. 한 문장이면 됩니다:

- 잘못된 도구? (관리할 리뷰가 그렇게 많지 않음)
- 잘못된 시점? (지금은 다른 우선순위)
- UX가 어딘가 걸렸나? (구체적으로 어떤 부분이 답답했나요?)
- 가격? (얼마면 사용하시겠어요?)

모든 답변을 읽고, 그 답이 다음에 무엇을 만들지 결정합니다.

그래도 도움이 될 것 같다면 — Starter는 월 $14에 AI 답변 무제한 + 신규 리뷰 이메일 알림입니다. 무료 플랜은 적은 사용량에는 계속 작동합니다.

→ ${clientUrl}/pricing

어떻든, 시도해 주셔서 감사합니다.

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

// Outbound-audit view notifications — fired when a prospect opens a
// share URL the founder DM'd them. The signal is "this lead just
// engaged" — most valuable response window is the next ~30 minutes,
// so the email is intentionally minimal: who opened, when, link to
// the dashboard for follow-up. No marketing cruft. The founder is
// the only recipient.
const AUDIT_VIEW_STRINGS = {
  en: {
    subject: (n) => `Someone just opened your audit for ${n}`,
    headline: (n) => `${n} just opened your audit`,
    body: (hours, count) => {
      const ago = hours < 1
        ? 'a few minutes ago'
        : hours < 24
          ? `${Math.round(hours)} hour${Math.round(hours) === 1 ? '' : 's'} after you sent it`
          : `${Math.round(hours / 24)} day${Math.round(hours / 24) === 1 ? '' : 's'} after you sent it`;
      const counted = count > 1 ? ` (${count} total opens so far)` : '';
      return `They opened the link ${ago}${counted}. Now is the warmest moment to follow up.`;
    },
    cta: 'View audit + send follow-up',
    footer: "You're getting this because you sent an outbound audit. Notifications throttle to once per audit per 24h.",
  },
  th: {
    subject: (n) => `มีคนเพิ่งเปิดดู audit ที่คุณส่งให้ ${n}`,
    headline: (n) => `${n} เพิ่งเปิดดู audit ของคุณ`,
    body: (hours, count) => {
      const ago = hours < 1
        ? 'เมื่อไม่กี่นาทีที่แล้ว'
        : hours < 24
          ? `หลังจากที่คุณส่งไป ${Math.round(hours)} ชั่วโมง`
          : `หลังจากที่คุณส่งไป ${Math.round(hours / 24)} วัน`;
      const counted = count > 1 ? ` (เปิดดูทั้งหมด ${count} ครั้ง)` : '';
      return `เปิดลิงก์${ago}${counted} นี่คือช่วงเวลาที่เหมาะสมที่สุดสำหรับการติดตามผล`;
    },
    cta: 'ดู audit และส่งติดตามผล',
    footer: 'คุณได้รับอีเมลนี้เพราะส่ง outbound audit การแจ้งเตือนจะส่งไม่เกิน 1 ครั้งต่อ audit ต่อ 24 ชั่วโมง',
  },
  es: {
    subject: (n) => `Alguien acaba de abrir tu auditoría para ${n}`,
    headline: (n) => `${n} acaba de abrir tu auditoría`,
    body: (hours, count) => {
      const ago = hours < 1 ? 'hace unos minutos'
        : hours < 24 ? `${Math.round(hours)} hora${Math.round(hours) === 1 ? '' : 's'} después de enviarla`
        : `${Math.round(hours / 24)} día${Math.round(hours / 24) === 1 ? '' : 's'} después de enviarla`;
      const counted = count > 1 ? ` (${count} aperturas en total)` : '';
      return `Abrieron el enlace ${ago}${counted}. Es el mejor momento para hacer seguimiento.`;
    },
    cta: 'Ver auditoría + enviar seguimiento',
    footer: 'Recibes esto porque enviaste una auditoría externa. Las notificaciones se limitan a una por auditoría cada 24 h.',
  },
  fr: {
    subject: (n) => `Quelqu'un vient d'ouvrir votre audit pour ${n}`,
    headline: (n) => `${n} vient d'ouvrir votre audit`,
    body: (hours, count) => {
      const ago = hours < 1 ? 'il y a quelques minutes'
        : hours < 24 ? `${Math.round(hours)} heure${Math.round(hours) === 1 ? '' : 's'} après l'envoi`
        : `${Math.round(hours / 24)} jour${Math.round(hours / 24) === 1 ? '' : 's'} après l'envoi`;
      const counted = count > 1 ? ` (${count} ouvertures au total)` : '';
      return `Le lien a été ouvert ${ago}${counted}. C'est le meilleur moment pour relancer.`;
    },
    cta: "Voir l'audit + envoyer une relance",
    footer: "Vous recevez ceci car vous avez envoyé un audit externe. Les notifications sont limitées à une par audit toutes les 24 h.",
  },
  de: {
    subject: (n) => `Jemand hat gerade dein Audit für ${n} geöffnet`,
    headline: (n) => `${n} hat gerade dein Audit geöffnet`,
    body: (hours, count) => {
      const ago = hours < 1 ? 'vor wenigen Minuten'
        : hours < 24 ? `${Math.round(hours)} Stunde${Math.round(hours) === 1 ? '' : 'n'} nach dem Versand`
        : `${Math.round(hours / 24)} Tag${Math.round(hours / 24) === 1 ? '' : 'e'} nach dem Versand`;
      const counted = count > 1 ? ` (${count} Aufrufe insgesamt)` : '';
      return `Der Link wurde ${ago} geöffnet${counted}. Jetzt ist der beste Zeitpunkt für ein Follow-up.`;
    },
    cta: 'Audit ansehen + Follow-up senden',
    footer: 'Du erhältst diese E-Mail, weil du ein Outbound-Audit verschickt hast. Benachrichtigungen sind auf eine pro Audit alle 24 h begrenzt.',
  },
  ja: {
    subject: (n) => `${n} があなたの audit を開きました`,
    headline: (n) => `${n} があなたの audit を開きました`,
    body: (hours, count) => {
      const ago = hours < 1 ? '数分前'
        : hours < 24 ? `送信から ${Math.round(hours)} 時間後`
        : `送信から ${Math.round(hours / 24)} 日後`;
      const counted = count > 1 ? `(合計 ${count} 回開封)` : '';
      return `${ago}にリンクが開かれました ${counted}。今がフォローアップの最適なタイミングです。`;
    },
    cta: 'audit を表示 + フォローアップを送信',
    footer: 'outbound audit を送信したため、このメールを受信しています。通知は audit ごとに 24 時間に 1 回までです。',
  },
  zh: {
    subject: (n) => `有人刚刚打开了您发给 ${n} 的审核`,
    headline: (n) => `${n} 刚刚打开了您的审核`,
    body: (hours, count) => {
      const ago = hours < 1 ? '几分钟前'
        : hours < 24 ? `发送后 ${Math.round(hours)} 小时`
        : `发送后 ${Math.round(hours / 24)} 天`;
      const counted = count > 1 ? `(共 ${count} 次打开)` : '';
      return `${ago}打开了链接 ${counted}。现在是跟进的最佳时机。`;
    },
    cta: '查看审核 + 发送跟进',
    footer: '您收到此邮件是因为您发送了对外审核。通知每个审核每 24 小时最多发送一次。',
  },
  pt: {
    subject: (n) => `Alguém acabou de abrir sua auditoria para ${n}`,
    headline: (n) => `${n} acabou de abrir sua auditoria`,
    body: (hours, count) => {
      const ago = hours < 1 ? 'há alguns minutos'
        : hours < 24 ? `${Math.round(hours)} hora${Math.round(hours) === 1 ? '' : 's'} depois de enviar`
        : `${Math.round(hours / 24)} dia${Math.round(hours / 24) === 1 ? '' : 's'} depois de enviar`;
      const counted = count > 1 ? ` (${count} aberturas no total)` : '';
      return `O link foi aberto ${ago}${counted}. Esse é o melhor momento para fazer follow-up.`;
    },
    cta: 'Ver auditoria + enviar follow-up',
    footer: 'Você recebe isto porque enviou uma auditoria externa. As notificações são limitadas a uma por auditoria a cada 24 h.',
  },
  it: {
    subject: (n) => `Qualcuno ha appena aperto il tuo audit per ${n}`,
    headline: (n) => `${n} ha appena aperto il tuo audit`,
    body: (hours, count) => {
      const ago = hours < 1 ? 'pochi minuti fa'
        : hours < 24 ? `${Math.round(hours)} ora${Math.round(hours) === 1 ? '' : 'e'} dopo l'invio`
        : `${Math.round(hours / 24)} giorno${Math.round(hours / 24) === 1 ? '' : 'i'} dopo l'invio`;
      const counted = count > 1 ? ` (${count} aperture totali)` : '';
      return `Il link è stato aperto ${ago}${counted}. È il momento migliore per il follow-up.`;
    },
    cta: "Vedi audit + invia follow-up",
    footer: "Ricevi questa email perché hai inviato un audit esterno. Le notifiche sono limitate a una per audit ogni 24 h.",
  },
  ko: {
    subject: (n) => `누군가 ${n}에게 보낸 audit를 방금 열었습니다`,
    headline: (n) => `${n}이(가) 방금 audit를 열었습니다`,
    body: (hours, count) => {
      const ago = hours < 1 ? '몇 분 전'
        : hours < 24 ? `발송 후 ${Math.round(hours)}시간`
        : `발송 후 ${Math.round(hours / 24)}일`;
      const counted = count > 1 ? `(총 ${count}회 열람)` : '';
      return `${ago}에 링크를 열었습니다 ${counted}. 지금이 후속 연락하기 가장 좋은 시점입니다.`;
    },
    cta: 'audit 보기 + 후속 연락 보내기',
    footer: 'outbound audit를 보냈기 때문에 이 메일을 받습니다. 알림은 audit당 24시간에 한 번으로 제한됩니다.',
  },
};

async function sendAuditViewNotification(userEmail, opts) {
  const { businessName = '', viewCount = 1, hoursSinceCreated = 0, lang = 'en' } = opts || {};
  const s = AUDIT_VIEW_STRINGS[lang] || AUDIT_VIEW_STRINGS.en;

  const safeBizName = escapeHtml(businessName);
  const safeClientUrl = escapeHtml(process.env.CLIENT_URL || 'http://localhost:5173');
  const dashboardUrl = `${safeClientUrl}/outbound-audits`;

  // stripHdr — never let business_name (user-controlled at audit-create
  // time) inject CR/LF into the Subject header. Same pattern as
  // sendNewReviewNotification.
  const subject = stripHdr(s.subject(businessName));

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px 16px">
      <div style="background:#fbf8f1;border:1px solid #e6dfce;border-radius:12px;padding:24px">
        <p style="font-family:monospace;font-size:11px;letter-spacing:.15em;color:#c48a2c;text-transform:uppercase;margin:0 0 8px">Audit opened</p>
        <h2 style="color:#1d242c;margin:0 0 12px;font-size:20px">${escapeHtml(s.headline(businessName))}</h2>
        <p style="color:#4a525a;margin:0 0 20px;line-height:1.55">${escapeHtml(s.body(hoursSinceCreated, viewCount))}</p>
        <a href="${dashboardUrl}"
           style="background:#1e4d5e;color:white;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block;font-size:14px">
          ${escapeHtml(s.cta)}
        </a>
      </div>
      <p style="font-size:11px;color:#9aa3ac;margin-top:16px;text-align:center">${escapeHtml(s.footer)}</p>
    </div>`;

  const text = [
    s.headline(businessName),
    '',
    s.body(hoursSinceCreated, viewCount),
    '',
    `${s.cta}: ${process.env.CLIENT_URL || 'http://localhost:5173'}/outbound-audits`,
    '',
    s.footer,
  ].join('\n');

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EMAIL] Audit view notification → ${userEmail}: ${subject}`);
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

// Outbound-audit follow-up reminder. Fires ~48h after a prospect first
// viewed the audit URL if the founder hasn't marked it as replied. The
// goal is just "remind the founder to nudge them" — we don't have the
// prospect's contact info on record (the founder DM'd / emailed them
// themselves), so we can't auto-send to the prospect. We email the
// founder a copy-pasteable follow-up template + a link back to the
// outbound-audits dashboard where they can mark it replied.
const AUDIT_FOLLOWUP_STRINGS = {
  en: {
    subject: (n) => `Time to follow up with ${n}`,
    headline: (n) => `${n} opened your audit ~48h ago — no reply yet`,
    body: 'Most cold conversions need 2-3 touches. Sending a short nudge now (when they\'ve already seen the value) converts dramatically better than waiting another week. Here\'s a templated follow-up you can paste:',
    templateLabel: 'Copy-paste follow-up',
    template: (biz) => `Hey — circling back on the audit I sent for ${biz}. Did the drafted replies make sense for your tone? Happy to walk you through the auto-posting setup over a 10-min call if that's easier.`,
    cta: 'Open dashboard',
    markReplied: 'Already replied? Mark it in the dashboard so I stop reminding you.',
  },
  th: {
    subject: (n) => `ถึงเวลาติดตามผลกับ ${n}`,
    headline: (n) => `${n} เปิดดู audit ของคุณเมื่อ ~48 ชั่วโมงก่อน — ยังไม่มีการตอบกลับ`,
    body: 'การปิดดีลผ่าน cold outreach ส่วนใหญ่ต้องติดต่อ 2-3 ครั้ง ส่งข้อความสั้นๆ ตอนนี้ (ตอนที่เขาเห็นคุณค่าแล้ว) ได้ผลดีกว่ารออีกสัปดาห์มาก นี่คือเทมเพลตที่คุณก๊อปไปแปะได้เลย:',
    templateLabel: 'ก๊อปไปแปะ',
    template: (biz) => `สวัสดีครับ ติดต่อกลับเรื่อง audit ที่ส่งให้ร้าน ${biz} ครับ คำตอบที่ร่างให้ใช้ได้ไหมครับ? ถ้าอยากให้เซ็ตระบบให้โพสต์อัตโนมัติ คุยสั้นๆ 10 นาทีได้นะครับ`,
    cta: 'เปิดแดชบอร์ด',
    markReplied: 'ตอบกลับแล้วใช่ไหม? ทำเครื่องหมายในแดชบอร์ดเพื่อหยุดการแจ้งเตือน',
  },
  es: {
    subject: (n) => `Hora de hacer seguimiento con ${n}`,
    headline: (n) => `${n} abrió tu auditoría hace ~48 h y aún no ha respondido`,
    body: 'La mayoría de cierres en outreach frío requieren 2-3 contactos. Mandar una nota corta ahora (cuando ya vieron el valor) convierte mucho mejor que esperar otra semana. Aquí va una plantilla lista para copiar y pegar:',
    templateLabel: 'Copiar y pegar',
    template: (biz) => `Hola — pasaba a darle seguimiento a la auditoría que envié para ${biz}. ¿Las respuestas que redactamos te encajan en tono? Si prefieres, hacemos una llamada de 10 min para configurar el envío automático.`,
    cta: 'Abrir panel',
    markReplied: '¿Ya respondiste? Márcalo en el panel para que dejemos de recordártelo.',
  },
  fr: {
    subject: (n) => `Il est temps de relancer ${n}`,
    headline: (n) => `${n} a ouvert votre audit il y a ~48 h et n'a pas encore répondu`,
    body: 'La plupart des conversions en outreach froid nécessitent 2-3 contacts. Envoyer une relance courte maintenant (alors qu\'ils ont déjà vu la valeur) convertit beaucoup mieux qu\'attendre une semaine de plus. Voici un modèle prêt à copier-coller :',
    templateLabel: 'À copier-coller',
    template: (biz) => `Bonjour, je reviens vers vous concernant l'audit que je vous ai envoyé pour ${biz}. Les réponses rédigées vous conviennent-elles en termes de ton ? Je peux aussi faire un appel de 10 min pour configurer l'envoi automatique si c'est plus simple.`,
    cta: 'Ouvrir le tableau de bord',
    markReplied: 'Déjà répondu ? Marquez-le dans le tableau de bord pour arrêter les rappels.',
  },
  de: {
    subject: (n) => `Zeit für ein Follow-up mit ${n}`,
    headline: (n) => `${n} hat dein Audit vor ~48 h geöffnet — noch keine Antwort`,
    body: 'Die meisten Conversions aus Cold Outreach brauchen 2-3 Touchpoints. Eine kurze Erinnerung jetzt (während sie den Wert noch frisch im Kopf haben) konvertiert deutlich besser als noch eine Woche zu warten. Hier ist eine kopierfertige Vorlage:',
    templateLabel: 'Zum Kopieren',
    template: (biz) => `Hi, ich melde mich nochmal wegen des Audits, den ich für ${biz} geschickt habe. Passen die entworfenen Antworten zu deinem Tonfall? Wenn ein 10-min-Call einfacher ist, richten wir das Auto-Posting gemeinsam ein.`,
    cta: 'Dashboard öffnen',
    markReplied: 'Schon geantwortet? Markiere es im Dashboard, damit wir aufhören dich zu erinnern.',
  },
  ja: {
    subject: (n) => `${n} へのフォローアップの時間です`,
    headline: (n) => `${n} は約48時間前に audit を開きましたが、まだ返信がありません`,
    body: 'コールドアウトリーチの成約は通常 2〜3 回の接触が必要です。価値を見たばかりの今、短いフォローアップを送る方が、もう1週間待つよりずっと効果的です。コピペ用のテンプレートはこちら:',
    templateLabel: 'コピー & 貼り付け',
    template: (biz) => `こんにちは。${biz} 様にお送りした audit についてフォローアップさせていただきます。下書きされた返信のトーンはご希望に合っていましたか？自動投稿の設定について 10 分ほどお話しすることも可能です。`,
    cta: 'ダッシュボードを開く',
    markReplied: 'もう返信されましたか？ダッシュボードでマークするとリマインダーは停止します。',
  },
  zh: {
    subject: (n) => `该跟进 ${n} 了`,
    headline: (n) => `${n} 在约 48 小时前打开了您的审核 — 尚未回复`,
    body: '冷开发的大多数成交需要 2-3 次接触。在他们刚看到价值的此刻发一条简短跟进,转化率远高于再等一周。下面是可以直接复制粘贴的模板:',
    templateLabel: '复制粘贴',
    template: (biz) => `您好,跟进一下我之前发给 ${biz} 的审核。起草的回复在语气上是否合适?如果方便,可以安排 10 分钟通话,我帮您设置自动发布。`,
    cta: '打开仪表盘',
    markReplied: '已经回复了吗?请在仪表盘中标记,我们就不再提醒。',
  },
  pt: {
    subject: (n) => `Hora de fazer follow-up com ${n}`,
    headline: (n) => `${n} abriu sua auditoria há ~48 h — ainda sem resposta`,
    body: 'A maioria das conversões em cold outreach precisa de 2-3 toques. Mandar um lembrete curto agora (enquanto eles ainda têm o valor fresco) converte muito mais do que esperar mais uma semana. Aqui vai um modelo pronto pra copiar e colar:',
    templateLabel: 'Copiar e colar',
    template: (biz) => `Oi, voltando aqui sobre a auditoria que enviei para ${biz}. As respostas que rascunhamos fazem sentido no seu tom? Se preferir, marcamos um call de 10 min para configurar o envio automático.`,
    cta: 'Abrir painel',
    markReplied: 'Já respondeu? Marque no painel para a gente parar de lembrar.',
  },
  it: {
    subject: (n) => `È ora di fare follow-up con ${n}`,
    headline: (n) => `${n} ha aperto il tuo audit ~48 ore fa — ancora nessuna risposta`,
    body: 'La maggior parte delle conversioni da cold outreach richiede 2-3 contatti. Mandare un breve sollecito ora (mentre il valore è ancora fresco) converte molto meglio che aspettare un\'altra settimana. Ecco un modello pronto da copiare e incollare:',
    templateLabel: 'Copia e incolla',
    template: (biz) => `Ciao, ti ricontatto riguardo all'audit che ho inviato per ${biz}. Le risposte abbozzate ti tornano a livello di tono? Se preferisci, possiamo fare una chiamata di 10 min per impostare la pubblicazione automatica.`,
    cta: 'Apri dashboard',
    markReplied: 'Hai già risposto? Segnalalo nella dashboard per fermare i promemoria.',
  },
  ko: {
    subject: (n) => `${n}에게 후속 연락할 시간입니다`,
    headline: (n) => `${n}이(가) 약 48시간 전 audit를 열었지만 아직 답변이 없습니다`,
    body: '콜드 아웃리치 전환의 대부분은 2-3회 접촉이 필요합니다. 가치를 막 본 지금 짧은 알림을 보내는 것이 한 주 더 기다리는 것보다 훨씬 더 잘 전환됩니다. 복사해서 붙여넣을 수 있는 템플릿입니다:',
    templateLabel: '복사 & 붙여넣기',
    template: (biz) => `안녕하세요, ${biz}에 대해 보내드린 audit 관련해서 다시 연락드립니다. 작성된 답변이 톤에 맞으셨나요? 원하시면 10분 통화로 자동 게시 설정을 도와드리겠습니다.`,
    cta: '대시보드 열기',
    markReplied: '이미 답변하셨나요? 대시보드에서 표시하시면 알림을 중지합니다.',
  },
};

async function sendAuditFollowupReminder(userEmail, opts) {
  const { businessName = '', lang = 'en' } = opts || {};
  const s = AUDIT_FOLLOWUP_STRINGS[lang] || AUDIT_FOLLOWUP_STRINGS.en;

  const safeBizName = escapeHtml(businessName);
  const safeClientUrl = escapeHtml(process.env.CLIENT_URL || 'http://localhost:5173');
  const dashboardUrl = `${safeClientUrl}/outbound-audits`;
  const subject = stripHdr(s.subject(businessName));
  const templateText = s.template(businessName);

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px 16px">
      <div style="background:#fbf8f1;border:1px solid #e6dfce;border-radius:12px;padding:24px">
        <p style="font-family:monospace;font-size:11px;letter-spacing:.15em;color:#c48a2c;text-transform:uppercase;margin:0 0 8px">Follow-up reminder</p>
        <h2 style="color:#1d242c;margin:0 0 12px;font-size:18px">${escapeHtml(s.headline(businessName))}</h2>
        <p style="color:#4a525a;margin:0 0 18px;line-height:1.55">${escapeHtml(s.body)}</p>
        <p style="font-size:11px;font-family:monospace;letter-spacing:.1em;color:#1e4d5e;text-transform:uppercase;margin:0 0 6px">${escapeHtml(s.templateLabel)}</p>
        <pre style="background:#fff;border:1px solid #e6dfce;border-radius:8px;padding:14px;white-space:pre-wrap;font-family:sans-serif;font-size:13px;line-height:1.5;margin:0 0 18px;color:#1d242c">${escapeHtml(templateText)}</pre>
        <a href="${dashboardUrl}"
           style="background:#1e4d5e;color:white;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block;font-size:14px">
          ${escapeHtml(s.cta)}
        </a>
      </div>
      <p style="font-size:11px;color:#9aa3ac;margin-top:16px;text-align:center">${escapeHtml(s.markReplied)}</p>
    </div>`;

  const text = [
    s.headline(businessName),
    '',
    s.body,
    '',
    `--- ${s.templateLabel} ---`,
    templateText,
    '---',
    '',
    `${s.cta}: ${process.env.CLIENT_URL || 'http://localhost:5173'}/outbound-audits`,
    '',
    s.markReplied,
  ].join('\n');

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EMAIL] Audit follow-up reminder → ${userEmail}: ${subject}`);
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
  sendOnboardingEmail,
  sendAuditViewNotification,
  sendAuditFollowupReminder,
  sendMagicLinkEmail,
  verifySmtp,
  portBlockHint,
};

// Magic-link sign-in email. Single button + paste-fallback URL.
// 15-minute TTL noted in copy so the recipient doesn't sit on it.
async function sendMagicLinkEmail(userEmail, magicUrl, lang = 'en') {
  const STRINGS = {
    en: {
      subject: 'Sign in to ReviewHub',
      headline: 'One click to sign in',
      body: 'Click the button to sign in. This link expires in 15 minutes and only works once.',
      cta: 'Sign in',
      ignore: "Didn't request this? You can safely ignore this email — no one can sign in without your inbox.",
    },
    th: {
      subject: 'เข้าสู่ระบบ ReviewHub',
      headline: 'คลิกเดียวเข้าระบบ',
      body: 'กดปุ่มเพื่อเข้าสู่ระบบ ลิงก์นี้หมดอายุใน 15 นาทีและใช้ได้ครั้งเดียวเท่านั้น',
      cta: 'เข้าสู่ระบบ',
      ignore: 'ไม่ได้ขอใช่ไหม? ละเลยอีเมลนี้ได้อย่างปลอดภัย ไม่มีใครเข้าระบบได้ถ้าไม่มีอีเมลของคุณ',
    },
  };
  const s = STRINGS[lang] || STRINGS.en;
  const subject = stripHdr(s.subject);
  const safeUrl = escapeHtml(magicUrl);

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px 16px">
      <div style="background:#fbf8f1;border:1px solid #e6dfce;border-radius:12px;padding:28px;text-align:center">
        <h2 style="color:#1d242c;margin:0 0 12px;font-size:22px">${escapeHtml(s.headline)}</h2>
        <p style="color:#4a525a;margin:0 0 24px;line-height:1.55">${escapeHtml(s.body)}</p>
        <a href="${safeUrl}"
           style="background:#1e4d5e;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-size:15px;font-weight:600">
          ${escapeHtml(s.cta)}
        </a>
        <p style="color:#9aa3ac;margin:24px 0 0;font-size:11px;word-break:break-all">${safeUrl}</p>
      </div>
      <p style="font-size:11px;color:#9aa3ac;margin-top:16px;text-align:center">${escapeHtml(s.ignore)}</p>
    </div>`;
  const text = [s.headline, '', s.body, '', magicUrl, '', s.ignore].join('\n');

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EMAIL] Magic link → ${userEmail}: ${magicUrl}`);
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
