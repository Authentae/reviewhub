import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { RhThemeToggle, RhLangPicker } from './MarketingNav';
import Logo from './Logo';
import '../styles/design-system.css';

// Marketing-side panel shown next to the Login/Register/Forgot/Reset forms on
// lg+ screens. Uses the editorial v2 aesthetic — cream paper, giant italic
// ampersand, ochre coordinates marker, sage LIVE ping — so auth flows feel
// like the same brand as the Landing page. Hidden on mobile.
export default function AuthSideArt({ eyebrow, title }) {
  const { t } = useI18n();
  return (
    <aside className="hidden lg:flex rh-design rh-auth-aside">
      <div className="rh-hero-bg" />
      <div className="rh-hero-grid" />
      <div className="rh-hero-vignette" />
      <div className="rh-hero-amp">&amp;</div>
      <div className="rh-hero-coords">
        <span className="cx">N 13°44′</span>
        <span className="cy">E 100°31′</span>
        <span className="cn">SUKHUMVIT · BKK</span>
      </div>

      <div className="rh-auth-aside-inner">
        {/* Brand + controls row */}
        <div className="rh-auth-top">
          <Link to="/" className="rh-brand">
            <Logo size={30} />
            <div className="wm">Review<em>Hub</em></div>
          </Link>
          <div className="rh-auth-controls">
            <Link to="/tools/review-reply-generator" className="rh-nav-tool">{t('nav.freeTool', 'Free tool')}</Link>
            <RhLangPicker />
            <RhThemeToggle />
          </div>
        </div>

        {/* Headline */}
        <div className="rh-auth-headline">
          {eyebrow && <p className="rh-auth-eyebrow">{eyebrow}</p>}
          <h2 className="rh-auth-title">{title}</h2>

          {/* Editorial pull quote */}
          <figure className="rh-auth-quote">
            <div className="rh-stars" aria-label="5 of 5 stars">
              {[1, 2, 3, 4, 5].map((i) => (
                <svg key={i} width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 1.5l2 4.4 4.8.4-3.7 3.2 1.1 4.7L8 11.8 3.8 14.2l1.1-4.7L1.2 6.3l4.8-.4L8 1.5z" />
                </svg>
              ))}
            </div>
            <blockquote>"{t('landing.testimonial1')}"</blockquote>
            <figcaption>
              <span className="portrait">{t('landing.testimonialInitial', 'M')}</span>
              <span>
                <b>{t('landing.testimonialAuthor', 'Maria S.')}</b>
                <span className="biz">{t('landing.testimonialBiz', 'Downtown Café')}</span>
              </span>
            </figcaption>
          </figure>

          {/* Platform chips — Google syncs automatically; the rest are tracked
              via CSV import or manual entry today (which the platform registry
              covers across 25+ identifiers). Chip opacity reflects auto-sync vs
              manual; screen readers get the explicit hint. */}
          <p className="rh-mono rh-auth-plat-label">{t('landing.platformsLabel')}</p>
          <div className="rh-auth-platforms">
            {[
              { name: 'Google', live: true },
              { name: 'Yelp', live: false },
              { name: 'Facebook', live: false },
              { name: 'TripAdvisor', live: false },
              { name: 'Wongnai', live: false },
              { name: 'Tabelog', live: false },
              { name: 'Naver', live: false },
            ].map(({ name, live }) => (
              <span key={name} style={live ? undefined : { opacity: 0.7 }}
                aria-label={live ? name : `${name} — ${t('marquee.manualImport', 'Manual / CSV')}`}>
                {name}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom meta */}
        <div className="rh-auth-foot">
          <span className="rh-nav-ping"><span className="ping-dot" />LIVE</span>
          <span>{t('landing.heroNote')}</span>
        </div>
      </div>
    </aside>
  );
}
