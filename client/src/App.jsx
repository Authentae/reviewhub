import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { isLoggedIn } from './lib/auth';
import { ThemeProvider } from './context/ThemeContext';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import GlobalHotkeys from './components/GlobalHotkeys';
import CookieConsent from './components/CookieConsent';
import FrillWidget from './components/FrillWidget';

// Eagerly load auth-adjacent pages (accessed immediately on first visit)
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';

// Lazy load heavier pages to reduce initial bundle
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Settings = lazy(() => import('./pages/Settings'));
const Pricing = lazy(() => import('./pages/Pricing'));
// Outbound audits — founder-only tool for the demo-first outreach loop.
// Paste a prospect's reviews → AI drafts replies → shareable URL to DM.
const OutboundAudits = lazy(() => import('./pages/OutboundAudits'));
// Public per-prospect view of an outbound audit. No auth, no signup.
const AuditPreview = lazy(() => import('./pages/AuditPreview'));
// Auth-adjacent but infrequently hit — keep them out of the main bundle
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const AcceptableUse = lazy(() => import('./pages/AcceptableUse'));
const Refund = lazy(() => import('./pages/Refund'));
const ThaiSummary = lazy(() => import('./pages/ThaiSummary'));
const ReviewRequests = lazy(() => import('./pages/ReviewRequests'));
const LoginMfa = lazy(() => import('./pages/LoginMfa'));
const EmailChange = lazy(() => import('./pages/EmailChange'));
const ReplyGeneratorTool = lazy(() => import('./pages/ReplyGeneratorTool'));
// Cold-outreach lead-capture page. Funnel target for DM/email campaigns —
// prospect submits Google Business URL, founder hand-crafts a 10-reply audit
// and emails it back. Public, no signup.
const AuditLanding = lazy(() => import('./pages/AuditLanding'));
// Changelog — public, tech-savvy buyers ("where's the changelog?") asked
// for this in persona testing. Curated highlights, no firehose.
const Changelog = lazy(() => import('./pages/Changelog'));
// Roadmap — public, names what's shipped / building / considering / NOT
// building. The "decided not to build" column lets prospects self-qualify
// out before signing up. No Q-dated promises (they always slip).
const Roadmap = lazy(() => import('./pages/Roadmap'));
// Support — public-or-authed real-issue intake. Frill (already wired) is
// for feature feedback; /support is for "this broke" / billing / account.
const Support = lazy(() => import('./pages/Support'));
// API docs — public TL;DR + cURL examples for the Business-plan API.
// Marketing-page "API access" was reading as fluff; this page makes it real.
const ApiDocs = lazy(() => import('./pages/ApiDocs'));
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard'));
// Landing page after one-click unsubscribe (RFC 8058). Public — the server
// applies the unsub, then redirects browser-clicks here as a confirmation.
const Unsubscribed = lazy(() => import('./pages/Unsubscribed'));
// GDPR Article 17 erasure-confirmation landing. The email link from
// /api/gdpr/erasure-request lands here with ?userId&token, and the user
// clicks the destructive button to complete the deletion.
const ConfirmErasure = lazy(() => import('./pages/ConfirmErasure'));

function PrivateRoute({ children }) {
  const location = useLocation();
  if (isLoggedIn()) return children;
  // Preserve the intended destination (path + query) so post-login can bounce
  // the user back — important for links like /settings?unsub=digest that must
  // survive the auth detour.
  const from = location.pathname + location.search;
  return <Navigate to="/login" replace state={{ from }} />;
}

function PublicOnlyRoute({ children }) {
  return isLoggedIn() ? <Navigate to="/dashboard" replace /> : children;
}

// Minimal skeleton while lazy chunks load. Uses editorial palette
// (rh-paper bg, rh-teal-deep spinner) so the very first paint after a
// route transition stays on-brand instead of flashing blue.
function PageLoader() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--rh-paper, #fbf8f1)' }}
      role="status"
      aria-label="Loading page"
    >
      <div
        className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: 'var(--rh-teal-deep, #1e4d5e)', borderTopColor: 'transparent' }}
        aria-hidden="true"
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
    <GlobalHotkeys />
    <KeyboardShortcuts />
    <CookieConsent />
    <FrillWidget />
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
        {/* MFA challenge is reached from Login with state.pendingToken.
            Not wrapped in PublicOnlyRoute because the user IS in the middle
            of authenticating — they just haven't completed it yet. */}
        <Route path="/login/mfa" element={<LoginMfa />} />
        <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/outbound-audits" element={<PrivateRoute><OutboundAudits /></PrivateRoute>} />
        <Route path="/audit-preview/:token" element={<AuditPreview />} />
        <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
        <Route path="/review-requests" element={<PrivateRoute><ReviewRequests /></PrivateRoute>} />
        <Route path="/owner" element={<PrivateRoute><OwnerDashboard /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        {/* Verification works whether logged in or not — the token carries the identity */}
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/email-change" element={<EmailChange />} />
        <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/acceptable-use" element={<AcceptableUse />} />
        <Route path="/refund-policy" element={<Refund />} />
        <Route path="/legal/th-summary" element={<ThaiSummary />} />
        <Route path="/unsubscribed" element={<Unsubscribed />} />
        <Route path="/confirm-erasure" element={<ConfirmErasure />} />
        {/* Public no-signup SEO/PLG tool */}
        <Route path="/tools/review-reply-generator" element={<ReplyGeneratorTool />} />
        {/* Cold-outreach lead-capture landing — see AuditLanding.jsx */}
        <Route path="/audit" element={<AuditLanding />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/support" element={<Support />} />
        <Route path="/api-docs" element={<ApiDocs />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
    </ThemeProvider>
  );
}
