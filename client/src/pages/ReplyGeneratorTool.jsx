import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import usePageTitle from '../hooks/usePageTitle';
import MarketingNav from '../components/MarketingNav';
import { useI18n } from '../context/I18nContext';

// Free, no-signup AI review-reply generator.
//
// This page is the SEO/PLG hero asset:
//   - Ranks for "ai review reply generator" / "review response generator"
//   - No login required → low-friction first taste of the product
//   - CTA below the result → "sign up free to use this inside a Chrome
//     extension that works on every platform"
//
// The server enforces 20 drafts/hour/IP (see publicWidget.js). When the
// user hits the limit or wants more, the conversion path is "sign up free."

// Brand names stay English; only the catch-all 'other' is translatable.
const PLATFORM_LABELS = {
  google: 'Google',
  yelp: 'Yelp',
  facebook: 'Facebook',
  tripadvisor: 'TripAdvisor',
  trustpilot: 'Trustpilot',
  amazon: 'Amazon',
  etsy: 'Etsy',
};
const PLATFORM_VALUES = ['google', 'yelp', 'facebook', 'tripadvisor', 'trustpilot', 'amazon', 'etsy', 'other'];

// Sample reviews for the "try with example" loaders. One negative + one
// positive lets visitors see the AI's tone shift in two clicks, which is the
// fastest demo of "this thing actually understands the review."
//
// Thai locale gets Thai-language samples so a Thai SMB owner clicking the
// "1-star sample" button sees a review that sounds like one they'd actually
// receive — not an English template they have to mentally translate.
const SAMPLES_EN = {
  negative: {
    reviewer_name: 'Marcus T.',
    rating: 1,
    platform: 'google',
    business_name: 'Corner Bistro',
    review_text: "Waited 45 minutes for a simple sandwich. Staff seemed disorganized and didn't even apologize for the wait. The sandwich itself was mediocre. Will not be returning.",
  },
  positive: {
    reviewer_name: 'Emily K.',
    rating: 5,
    platform: 'google',
    business_name: 'Corner Bistro',
    review_text: 'Absolutely love this place! The staff is incredibly friendly and the food is always fresh. Best lunch spot in the neighborhood.',
  },
};
const SAMPLES_TH = {
  negative: {
    reviewer_name: 'สมชาย ก.',
    rating: 1,
    platform: 'google',
    business_name: 'ร้านกาแฟริมทาง',
    review_text: 'รอแซนวิช 45 นาที พนักงานดูยุ่งวุ่นวายไม่ขอโทษเรื่องเวลา ตัวแซนวิชก็ธรรมดามาก จะไม่กลับมาอีก',
  },
  positive: {
    reviewer_name: 'พลอย ส.',
    rating: 5,
    platform: 'google',
    business_name: 'ร้านกาแฟริมทาง',
    review_text: 'ชอบร้านนี้มาก พนักงานเป็นมิตรสุดๆ อาหารสดใหม่ตลอด ที่กินกลางวันที่ดีที่สุดในย่านนี้',
  },
};

