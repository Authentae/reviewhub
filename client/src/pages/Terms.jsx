import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';

// Terms of Service. Hardened for solo-founder protection:
//   - All-caps warranty disclaimer and liability cap (legally-required
//     conspicuousness in US consumer jurisdictions).
//   - Binding individual arbitration + class-action waiver (standard SaaS
//     protection against class actions; 30-day opt-out to preserve validity
//     in most US jurisdictions).
//   - Indemnification clause (user covers us for their misuse + third-party
//     claims).
//   - Third-party-services carve-out (we're not liable when Google/Yelp/etc.
//     break or change their APIs).
//   - Force majeure, severability, governing law.
//
// THIS IS STILL BOILERPLATE — not counsel-vetted. Replace with text from a
// SaaS-specialised lawyer before commercial launch. The structure here gives
// the lawyer a strong starting point rather than a blank page.

// Ordered list of section keys. Rendering is data-driven so adding a new
// section is one tuple; no JSX duplication.
const SECTIONS = [
  ['acceptance', 'acceptanceBody'],
  ['account', 'accountBody'],
  ['subscription', 'subscriptionBody'],
  ['content', 'contentBody'],
  ['aiDisclaimer', 'aiDisclaimerBody'],
  ['platformAup', 'platformAupBody'],
  ['accountScope', 'accountScopeBody'],
  ['modification', 'modificationBody'],
  ['sanctions', 'sanctionsBody'],
  ['communications', 'communicationsBody'],
  ['dmca', 'dmcaBody'],
  ['termination', 'terminationBody'],
  ['warranty', 'warrantyBody'],
  ['liability', 'liabilityBody'],
  ['indemnity', 'indemnityBody'],
  ['thirdParty', 'thirdPartyBody'],
  ['dispute', 'disputeBody'],
  ['governing', 'governingBody'],
  ['forceMajeure', 'forceMajeureBody'],
  ['severability', 'severabilityBody'],
  ['changes', 'changesBody'],
  ['contact', 'contactBody'],
];

export default function Terms() {
  const { t } = useI18n();
  usePageTitle(t('page.terms'));
  const updated = '2025-04-22';

  return (
    <div className="rh-design rh-app min-h-screen">
      <Navbar />
      <main id="main-content" className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-2">{t('legal.termsTitle')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">{t('legal.lastUpdated', { date: updated })}</p>

        <article className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
          {SECTIONS.map(([heading, body]) => (
            <section key={heading}>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {t(`legal.terms.${heading}`)}
              </h2>
              <p className="whitespace-pre-line">{t(`legal.terms.${body}`)}</p>
            </section>
          ))}
        </article>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-12">
          <Link to="/privacy" className="text-blue-600 hover:underline">{t('legal.privacyTitle')}</Link>
          {' · '}
          <Link to="/acceptable-use" className="text-blue-600 hover:underline">{t('legal.aupTitle')}</Link>
          {' · '}
          <Link to="/refund-policy" className="text-blue-600 hover:underline">{t('legal.refundTitle')}</Link>
        </p>
      </main>
    </div>
  );
}
