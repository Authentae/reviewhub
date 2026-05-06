import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../lib/api';
import usePageTitle from '../hooks/usePageTitle';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';
import HoneypotField from '../components/HoneypotField';
import { useI18n } from '../context/I18nContext';
import { useUser } from '../context/UserContext';

// /support — public-or-authed support intake. Real "something broke"
// channel, separate from Frill (which handles feature ideas / feedback).
//
// Auto-fills email when the user is logged in. Pre-selects the category
// from ?type= query param so error toasts can deep-link here with
// context (e.g. /support?type=billing).
//
// On submit: POST /api/support → server emails ADMIN_EMAIL with the
// founder's reply-address set to the submitter, AND stores a
// support_tickets row for follow-up tracking. Founder hits Reply in
// their email client, conversation continues.
export default function Support() {
  const { t, lang } = useI18n();
  const { user } = useUser();
  const location = useLocation();
  usePageTitle(t('support.title', 'Support — direct line to the founder'));

  // Pre-select category from ?type= so e.g. a billing-error toast can
  // link to /support?type=billing and the user lands with the right
  // category already chosen. Sanity-clamp to known categories.
  const params = new URLSearchParams(location.search);
  const initialCategory = (() => {
    const t = (params.get('type') || '').toLowerCase();
    return ['bug', 'billing', 'account', 'feature', 'other'].includes(t) ? t : 'bug';
  })();

  const [form, setForm] = useState({
    email: user?.email || '',
    category: initialCategory,
    subject: '',
    message: '',
    url: typeof window !== 'undefined' ? window.location.origin : '',
  });
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [error, setError] = useState('');
  const [ticketId, setTicketId] = useState(null);

  // Ticket history — only fetched when logged in. The /api/support/me
  // endpoint returns the user's last 50 tickets with status. Persona
  // testers asked for this repeatedly: "I submitted a ticket last week,
  // is it open or resolved? Did anyone see it?"
  const [myTickets, setMyTickets] = useState(null); // null = not loaded
  useEffect(() => {
    if (!user) { setMyTickets(null); return; }
    let cancelled = false;
    api.get('/support/me')
      .then(({ data }) => { if (!cancelled) setMyTickets(data.tickets || []); })
      .catch(() => { if (!cancelled) setMyTickets([]); });
    return () => { cancelled = true; };
  }, [user]);

  // Auto-fill email if user logs in after the page loads (e.g. they came
  // here logged-out, signed in, came back).
  useEffect(() => {
    if (user?.email && !form.email) setForm((f) => ({ ...f, email: user.email }));
  }, [user?.email, form.email]);

  const isThai = lang === 'th';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      setError(t('support.errMissing', 'Please fill in every field.'));
      return;
    }
    if (form.message.trim().length < 5) {
      setError(t('support.errTooShort', 'Please describe the issue in a few sentences.'));
      return;
    }
    setStatus('submitting');
    try {
      const { data } = await api.post('/support', { ...form, website: honeypot });
      setTicketId(data?.ticket_id || null);
      setStatus('success');
    } catch (err) {
      const msg = err?.response?.data?.error
        || (err?.isRateLimited ? t('support.errRateLimit', 'Too many tickets — try again in an hour, or email hello@reviewhub.review.') : null)
        || t('support.errGeneric', 'Could not submit. Email hello@reviewhub.review directly if this keeps happening.');
      setError(msg);
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="rh-design rh-app min-h-screen" style={{ background: 'var(--rh-paper)' }}>
        <MarketingNav />
        <main className="max-w-2xl mx-auto px-6 py-24 text-center">
          <div
            className="inline-flex items-center justify-center mb-8"
            style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--rh-teal-deep)' }}
            aria-hidden="true"
          >
            <span style={{ color: 'var(--rh-paper)', fontSize: 28 }}>✓</span>
          </div>
          <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--rh-ink)', letterSpacing: '-0.02em' }}>
            {isThai ? 'รับเรื่องแล้ว' : "Got it. We'll get back to you."}
          </h1>
          <p className="text-lg leading-relaxed mb-2" style={{ color: 'var(--rh-ink-soft, #4a525a)' }}>
            {isThai
              ? 'เราจะตอบกลับภายใน 24 ชั่วโมง (วันธรรมดา) ทางอีเมล'
              : "We reply within 24 hours on weekdays. Watch your inbox at "}
            {!isThai && <strong style={{ color: 'var(--rh-ink)' }}>{form.email}</strong>}
            {!isThai && '.'}
          </p>
          {ticketId != null && (
            <p className="text-sm mt-4" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
              {isThai ? 'หมายเลขเรื่อง: #' : 'Ticket reference: #'}
              <strong>{ticketId}</strong>
            </p>
          )}
          {/* Spam-folder hint — same friction surfaced in batch 2 personas:
              founder reply lands in Promotions/Junk on first delivery and
              users assume nobody answered. */}
          <p className="text-xs mt-3" style={{ color: 'var(--rh-ink-soft, #9aa3ac)' }}>
            {isThai
              ? 'ถ้าไม่เห็นภายในไม่กี่นาที ลองดูในโฟลเดอร์สแปม / โปรโมชั่นด้วยนะ'
              : 'If you don\'t see it within a few minutes, check your spam / promotions folder.'}
          </p>
          <Link
            to="/"
            className="inline-block mt-8 px-6 py-3 rounded-xl font-semibold"
            style={{ background: 'var(--rh-teal-deep)', color: 'var(--rh-paper)' }}
          >
            {isThai ? 'กลับสู่หน้าหลัก' : 'Back to home'}
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="rh-design rh-app min-h-screen" style={{ background: 'var(--rh-paper)' }}>
      <MarketingNav />
      <main className="max-w-2xl mx-auto px-6 py-16">
        <div className="mb-10">
          <h1 className="text-4xl font-bold mb-3" style={{ color: 'var(--rh-ink)', letterSpacing: '-0.02em' }}>
            {isThai ? 'ติดปัญหา? บอกเราหน่อย' : 'Something broken? Tell us.'}
          </h1>
          <p className="text-base leading-relaxed" style={{ color: 'var(--rh-ink-soft, #4a525a)' }}>
            {isThai
              ? 'บั๊ก คำถามเรื่องบิล หรือเรื่องบัญชี — ส่งมาที่นี่ ตอบกลับใน 24 ชม.'
              : "Bugs, billing questions, account issues — send them here. We reply within 24 hours."}
            {' '}
            {isThai
              ? 'อยากเสนอฟีเจอร์ใหม่? ใช้ปุ่ม Feedback มุมขวาล่างก็ได้'
              : 'Got a feature idea instead? The Feedback widget in the bottom-right is for that.'}
          </p>
        </div>

        <div className="rounded-2xl p-6 md:p-8" style={{ background: '#fff', border: '1px solid var(--rh-line, #e6dfce)' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="category" className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--rh-ink)' }}>
                {isThai ? 'ประเภท' : 'What kind of issue?'}
              </label>
              <select
                id="category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
                style={{ borderColor: 'var(--rh-line)', background: 'var(--rh-paper)' }}
                required
                aria-required="true"
              >
                <option value="bug">{isThai ? 'บั๊ก / สิ่งที่พังแล้ว' : 'Bug / something is broken'}</option>
                <option value="billing">{isThai ? 'บิล / การชำระเงิน' : 'Billing / payment'}</option>
                <option value="account">{isThai ? 'บัญชี / ลบบัญชี / รหัสผ่าน' : 'Account / delete / password'}</option>
                <option value="feature">{isThai ? 'ฟีเจอร์ที่อยากได้' : 'Feature request'}</option>
                <option value="other">{isThai ? 'อื่นๆ' : 'Other'}</option>
              </select>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--rh-ink)' }}>
                {isThai ? 'อีเมลของคุณ' : 'Your email'}
                {user?.email && (
                  <span className="ml-2 text-xs font-normal" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
                    ({isThai ? 'จากบัญชีคุณ' : 'from your account'})
                  </span>
                )}
              </label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
                style={{ borderColor: 'var(--rh-line)', background: 'var(--rh-paper)' }}
                required
                aria-required="true"
                autoComplete="email"
                inputMode="email"
                maxLength={254}
              />
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--rh-ink)' }}>
                {isThai ? 'หัวเรื่องสั้นๆ' : 'Short subject'}
              </label>
              <input
                id="subject"
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder={isThai ? 'เช่น "ตอนกดสมัครเด้งหน้าเปล่า"' : 'e.g. "Checkout page is blank after I enter my card"'}
                className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
                style={{ borderColor: 'var(--rh-line)', background: 'var(--rh-paper)' }}
                required
                aria-required="true"
                maxLength={200}
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--rh-ink)' }}>
                {isThai ? 'เล่ารายละเอียด' : 'What happened?'}
              </label>
              <textarea
                id="message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder={isThai
                  ? 'เกิดอะไรขึ้น? ทำอะไรอยู่ตอนนั้น? เห็นข้อความ error อะไรมั้ย?'
                  : 'What happened? What were you trying to do? Any error message you saw?'}
                rows={6}
                className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
                style={{ borderColor: 'var(--rh-line)', background: 'var(--rh-paper)' }}
                required
                aria-required="true"
                maxLength={10000}
              />
              <p className="text-xs mt-1.5" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
                {isThai
                  ? 'ใส่รายละเอียดได้เต็มที่ — ยิ่งเยอะยิ่งช่วยให้แก้ได้ตรงจุด'
                  : 'More detail = faster fix. Include browser, what you clicked, what you expected vs what you got.'}
              </p>
            </div>

            <HoneypotField value={honeypot} onChange={setHoneypot} />

            {error && (
              <div
                className="px-4 py-3 rounded-lg text-sm"
                style={{ background: 'rgba(184,84,80,0.08)', color: 'var(--rh-rose, #b85450)', border: '1px solid rgba(184,84,80,0.2)' }}
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full py-4 rounded-xl font-bold text-base transition-opacity"
              style={{
                background: 'var(--rh-teal-deep)',
                color: 'var(--rh-paper)',
                opacity: status === 'submitting' ? 0.6 : 1,
                cursor: status === 'submitting' ? 'wait' : 'pointer',
              }}
            >
              {status === 'submitting'
                ? (isThai ? 'กำลังส่ง…' : 'Sending…')
                : (isThai ? 'ส่งเรื่อง →' : 'Send →')}
            </button>

            <p className="text-xs text-center" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
              {isThai
                ? 'หรือเขียนตรงไป hello@reviewhub.review'
                : 'Or email hello@reviewhub.review directly.'}
            </p>
          </form>
        </div>

        {/* Ticket history — logged-in users see their past tickets +
            status. Closes the "did anyone see this?" loop persona testers
            kept hitting. Hidden when logged out. */}
        {user && myTickets && myTickets.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--rh-ink)', letterSpacing: '-0.01em' }}>
              {isThai ? 'เรื่องที่คุณส่งมา' : 'Your past tickets'}
            </h2>
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid var(--rh-line, #e6dfce)' }}>
              <ul className="divide-y" style={{ borderColor: 'var(--rh-line, #e6dfce)' }}>
                {myTickets.map(t => {
                  const status = t.resolved_at
                    ? (isThai ? 'แก้ไขแล้ว' : 'Resolved')
                    : (t.status === 'open' || !t.status
                        ? (isThai ? 'รอตอบกลับ' : 'Open')
                        : t.status);
                  const statusCls = t.resolved_at
                    ? { background: '#e7f3ec', color: '#1d6f3a' }
                    : { background: '#fff4d6', color: '#7a5300' };
                  return (
                    <li key={t.id} className="p-4 flex items-start gap-3">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5"
                        style={statusCls}
                      >
                        {status}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--rh-ink)' }}>
                          #{t.id} · {t.subject}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
                          {t.category.toUpperCase()} ·{' '}
                          {new Date(t.created_at).toLocaleDateString(lang)}
                          {t.resolved_at && (
                            <> · {isThai ? 'แก้ไขเมื่อ' : 'Resolved'} {new Date(t.resolved_at).toLocaleDateString(lang)}</>
                          )}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--rh-ink-soft, #9aa3ac)' }}>
              {isThai
                ? 'รายละเอียดและการตอบกลับอยู่ในอีเมลของคุณ'
                : 'Full conversation and replies are in your email.'}
            </p>
          </div>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}
