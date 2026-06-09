// Free, no-signup Google Review QR Code generator.
//
// Sibling to /tools/review-request-generator. Turns a business's Google
// review link into a scannable QR code for the counter, receipt, table, or
// treatment room. Uses api.qrserver.com (already allowed in the app CSP
// img-src) to render + download the PNG — no new dependency, no backend.
//
// SEO targets: "google review qr code generator", "qr code for google
// reviews", "review qr code". High commercial intent + on-pivot PLG: the
// page nudges toward automating the ask with ReviewHub for the customers a
// counter QR never reaches.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';
import useSocialMeta from '../hooks/useSocialMeta';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';

function qrUrl(data, size) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(data)}`;
}

export default function ReviewQRCodeTool() {
  const [link, setLink] = useState('');

  usePageTitle('Google Review QR Code Generator — free, no signup');
  useSocialMeta({
    title: 'Free Google Review QR Code Generator',
    description: 'Turn your Google review link into a scannable QR code for the counter, receipt, or table. Free, no signup — paste your link and download the PNG.',
  });

  const trimmed = link.trim();
  const valid = /^https?:\/\/\S+$/i.test(trimmed);
  const preview = qrUrl(valid ? trimmed : 'https://reviewhub.review', 240);
  const download = qrUrl(trimmed, 1000);

  const inputStyle = {
    border: '1px solid var(--rh-rule, #e8dec7)',
    background: 'var(--rh-card, #ffffff)',
    color: 'var(--rh-ink, #1d242c)',
  };

  return (
    <div className="rh-design min-h-screen" style={{ background: 'var(--rh-paper, #fbf8f1)', color: 'var(--rh-ink, #1d242c)' }}>
      <MarketingNav />

      <main className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-[11px] uppercase tracking-[0.15em] mb-3 font-bold" style={{ color: 'var(--rh-teal-deep, #1e4d5e)' }}>
          Free tool · No signup
        </p>
        <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'var(--rh-serif), Georgia, serif', fontWeight: 500 }}>
          Google review QR code generator
        </h1>
        <p className="text-lg leading-relaxed mb-10" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
          Paste your Google review link and get a scannable QR code to put on the
          counter, receipt, table, or treatment-room card. One scan takes a
          customer straight to your review box.
        </p>

        <div className="space-y-5">
          <div>
            <label className="text-sm font-semibold block mb-2">Your Google review link</label>
            <input
              value={link}
              onChange={e => setLink(e.target.value)}
              placeholder="https://g.page/r/...  (your direct review link)"
              className="w-full p-3 rounded-lg outline-none text-sm"
              style={inputStyle}
              inputMode="url"
            />
            <p className="text-xs mt-1.5" style={{ color: 'var(--rh-ink-3, #8b939c)' }}>
              Don't have it yet? <Link to="/blog/how-to-make-a-google-review-qr-code" style={{ color: 'var(--rh-teal-deep, #1e4d5e)', textDecoration: 'underline' }}>How to find your Google review link</Link>.
            </p>
          </div>

          {/* QR preview */}
          <div className="flex flex-col items-center gap-4 p-6 rounded-xl" style={{ border: '1px solid var(--rh-rule, #e8dec7)', background: 'var(--rh-card, #ffffff)' }}>
            <img
              src={preview}
              alt="Your Google review QR code"
              width={240}
              height={240}
              style={{ borderRadius: 8, background: '#fff', opacity: valid ? 1 : 0.4 }}
            />
            {valid ? (
              <a
                href={download}
                download="google-review-qr.png"
                target="_blank"
                rel="noopener"
                className="px-5 py-2.5 rounded-lg font-semibold text-sm"
                style={{ background: 'var(--rh-teal-deep, #1e4d5e)', color: '#fff', textDecoration: 'none' }}
              >
                Download PNG (high-res)
              </a>
            ) : (
              <p className="text-sm" style={{ color: 'var(--rh-ink-3, #8b939c)' }}>Paste a valid link (starting with http) to generate your code.</p>
            )}
          </div>

          <div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--rh-teal-deep, #1e4d5e)' }}>Where to put it</h2>
            <ul className="text-sm space-y-1.5" style={{ color: 'var(--rh-ink-2, #4a525a)', listStyle: 'disc', paddingLeft: 20 }}>
              <li>A standing sign at the counter or checkout.</li>
              <li>Printed on the receipt or the card-machine slip.</li>
              <li>A table tent or sticker (cafes, restaurants, bars).</li>
              <li>The mirror, tray, or aftercare card (clinics, salons, spas).</li>
              <li>Packaging stickers and business cards.</li>
            </ul>
            <p className="text-sm mt-3" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
              Add a line of text next to it — "Scan to leave a Google review — takes 10 seconds" — and pair it with a verbal ask for the best results.
            </p>
          </div>
        </div>

        {/* On-pivot lead-gen nudge */}
        <section
          className="mt-12 rounded-2xl p-7 text-center"
          style={{ background: 'linear-gradient(135deg, var(--rh-teal-deep, #1e4d5e), #2c7889)', color: '#fbf8f1' }}
        >
          <h2 className="text-2xl mb-2" style={{ fontFamily: 'var(--rh-serif), Georgia, serif', fontWeight: 400, color: '#fbf8f1' }}>
            A QR only reaches people in the room
          </h2>
          <p className="mb-5 text-sm" style={{ opacity: 0.92 }}>
            ReviewHub also texts the request to customers after they leave — so you catch everyone the counter QR misses. Free to start, no credit card.
          </p>
          <Link to="/" className="inline-block px-6 py-3 rounded-lg font-semibold text-sm" style={{ background: '#fbf8f1', color: 'var(--rh-teal-deep, #1e4d5e)', textDecoration: 'none' }}>
            See how it works →
          </Link>
        </section>

        <p className="text-sm mt-10" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
          Related:{' '}
          <Link to="/tools/review-request-generator" style={{ color: 'var(--rh-teal-deep, #1e4d5e)', textDecoration: 'underline' }}>Review request generator</Link>
          {' · '}
          <Link to="/blog/how-to-get-more-google-reviews" style={{ color: 'var(--rh-teal-deep, #1e4d5e)', textDecoration: 'underline' }}>How to get more Google reviews</Link>
        </p>
      </main>

      <MarketingFooter />
    </div>
  );
}
