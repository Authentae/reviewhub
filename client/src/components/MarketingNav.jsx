import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';

// Editorial sticky nav for the marketing surfaces (Landing, Pricing, etc).
//
// Props:
//   sections — optional array of {id,label} for section anchors. The sliding
//              ink pill animates under the in-view section as the user scrolls.
//              Pass an empty array on pages with no anchors (e.g. Pricing).
//
// Pulls in the theme + language toggles from existing contexts so users get
// the same controls regardless of which marketing page they land on.
export default function MarketingNav({ sections = [] }) {
  const linksRef = useRef(null);
  const pillRef = useRef(null);
  const [active, setActive] = useState('');

  useEffect(() => {
    if (!sections.length) return;
    const ids = sections.map((i) => i.id);
    const onScroll = () => {
      let best = '';
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.4 && r.bottom > 80) best = id;
      }
      setActive(best);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [sections]);

  useEffect(() => {
    const pill = pillRef.current;
    const container = linksRef.current;
    if (!pill || !container) return;
    if (!active) { pill.classList.add('hidden'); return; }
    const link = container.querySelector(`a[data-id="${active}"]`);
    if (!link) { pill.classList.add('hidden'); return; }
    pill.classList.remove('hidden');
    pill.style.left = link.offsetLeft + 'px';
    pill.style.width = link.offsetWidth + 'px';
  }, [active]);

  const movePill = (target) => {
    const pill = pillRef.current;
    if (!pill) return;
    pill.classList.remove('hidden');
    pill.style.left = target.offsetLeft + 'px';
    pill.style.width = target.offsetWidth + 'px';
  };
  const resetPill = () => {
    const pill = pillRef.current;
    const container = linksRef.current;
    if (!pill || !container) return;
    if (!active) { pill.classList.add('hidden'); return; }
    const link = container.querySelector(`a[data-id="${active}"]`);
    if (!link) return;
    pill.style.left = link.offsetLeft + 'px';
    pill.style.width = link.offsetWidth + 'px';
  };

  return (
    <nav className="rh-nav">
      <div className="rh-shell rh-bar">
        <Link to="/" className="rh-brand">
          <div className="mark">r</div>
          <div className="wm">Review<em>Hub</em></div>
        </Link>
        {sections.length > 0 ? (
          <div className="rh-nav-links" ref={linksRef} onMouseLeave={resetPill}>
            <span className="pill hidden" ref={pillRef} />
            {sections.map((it) => (
              <a key={it.id} href={`#${it.id}`} data-id={it.id}
                 className={active === it.id ? 'active' : ''}
                 onMouseEnter={(e) => movePill(e.currentTarget)}>
                {it.label}
              </a>
            ))}
          </div>
        ) : <span aria-hidden="true" />}
        <div className="rh-nav-cta">
          {/* "LIVE" indicator removed — the hero eyebrow already surfaces it
              with the rolling counter, so duplicating in the nav added clutter. */}
          <Link to="/tools/review-reply-generator" className="rh-nav-tool" title="Free AI reply generator">Free tool</Link>
          <RhLangPicker />
          <RhThemeToggle />
          <Link to="/login" className="rh-btn rh-btn-ghost">Sign in</Link>
          <Link to="/register" className="rh-btn rh-btn-amber">
            Install free
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" aria-hidden="true"><path d="M3 7h8M8 4l3 3-3 3" /></svg>
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ── Theme toggle and language picker — shared across MarketingNav + AuthSideArt ──
export function RhThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="rh-icon-btn">
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

export function RhLangPicker() {
  const { lang, setLang, languages } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const current = languages.find((l) => l.code === lang) || languages[0];
  return (
    <div className="rh-lang-picker" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="rh-icon-btn" aria-haspopup="listbox" aria-expanded={open} title={`Language: ${current.label}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span className="lp-code">{current.code.toUpperCase()}</span>
      </button>
      {open && (
        <ul role="listbox" className="rh-lang-menu">
          {languages.map((l) => (
            <li key={l.code}>
              <button type="button" role="option" aria-selected={l.code === lang}
                onClick={() => { setLang(l.code); setOpen(false); }}
                className={l.code === lang ? 'on' : ''}>
                <span className="lp-code">{l.code.toUpperCase()}</span>
                <span className="lp-label">{l.label}</span>
                {l.code === lang && <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5l3.5 3.5L13 4" /></svg>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
