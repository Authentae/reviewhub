import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { clearToken, isLoggedIn, getToken } from '../lib/auth';
import api from '../lib/api';
import { useUser } from '../context/UserContext';
import useUnrespondedCount from '../hooks/useUnrespondedCount';
import SessionExpiryBanner from './SessionExpiryBanner';
import EmailVerifyBanner from './EmailVerifyBanner';
import PastDueBanner from './PastDueBanner';
import Logo from './Logo';
import { useI18n } from '../context/I18nContext';
import { RhThemeToggle, RhLangPicker } from './MarketingNav';

// Editorial logged-in nav. Uses the .rh-design + .rh-app workspace tokens
// so the palette, type stack, and density match the editorial system on
// Landing/Pricing/auth pages. Behavior (banners, focus trap, escape,
// keyboard menu nav, mobile drawer) is preserved from the legacy version.

function getEmailFromToken() {
  try {
    const token = getToken();
    if (!token) return null;
    return JSON.parse(atob(token.split('.')[1])).email || null;
  } catch { return null; }
}

function getInitial(email) {
  return email ? email[0].toUpperCase() : '?';
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const loggedIn = isLoggedIn();
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user: ctxUser } = useUser();
  const userEmail = getEmailFromToken() || ctxUser?.email || null;
  const menuRef = useRef(null);
  const menuTriggerRef = useRef(null);
  const menuItemRefs = useRef([]);
  const mobileMenuRef = useRef(null);
  const { t } = useI18n();
  const unresponded = useUnrespondedCount();

  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (userMenuOpen) {
      const id = setTimeout(() => {
        menuItemRefs.current.filter(Boolean)[0]?.focus();
      }, 0);
      return () => clearTimeout(id);
    }
  }, [userMenuOpen]);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Focus trap inside mobile drawer
  useEffect(() => {
    if (!open || !mobileMenuRef.current) return;
    const FOCUSABLE = 'a[href]:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const items = Array.from(mobileMenuRef.current.querySelectorAll(FOCUSABLE));
    items[0]?.focus();
    function onKeyDown(e) {
      if (e.key !== 'Tab') return;
      const fresh = Array.from(mobileMenuRef.current?.querySelectorAll(FOCUSABLE) || []);
      if (fresh.length === 0) return;
      const first = fresh[0];
      const last = fresh[fresh.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Escape closes drawer + dropdown
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (open) setOpen(false);
      if (userMenuOpen) {
        setUserMenuOpen(false);
        menuTriggerRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, userMenuOpen]);

  async function handleLogout() {
    api.post('/auth/logout').catch(() => {});
    clearToken();
    navigate('/');
    setUserMenuOpen(false);
  }

  function handleMenuKeyDown(e) {
    const items = menuItemRefs.current.filter(Boolean);
    const current = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = current < items.length - 1 ? current + 1 : 0;
      items[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = current > 0 ? current - 1 : items.length - 1;
      items[prev]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault(); items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault(); items[items.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      setUserMenuOpen(false);
      menuTriggerRef.current?.focus();
    } else if (e.key === 'Tab') {
      setUserMenuOpen(false);
    }
  }

  const isActive = (to) => location.pathname === to;

  return (
    // Wrapper exposes the editorial design tokens (--rh-*) to the navbar
    // tree but MUST NOT carry .rh-app — that class sets `min-height: 100vh`
    // in dashboard-system.css, and when the page itself is also wrapped in
    // .rh-app (every authenticated page is), you get two stacked viewport-
    // tall containers and ~700px of empty space between navbar and content.
    // Caught via preview_eval on a logged-in dashboard 2026-04-27.
    <div className="rh-design rh-app-nav-wrap">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-[color:var(--rh-paper)] focus:text-[color:var(--rh-teal)] focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold focus:shadow-lg focus:outline-none"
      >
        {t('nav.skipToMain')}
      </a>
      {loggedIn && <PastDueBanner />}
      {loggedIn && <EmailVerifyBanner />}
      {loggedIn && <SessionExpiryBanner />}

      <nav aria-label={t('nav.mainNav')} className="rh-app-nav">
        <div className="rh-shell rh-bar">
          <Link to={loggedIn ? '/dashboard' : '/'} className="rh-brand">
            <Logo size={28} />
            <span className="wm" style={{ fontFamily: 'var(--rh-serif)', fontSize: 22 }}>Review<em>Hub</em></span>
          </Link>

          {/* Desktop links */}
          <div className="hidden sm:flex items-center" style={{ gap: 4 }}>
            {loggedIn ? (
              <div className="rh-app-nav-links">
                <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''} aria-current={isActive('/dashboard') ? 'page' : undefined}>
                  {t('nav.dashboard')}
                  {unresponded > 0 && (
                    <span
                      className="badge"
                      aria-label={t('nav.unrespondedBadge', { n: unresponded })}
                    >
                      {unresponded > 99 ? '99+' : unresponded}
                    </span>
                  )}
                </Link>
                <Link to="/analytics" className={isActive('/analytics') ? 'active' : ''} aria-current={isActive('/analytics') ? 'page' : undefined}>{t('nav.analytics')}</Link>
                <Link to="/review-requests" className={isActive('/review-requests') ? 'active' : ''} aria-current={isActive('/review-requests') ? 'page' : undefined}>{t('nav.reviewRequests')}</Link>
                <Link to="/outbound-audits" className={isActive('/outbound-audits') ? 'active' : ''} aria-current={isActive('/outbound-audits') ? 'page' : undefined}>{t('nav.outboundAudits', 'Outbound')}</Link>
                <Link to="/owner" className={isActive('/owner') ? 'active' : ''} aria-current={isActive('/owner') ? 'page' : undefined}>{t('nav.owner', 'Owner')}</Link>
                <Link to="/pricing" className={isActive('/pricing') ? 'active' : ''} aria-current={isActive('/pricing') ? 'page' : undefined}>{t('nav.pricing')}</Link>
                {/* Settings lives in the user-avatar dropdown — see below.
                    Putting it here too created a duplicate hit-target with
                    identical destination and clutter on the nav row. */}
              </div>
            ) : (
              <div className="rh-app-nav-links">
                <Link to="/pricing" className={isActive('/pricing') ? 'active' : ''} aria-current={isActive('/pricing') ? 'page' : undefined}>{t('nav.pricing')}</Link>
              </div>
            )}
          </div>

          {/* Right cluster: lang + theme + user/auth */}
          <div className="flex items-center" style={{ gap: 8 }}>
            <span className="hidden sm:inline-flex items-center" style={{ gap: 8 }}>
              <RhLangPicker />
              <RhThemeToggle />
            </span>

            {loggedIn ? (
              <div className="rh-user-menu" ref={menuRef}>
                <button
                  type="button"
                  ref={menuTriggerRef}
                  onClick={() => setUserMenuOpen(v => !v)}
                  className="rh-user-menu-trigger"
                  aria-label={t('nav.userMenu')}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                >
                  <div className="rh-avatar">{getInitial(userEmail)}</div>
                  <span className="rh-user-email">{userEmail}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {userMenuOpen && (
                  <div
                    role="menu"
                    aria-label={t('nav.userMenu')}
                    onKeyDown={handleMenuKeyDown}
                    className="rh-user-menu-panel"
                  >
                    <div className="rh-user-menu-head" role="presentation">
                      <p className="name">{t('nav.signedInAs')}</p>
                      <p className="email">{userEmail}</p>
                    </div>
                    <Link to="/settings" onClick={() => setUserMenuOpen(false)}
                      ref={el => { menuItemRefs.current[0] = el; }}
                      role="menuitem">
                      {t('nav.settings')}
                    </Link>
                    <button type="button" onClick={handleLogout}
                      ref={el => { menuItemRefs.current[1] = el; }}
                      role="menuitem"
                      className="danger">
                      {t('nav.logout')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <span className="hidden sm:inline-flex items-center" style={{ gap: 8 }}>
                <Link to="/login" className="rh-btn rh-btn-ghost">{t('nav.login')}</Link>
                <Link to="/register" className="rh-btn rh-btn-amber">{t('nav.register')}</Link>
              </span>
            )}

            {/* Mobile: hamburger */}
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="sm:hidden rh-icon-btn"
              aria-label={t('nav.toggleMenu')}
              aria-expanded={open}
              aria-controls="mobile-nav-menu"
            >
              {open ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div
            id="mobile-nav-menu"
            ref={mobileMenuRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.mobileMenu')}
            className="sm:hidden"
            style={{
              borderTop: '1px solid var(--rh-rule)',
              padding: '12px 16px',
              display: 'flex', flexDirection: 'column', gap: 4,
              background: 'var(--rh-paper)',
            }}
          >
            {loggedIn ? (
              <>
                {userEmail && (
                  <div className="rh-meta-row" style={{ padding: '8px 4px', marginBottom: 4 }}>
                    <span className="rh-avatar" style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, var(--rh-teal), var(--rh-teal-deep))', color: 'var(--rh-paper)', display: 'grid', placeItems: 'center', fontFamily: 'var(--rh-serif)', fontSize: 12, fontWeight: 700 }}>
                      {getInitial(userEmail)}
                    </span>
                    <span className="v" style={{ fontSize: 12, fontFamily: 'var(--rh-mono)' }}>{userEmail}</span>
                  </div>
                )}
                <MobileLink to="/dashboard" label={t('nav.dashboard')} active={isActive('/dashboard')} badge={unresponded} />
                <MobileLink to="/analytics" label={t('nav.analytics')} active={isActive('/analytics')} />
                <MobileLink to="/review-requests" label={t('nav.reviewRequests')} active={isActive('/review-requests')} />
                <MobileLink to="/owner" label={t('nav.owner', 'Owner')} active={isActive('/owner')} />
                <MobileLink to="/settings" label={t('nav.settings')} active={isActive('/settings')} />
                <MobileLink to="/pricing" label={t('nav.pricing')} active={isActive('/pricing')} />
                <div style={{ display: 'flex', gap: 8, padding: '8px 4px' }}>
                  <RhLangPicker />
                  <RhThemeToggle />
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px', borderRadius: 8,
                    background: 'transparent', border: 0, cursor: 'pointer',
                    color: 'var(--rh-rose)', fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                  }}
                >
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <>
                <MobileLink to="/pricing" label={t('nav.pricing')} active={isActive('/pricing')} />
                <MobileLink to="/login" label={t('nav.login')} active={isActive('/login')} />
                <MobileLink to="/register" label={t('nav.register')} active={false} highlight />
                <div style={{ display: 'flex', gap: 8, padding: '8px 4px' }}>
                  <RhLangPicker />
                  <RhThemeToggle />
                </div>
              </>
            )}
          </div>
        )}
      </nav>
    </div>
  );
}

function MobileLink({ to, label, active, highlight, badge }) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderRadius: 8,
        textDecoration: 'none',
        fontFamily: 'var(--rh-sans)', fontSize: 13.5, fontWeight: active ? 600 : 500,
        color: active ? 'var(--rh-ink)' : highlight ? 'var(--rh-paper)' : 'var(--rh-ink-2)',
        background: highlight
          ? 'var(--rh-ink)'
          : active
            ? 'color-mix(in oklab, var(--rh-ochre) 18%, var(--rh-paper))'
            : 'transparent',
      }}
    >
      <span>{label}</span>
      {badge > 0 && (
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 20, height: 18, padding: '0 6px',
            borderRadius: 999,
            background: 'var(--rh-rose)', color: 'var(--rh-paper)',
            fontFamily: 'var(--rh-mono)', fontSize: 10, fontWeight: 700,
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}
