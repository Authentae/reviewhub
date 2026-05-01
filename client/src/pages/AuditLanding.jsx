import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import usePageTitle from '../hooks/usePageTitle';
import MarketingNav from '../components/MarketingNav';
import HoneypotField from '../components/HoneypotField';
import { useI18n } from '../context/I18nContext';

// /audit — cold-outreach lead-capture landing.
//
// Funnel:
//   1. Founder DMs / cold-emails Bangkok restaurant owners with the link
//   2. Owner submits Google Business URL + email
//   3. Server emails the founder; founder hand-crafts a 10-reply audit (PDF or
//      email) and replies within 24h
//   4. Audit ends with "want this automated forever? start free trial"
//
// Why no automatic generation: at this volume, a human founder writing the
// audit produces a much higher-converting artifact than a generic AI dump.
// When volume > 10 leads/day, swap the human step for a server-side job.
export default function AuditLanding() {
  const { t, lang } = useI18n();
  usePageTitle(t('audit.title', 'Free 10-reply review audit · ReviewHub'));

  const [form, setForm] = useState({ businessName: '', businessUrl: '', email: '', notes: '' });
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [error, setError] = useState('');

  // Inject simple structured data for SEO.
  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      'serviceType': 'Free review-reply audit',
      'provider': { '@type': 'Organization', 'name': 'ReviewHub', 'url': 'https://reviewhub.review' },
      'description': 'Free expert audit of 10 recent reviews on your Google Business profile, with AI-drafted replies you can copy and paste.',
      'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'USD' },
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.textContent = JSON.stringify(schema);
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.businessName.trim() || !form.businessUrl.trim() || !form.email.trim()) {
      setError(t('audit.errMissing', 'Please fill in every field.'));
      return;
    }
    setStatus('submitting');
    try {
      await api.post('/public/audit-request', { ...form, website: honeypot });
      setStatus('success');
    } catch (err) {
      const msg = err?.response?.data?.error || t('audit.errGeneric', 'Could not send. Please try again or email hello@reviewhub.review.');
      setError(msg);
      setStatus('error');
    }
  }

  const isThai = lang === 'th';

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
            <span style={{ color: 'var(--rh-paper)', fontSize: 28 }}>✦</span>
          </div>
          <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--rh-ink)', letterSpacing: '-0.02em' }}>
            {isThai ? 'ได้รับคำขอแล้ว' : 'Got it. Audit on the way.'}
          </h1>
          <p className="text-lg leading-relaxed mb-8" style={{ color: 'var(--rh-ink-soft, #4a525a)' }}>
            {isThai
              ? 'เราจะส่งรายงานพร้อมร่างคำตอบ AI 10 ฉบับให้คุณภายใน 24 ชั่วโมง ตรวจกล่องจดหมาย (และโฟลเดอร์ Spam)'
              : "We'll send your personalized audit + 10 AI-drafted replies within 24 hours. Check your inbox (and spam folder, just in case)."}
          </p>
          <Link
            to="/"
            className="inline-block px-6 py-3 rounded-xl font-semibold"
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
      <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <div className="text-center mb-12">
          <div
            className="inline-block px-3 py-1 mb-6 text-xs font-bold uppercase tracking-widest rounded-full"
            style={{ background: 'rgba(196,138,44,0.12)', color: 'var(--rh-ochre, #c48a2c)' }}
          >
            {isThai ? 'ฟรี · จำกัด 20 ร้านต่อสัปดาห์' : 'Free · 20 audits per week'}
          </div>
          <h1
            className="text-4xl md:text-5xl font-bold mb-6 leading-tight"
            style={{ color: 'var(--rh-ink)', letterSpacing: '-0.02em' }}
          >
            {isThai
              ? 'รับร่างคำตอบรีวิวฟรี 10 ฉบับ คัดสำหรับร้านคุณโดยเฉพาะ'
              : 'Get 10 expert review replies, hand-crafted for your business. Free.'}
          </h1>
          <p
            className="text-lg md:text-xl leading-relaxed max-w-2xl mx-auto"
            style={{ color: 'var(--rh-ink-soft, #4a525a)' }}
          >
            {isThai
              ? 'ส่ง URL ร้านคุณบน Google เราจะอ่านรีวิว 10 รายการล่าสุด แล้วส่งคำตอบที่เหมาะกับโทนของแต่ละลูกค้า — กลับไปคัดลอก-วางได้เลย'
              : "Drop your Google Business URL. We'll read your 10 most recent reviews and send back tone-matched replies you can copy and paste — no signup, no credit card."}
          </p>
        </div>

        <div
          className="rounded-2xl p-6 md:p-10 shadow-sm"
          style={{ background: '#fff', border: '1px solid var(--rh-line, #e6dfce)' }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="businessName" className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--rh-ink)' }}>
                {isThai ? 'ชื่อร้าน' : 'Business name'}
              </label>
              <input
                id="businessName"
                type="text"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                placeholder={isThai ? 'เช่น ร้านกาแฟริมทาง' : 'e.g. Corner Bistro Bangkok'}
                className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
                style={{ borderColor: 'var(--rh-line)', background: 'var(--rh-paper)' }}
                required
                maxLength={200}
              />
            </div>

            <div>
              <label htmlFor="businessUrl" className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--rh-ink)' }}>
                {isThai ? 'URL ร้านบน Google (หรือแพลตฟอร์มรีวิวอื่น)' : 'Google Business URL (or any review-platform link)'}
              </label>
              <input
                id="businessUrl"
                type="url"
                value={form.businessUrl}
                onChange={(e) => setForm({ ...form, businessUrl: e.target.value })}
                placeholder="https://maps.google.com/?cid=..."
                className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
                style={{ borderColor: 'var(--rh-line)', background: 'var(--rh-paper)' }}
                required
                maxLength={1000}
              />
              <p className="text-xs mt-1.5" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
                {isThai
                  ? 'ค้นชื่อร้านบน Google → คลิกแชร์ → คัดลอกลิงก์'
                  : 'Search your business on Google Maps → tap Share → copy the link.'}
              </p>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--rh-ink)' }}>
                {isThai ? 'อีเมลของคุณ' : 'Your email'}
              </label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder={isThai ? 'เราจะส่งรายงานไปที่นี่' : "We'll send the audit here"}
                className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
                style={{ borderColor: 'var(--rh-line)', background: 'var(--rh-paper)' }}
                required
                maxLength={254}
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--rh-ink)' }}>
                {isThai ? 'อยากเล่าอะไรเกี่ยวกับร้าน? (ไม่บังคับ)' : 'Anything we should know about your business? (optional)'}
              </label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={isThai ? 'เช่น โทนการสื่อสารที่ต้องการ ร้านไหนคู่แข่ง ฯลฯ' : 'Tone preferences, common pain points, what makes you different...'}
                rows={3}
                className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
                style={{ borderColor: 'var(--rh-line)', background: 'var(--rh-paper)' }}
                maxLength={2000}
              />
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
                : (isThai ? 'ขอรับรายงานฟรี →' : 'Send my free audit →')}
            </button>

            <p className="text-xs text-center" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
              {isThai
                ? 'ไม่มีบัตรเครดิต ไม่มีสมัครสมาชิก ส่งภายใน 24 ชั่วโมง'
                : 'No credit card. No signup. Delivered within 24 hours.'}
            </p>
          </form>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-3xl font-bold mb-2" style={{ color: 'var(--rh-teal-deep)' }}>10</div>
            <div className="text-sm" style={{ color: 'var(--rh-ink-soft, #4a525a)' }}>
              {isThai ? 'ร่างคำตอบที่เขียนเฉพาะร้านคุณ' : 'replies hand-crafted for your business'}
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold mb-2" style={{ color: 'var(--rh-ochre, #c48a2c)' }}>24h</div>
            <div className="text-sm" style={{ color: 'var(--rh-ink-soft, #4a525a)' }}>
              {isThai ? 'จัดส่งภายใน 24 ชั่วโมง' : 'delivered to your inbox'}
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold mb-2" style={{ color: 'var(--rh-sage, #7a9b78)' }}>0฿</div>
            <div className="text-sm" style={{ color: 'var(--rh-ink-soft, #4a525a)' }}>
              {isThai ? 'ฟรี ไม่มีเงื่อนไข' : 'no strings attached'}
            </div>
          </div>
        </div>

        <div className="mt-12 text-center text-sm" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
          {isThai ? 'อยากตอบรีวิวอัตโนมัติทุกวันเลยมั้ย? ' : 'Want this automated forever? '}
          <Link to="/pricing" style={{ color: 'var(--rh-teal-deep)', fontWeight: 600 }}>
            {isThai ? 'ดูแพ็กเกจ' : 'See pricing'}
          </Link>
        </div>
      </main>
    </div>
  );
}
