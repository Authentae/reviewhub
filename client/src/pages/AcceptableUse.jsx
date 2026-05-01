import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';

// Acceptable Use Policy. Separate from Terms so it can be updated faster
// (platform policies change) without re-noticing the whole ToS. The Terms
// of Service reference this AUP by URL — violating the AUP is a material
// breach of the Terms.

const SECTIONS = [
  ['intro', 'introBody'],
  ['fakeReviews', 'fakeReviewsBody'],
  ['ownership', 'ownershipBody'],
  ['platformCompliance', 'platformComplianceBody'],
  ['aiContent', 'aiContentBody'],
  ['responseConduct', 'responseConductBody'],
  ['regulatedIndustries', 'regulatedIndustriesBody'],
  ['security', 'securityBody'],
  ['apiLimits', 'apiLimitsBody'],
  ['resale', 'resaleBody'],
  ['illegal', 'illegalBody'],
  ['enforcement', 'enforcementBody'],
  ['reporting', 'reportingBody'],
];

export default function AcceptableUse() {
  const { t } = useI18n();
  usePageTitle(t('legal.aupTitle'));
  const updated = '2025-04-22';

  return (
    <div className="rh-design rh-app min-h-screen">
      <Navbar />
      <main id="main-content" className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-2">{t('legal.aupTitle')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">{t('legal.lastUpdated', { date: updated })}</p>

        <article className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
          {SECTIONS.map(([heading, body]) => (
            <section key={heading}>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {t(`legal.aup.${heading}`)}
              </h2>
              <p className="whitespace-pre-line">{t(`legal.aup.${body}`)}</p>
            </section>
          ))}
        </article>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-12">
          <Link to="/terms" className="text-blue-600 hover:underline">{t('legal.termsTitle')}</Link>
          {' · '}
          <Link to="/privacy" className="text-blue-600 hover:underline">{t('legal.privacyTitle')}</Link>
          {' · '}
          <Link to="/refund-policy" className="text-blue-600 hover:underline">{t('legal.refundTitle')}</Link>
        </p>
      </main>
    </div>
  );
}