export default function ReplyGeneratorTool() {
  const { t, lang } = useI18n();
  const SAMPLES = lang === 'th' ? SAMPLES_TH : SAMPLES_EN;
  usePageTitle(t('page.tool', 'Free AI Review Reply Generator'));

  // Inject HowTo + WebApplication structured data so Google can show this
  // page as a rich result for queries like "how to reply to google review"
  // or "review reply generator". The script is injected into <head> and
  // cleaned up on unmount so the schema only applies to this route.
  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebApplication',
          'name': 'ReviewHub Free Reply Generator',
          'url': 'https://reviewhub.review/tools/review-reply-generator',
          'applicationCategory': 'BusinessApplication',
          'operatingSystem': 'Web',
          'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'USD' },
          'description': 'Free AI tool that drafts professional replies to Google, Yelp, Facebook, TripAdvisor and Trustpilot reviews in seconds. No signup required.',
        },
        {
          '@type': 'HowTo',
          'name': 'How to draft a professional reply to a customer review',
          'description': 'Use AI to generate a context-aware response to any online review in 10 seconds.',
          'totalTime': 'PT10S',
          'step': [
            { '@type': 'HowToStep', 'position': 1, 'name': 'Paste the review', 'text': 'Copy the review text from Google, Yelp, Facebook, TripAdvisor or Trustpilot and paste it into the form.' },
            { '@type': 'HowToStep', 'position': 2, 'name': 'Pick rating + platform', 'text': 'Select the star rating and which platform the review is on. Optionally enter the reviewer name and your business name for a personalized reply.' },
            { '@type': 'HowToStep', 'position': 3, 'name': 'Generate reply', 'text': 'Click Generate. AI (Claude by Anthropic) drafts a tone-matched reply in 10 seconds.' },
            { '@type': 'HowToStep', 'position': 4, 'name': 'Copy + paste', 'text': 'Edit if you want, then copy the draft and paste it as your reply on the original review platform.' },
          ],
        },
      ],
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.textContent = JSON.stringify(schema);
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, []);

  const [form, setForm] = useState({
    reviewer_name: '',
    rating: 3,
    review_text: '',
    business_name: '',
    platform: 'google',
  });
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setDraft(null);
    if (!form.review_text.trim()) {
      setError(t('tool.errorEmpty', 'Please paste the review you want to respond to.'));
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/public/review-reply-generator', form);
      setDraft(data.draft);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 429) {
        setError(err.response?.data?.error || t('tool.errorRateLimit', 'Free tool rate limit reached. Sign up for unlimited drafts.'));
      } else {
        setError(err?.response?.data?.error || t('tool.errorGeneric', 'Something went wrong. Try again in a moment.'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  }

  return (
    <div className="rh-design rh-tool-page min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-[color:var(--rh-paper)] focus:text-[color:var(--rh-teal)] focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>
      <MarketingNav />
      <main id="main-content" className="rh-shell" style={{ padding: '64px 48px 80px', maxWidth: 880 }}>

        {/* SEO hero — editorial treatment matching Landing v2 */}
        <div className="rh-tool-hero">
          <p className="rh-mono" style={{ marginBottom: 12, color: 'var(--rh-ochre-deep)' }}>{t('tool.eyebrow', 'FREE TOOL · NO SIGNUP')}</p>
          <div className="rh-section-head" style={{ marginBottom: 24 }}>
            <div className="kicker">
              <div className="num" style={{ color: 'var(--rh-ochre-deep)' }}>00</div>
              <div className="cat">§ {t('tool.kicker', 'Free tool · No signup')}</div>
            </div>
            <h1 style={{ fontFamily: 'var(--rh-serif)', fontWeight: 400, fontSize: 'clamp(40px, 5.6vw, 72px)', lineHeight: 1.0, letterSpacing: '-0.025em', margin: 0 }}>
              {t('tool.title', 'AI review reply generator.')}
            </h1>
          </div>
          <p className="rh-lede" style={{ maxWidth: '60ch' }}>
            {t('tool.lede', 'Paste a Google, Yelp, Facebook, TripAdvisor, or Trustpilot review. Get a professional, context-aware reply in 10 seconds. Powered by Claude.')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rg-reviewer" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                {t('tool.reviewerName', 'Reviewer name')} <span className="text-gray-400 text-xs">({t('common.optional', 'optional')})</span>
              </label>
              <input
                id="rg-reviewer" type="text" className="input"
                value={form.reviewer_name} maxLength={100}
                onChange={(e) => setForm(f => ({ ...f, reviewer_name: e.target.value }))}
                placeholder="Alice"
              />
            </div>
            <div>
              <label htmlFor="rg-business" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                {t('tool.businessName', 'Your business name')} <span className="text-gray-400 text-xs">({t('common.optional', 'optional')})</span>
              </label>
              <input
                id="rg-business" type="text" className="input"
                value={form.business_name} maxLength={100}
                onChange={(e) => setForm(f => ({ ...f, business_name: e.target.value }))}
                placeholder="Sakura Coffee"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rg-platform" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                {t('tool.platform', 'Platform')}
              </label>
              <select
                id="rg-platform" className="input"
                value={form.platform}
                onChange={(e) => setForm(f => ({ ...f, platform: e.target.value }))}
              >
                {PLATFORM_VALUES.map(v => (
                  <option key={v} value={v}>
                    {v === 'other' ? t('tool.platformOther', 'Other') : PLATFORM_LABELS[v]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rg-rating" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                {t('tool.rating', 'Rating')}
              </label>
              <select
                id="rg-rating" className="input"
                value={form.rating}
                onChange={(e) => setForm(f => ({ ...f, rating: Number(e.target.value) }))}
              >
                {[5, 4, 3, 2, 1].map(n => (
                  <option key={n} value={n}>{'★'.repeat(n) + '☆'.repeat(5 - n)} ({n} stars)</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
              <label htmlFor="rg-text" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('tool.reviewText', 'Review text')} <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400 dark:text-gray-500">{t('tool.noReview', 'No review handy? Try:')}</span>
                <button
                  type="button"
                  onClick={() => { setForm(SAMPLES.negative); setDraft(null); setError(''); }}
                  className="hover:underline font-medium"
                  style={{ color: 'var(--rh-teal)' }}
                >
                  {t('tool.sample1Star', '★ 1-star sample')}
                </button>
                <span style={{ color: 'var(--rh-ink-soft, #999)' }}>·</span>
                <button
                  type="button"
                  onClick={() => { setForm(SAMPLES.positive); setDraft(null); setError(''); }}
                  className="hover:underline font-medium"
                  style={{ color: 'var(--rh-teal)' }}
                >
                  {t('tool.sample5Star', '★★★★★ 5-star sample')}
                </button>
              </div>
            </div>
            <textarea
              id="rg-text" className="input resize-none"
              rows={5} maxLength={2000}
              value={form.review_text}
              onChange={(e) => setForm(f => ({ ...f, review_text: e.target.value }))}
              placeholder={t('tool.placeholder', 'Paste the review here…')}
              required
            />
            <p className={`text-xs mt-1 ${form.review_text.length > 1900 ? 'text-red-500' : form.review_text.length > 1500 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
              {form.review_text.length}/2000
            </p>
          </div>

          {error && (
            <div role="alert" className="text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading} aria-busy={loading}
            className="btn-primary w-full text-base py-3.5 disabled:opacity-60"
          >
            {loading ? t('tool.drafting', 'Drafting…') : t('tool.generate', '✨ Generate reply in 10 seconds')}
          </button>
        </form>

        {draft && (
          <section aria-labelledby="rg-result" className="mt-6 card p-6">
            <h2 id="rg-result" className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">
              {t('tool.resultTitle', 'Your drafted reply')}
            </h2>
            <textarea
              className="input resize-none mb-3"
              rows={6}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={t('tool.resultAria', 'Drafted reply (editable)')}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={handleCopy} className="btn-primary text-sm">
                {copied ? t('tool.copied', 'Copied ✓') : t('tool.copyReply', 'Copy reply')}
              </button>
              <button type="button" onClick={() => { setDraft(null); setForm(f => ({ ...f, review_text: '' })); }} className="btn-secondary text-sm">
                {t('tool.draftAnother', 'Draft another')}
              </button>
            </div>
            {/* Inline conversion ask — shown right at the magic moment so
                users don't have to scroll past 600+ pixels of SEO content
                before they're invited to use this on their own reviews. */}
            <p className="mt-4 text-xs border-t pt-3" style={{ color: 'var(--rh-ink)', opacity: 0.7, borderColor: 'var(--rh-rule, rgba(0,0,0,0.1))' }}>
              {t('tool.likeThisLead', 'Like this?')} <Link
                to="/register"
                className="font-medium hover:underline"
                style={{ color: 'var(--rh-teal)' }}
              >{t('tool.likeThisCta', 'Sign up free')}</Link> {t('tool.likeThisAfter', "— connect your Google Business once and we'll draft replies for every new review. Free forever.")}
            </p>
          </section>
        )}

        {/* Conversion block — always visible, not just on result */}
        <aside className="mt-10 card p-6" style={{ background: 'var(--rh-paper)', borderColor: 'var(--rh-teal)', borderWidth: 1, borderStyle: 'solid' }}>
          <p className="rh-mono" style={{ marginBottom: 8, color: 'var(--rh-teal)' }}>UPGRADE</p>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--rh-ink)', fontFamily: 'var(--rh-serif)', fontWeight: 500 }}>
            Want a draft for every Google review automatically?
          </h2>
          <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--rh-ink)', opacity: 0.85 }}>
            Sign up free, connect your Google Business once, and ReviewHub
            drafts a reply for every new review — in your voice, in Thai or
            English. You read it, tap copy, paste on Google. Free plan forever,
            no credit card. Yelp, Facebook, and more platforms coming soon.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Link to="/register" className="btn-primary text-sm">
              Sign up free (no card needed)
            </Link>
            <Link to="/pricing" className="btn-secondary text-sm">
              See pricing
            </Link>
          </div>
        </aside>

        {/* SEO content — helps the page rank for long-tail review-reply queries */}
        <section aria-label={t('tool.seo.aria', 'How the AI review reply generator works')} className="mt-10 prose prose-sm max-w-none" style={{ color: 'var(--rh-ink)' }}>
          <p className="rh-mono" style={{ marginBottom: 8, color: 'var(--rh-sage)' }}>{t('tool.seo.eyebrow', 'HOW IT WORKS')}</p>
          <h2 className="text-lg mt-0" style={{ color: 'var(--rh-ink)', fontFamily: 'var(--rh-serif)', fontWeight: 500 }}>
            {t('tool.seo.title', 'How the AI review reply generator works')}
          </h2>
          <p>
            {t('tool.seo.howIntro', "Paste a customer review above. Our AI (powered by Claude from Anthropic) reads the review text, understands whether it's positive, neutral, or negative, and drafts a professional reply that matches the tone. The draft is editable — make it sound more like you, then copy and paste into the review platform.")}
          </p>
          <h3 className="font-semibold" style={{ color: 'var(--rh-ink)', fontFamily: 'var(--rh-serif)' }}>{t('tool.seo.whyTitle', 'Why respond to online reviews?')}</h3>
          <ul>
            <li>{t('tool.seo.why1', 'Replies are visible to every future customer who reads the review — a good one turns a complaint into social proof of your responsiveness.')}</li>
            <li>{t('tool.seo.why2', "Google, Yelp, and TripAdvisor's algorithms favor businesses that engage with reviews — responding can lift your ranking.")}</li>
            <li>{t('tool.seo.why3', 'Customers who get a thoughtful reply after a negative review frequently update their rating or delete the review.')}</li>
          </ul>
          <h3 className="font-semibold" style={{ color: 'var(--rh-ink)', fontFamily: 'var(--rh-serif)' }}>{t('tool.seo.freeTitle', 'Is this free?')}</h3>
          <p>
            {t('tool.seo.freeBody', 'Yes. This tool is free with no signup. We rate-limit to 20 drafts per hour per IP to keep the service available for everyone. If you need more, the free ReviewHub account gives you 3 AI drafts per month from your dashboard, and paid plans give unlimited.')}
          </p>
        </section>
      </main>
    </div>
  );
}
