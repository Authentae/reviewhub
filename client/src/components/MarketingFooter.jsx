// Site-wide footer for marketing pages.
//
// Why: every marketing page had only 3-5 internal links. PageRank-distribution
// signal to Google was thin, and human visitors who finished reading one page
// had no clear "where do I go next" except the back button. This footer adds
// 26 internal links to every marketing page, organized by intent.
//
// Sections (each capped at ≤8 links per overnight queue item 9, 2026-05-20,
// to avoid bloat):
//   - Product (audit funnel, pricing, guide, integrations, 4 free tools)
//   - By industry (2 vertical SEO landing pages)
//   - Resources (blog index + 5 featured posts + changelog + RSS)
//   - Company (why-us, about, support, trust, 4 legal pages)
//
// Visual: minimal editorial — matches the rest of the site (paper bg, hairline
// rule, mono section-headers, sans body links). NOT a "huge dark footer" —
// stays consistent with the brand's calm restraint.

import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';

export default function MarketingFooter() {
  const { lang } = useI18n();
  const isThai = lang === 'th';

  // Hand-curated link groups. When a new marketing surface ships, add it here.
  const groups = [
    {
      heading: isThai ? 'สินค้า' : 'Product',
      // "Home" intentionally NOT here — the wordmark in the bottom bar
      // already links home. Freeing the slot keeps the group at the
      // ≤8-links-per-group cap (queue item 9, 2026-05-20).
      links: [
        { href: '/audit', label: isThai ? 'Audit ฟรี' : 'Free audit' },
        { href: '/audit-demo', label: isThai ? 'ลองดูตัวอย่าง' : 'See a sample (no signup)' },
        { href: '/pricing', label: isThai ? 'ราคา' : 'Pricing' },
        { href: '/guide', label: isThai ? 'วิธีใช้งาน' : 'How it works' },
        { href: '/integrations', label: isThai ? 'ระบบเชื่อมต่อ' : 'Integrations' },
        { href: '/tools/review-reply-generator', label: isThai ? 'Reply Generator (ฟรี)' : 'Reply Generator (free)' },
        { href: '/tools/reply-roaster', label: isThai ? 'Reply Roaster (ฟรี)' : 'Reply Roaster (free)' },
        { href: '/tools/review-impact', label: isThai ? 'Review Impact (ฟรี)' : 'Review Impact (free)' },
      ],
    },
    {
      heading: isThai ? 'ตามอุตสาหกรรม' : 'By industry',
      links: [
        { href: '/for-spas',        label: isThai ? 'สปา / ซาลอน' : 'Spas & salons' },
        { href: '/for-dentists',    label: isThai ? 'คลินิกทันตกรรม' : 'Dental clinics' },
      ],
    },
    {
      heading: isThai ? 'ทรัพยากร' : 'Resources',
      links: [
        { href: '/blog',                                                       label: isThai ? 'บล็อก' : 'Blog' },
        // Pillar 4 page promoted to slot 2 on 2026-05-20 (commit dde6ff6).
        // It's our wedge-keyword pillar ("AI Google review reply tool") — the
        // broadest SEO surface we own. Every footer-link is a vote in Google's
        // internal-link graph, so we want our highest-leverage page voted
        // hardest. Replaces "How to ask for reviews" which mapped to Pillar 3
        // (deferred per docs/seo-pillar-signoff-2026-05-20.md).
        { href: '/blog/ai-google-review-replies', label: isThai ? 'เครื่องมือ AI ตอบรีวิว' : 'AI review reply tools' },
        { href: isThai ? '/blog/how-fast-should-you-reply-to-google-reviews-th' : '/blog/how-fast-should-you-reply-to-google-reviews', label: isThai ? 'ตอบเร็วแค่ไหนถึงจะดี?' : 'How fast to reply?' },
        { href: isThai ? '/blog/chatgpt-for-google-review-replies-th' : '/blog/chatgpt-for-google-review-replies', label: isThai ? 'ChatGPT vs ReviewHub' : 'ChatGPT vs ReviewHub' },
        { href: isThai ? '/blog/why-respond-to-google-reviews-th' : '/blog/why-respond-to-google-reviews', label: isThai ? 'ทำไมต้องตอบรีวิว' : 'Why respond to reviews' },
        { href: isThai ? '/blog/fake-extortion-google-reviews-th' : '/blog/fake-extortion-google-reviews', label: isThai ? 'รีวิวปลอม / รีดไถ' : 'Fake & extortion reviews' },
        // Removed 2026-05-20 (queue 9): the Bangkok-hospitality post was
        // surfacing as a top-tier blog link in the always-visible footer
        // while the product is globally scoped. Post still lives at /blog
        // and is reachable via the /blog index + search; the footer slot
        // now goes to the more segment-agnostic Changelog/RSS pair.
        { href: '/changelog',                           label: isThai ? 'มีอะไรใหม่' : 'Changelog' },
        { href: '/feed.xml', external: true,            label: 'RSS' },
      ],
    },
    {
      heading: isThai ? 'บริษัท' : 'Company',
      // /about (founder story) + /why-us (product philosophy) sit next to
      // each other — different audiences, both first in the group. Dropped
      // /legal/th-summary 2026-05-20 (queue 9): linked from /terms anyway,
      // and the ≤8-per-group cap had no slot for it once /about landed.
      links: [
        { href: '/why-us',          label: isThai ? 'ทำไมเราถึงสร้างสิ่งนี้' : 'Why we built this' },
        { href: '/about',           label: isThai ? 'เกี่ยวกับเรา' : 'About the founder' },
        { href: '/support',         label: isThai ? 'ติดต่อเรา' : 'Support' },
        { href: '/trust',           label: isThai ? 'ความเป็นส่วนตัวและข้อมูล' : 'Trust & data access' },
        { href: '/terms',           label: isThai ? 'ข้อตกลง' : 'Terms' },
        { href: '/privacy',         label: isThai ? 'นโยบายความเป็นส่วนตัว' : 'Privacy' },
        { href: '/acceptable-use',  label: isThai ? 'การใช้งานที่ยอมรับ' : 'Acceptable use' },
        { href: '/refund-policy',   label: isThai ? 'นโยบายคืนเงิน' : 'Refund policy' },
      ],
    },
  ];

  return (
    <footer
      className="rh-design"
      style={{
        background: 'var(--rh-paper, #fbf8f1)',
        borderTop: '1px solid var(--rh-rule, #e8e3d6)',
        marginTop: 64,
        padding: '48px 24px 32px',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 32,
            marginBottom: 32,
          }}
        >
          {groups.map((group) => (
            <div key={group.heading}>
              <p
                style={{
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                  fontSize: 10,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: 'var(--rh-ink-3, #8b939c)',
                  marginBottom: 12,
                  fontWeight: 700,
                }}
              >
                {group.heading}
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a
                        href={link.href}
                        style={{ fontSize: 13, color: 'var(--rh-ink-2, #4a525a)', textDecoration: 'none' }}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        style={{ fontSize: 13, color: 'var(--rh-ink-2, #4a525a)', textDecoration: 'none' }}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar — wordmark + tagline + copyright */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 24,
            borderTop: '1px solid var(--rh-rule, #e8e3d6)',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <Link
              to="/"
              style={{
                fontFamily: 'Instrument Serif, Georgia, serif',
                fontSize: 22,
                color: 'var(--rh-ink, #1d242c)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Review<em style={{ fontStyle: 'italic' }}>Hub</em>
            </Link>
            <p
              style={{
                fontSize: 12,
                color: 'var(--rh-ink-3, #8b939c)',
                margin: '4px 0 0',
              }}
            >
              {isThai
                ? 'AI ตอบรีวิวใน 10 ภาษา · Bangkok · ตั้งแต่ 2026'
                : 'AI review replies in 10 languages · Bangkok · since 2026'}
            </p>
          </div>
          <p
            style={{
              fontSize: 11,
              color: 'var(--rh-ink-3, #8b939c)',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            }}
          >
            © 2026 ReviewHub
          </p>
        </div>
      </div>
    </footer>
  );
}
