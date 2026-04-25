import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';

// Privacy Policy. Covers PDPA (Thailand), GDPR (EU/UK), and CCPA/CPRA
// (California) in one document — where laws differ, the stricter standard
// applies. Specific jurisdiction-augmented rights sections live in the
// enumerated blocks below.
//
// Data-driven rendering keeps the page and the translations in lockstep:
// to add a new section, add a tuple here and the matching `legal.privacy.*`
// keys. The order in this array is the order on the page.

const SECTIONS = [
  ['intro', 'introBody'],
  ['collect', 'collectBody'],
  ['legalBasis', 'legalBasisBody'],
  ['use', 'useBody'],
  ['share', 'shareBody'],
  ['transfers', 'transfersBody'],
  ['retain', 'retainBody'],
  ['rights', 'rightsBody'],
  ['gdprRights', 'gdprRightsBody'],
  ['ccpaRights', 'ccpaRightsBody'],
  ['pdpaRights', 'pdpaRightsBody'],
  ['security', 'securityBody'],
  ['breach', 'breachBody'],
  ['cookies', 'cookiesBody'],
  ['minors', 'minorsBody'],
  ['controller', 'controllerBody'],
  ['changes', 'changesBody'],
  ['contact', 'contactBody'],
];

export default function Privacy() {
  const { t } = useI18n();
  usePageTitle(t('page.privacy'));
  const updated = '2025-04-22';

  return (
    <div className="rh-design rh-app min-h-screen">
      <Navbar />
      <main id="main-content" className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-2">{t('legal.privacyTitle')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">{t('legal.lastUpdated', { date: updated })}</p>

        <article className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
          {SECTIONS.map(([heading, body]) => (
            <section key={heading}>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {t(`legal.privacy.${heading}`)}
              </h2>
              <p className="whitespace-pre-line">{t(`legal.privacy.${body}`)}</p>
            </section>
          ))}
        </article>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-12">
          <Link to="/terms" className="text-blue-600 hover:underline">{t('legal.termsTitle')}</Link>
          {' · '}
          <Link to="/acceptable-use" className="text-blue-600 hover:underline">{t('legal.aupTitle')}</Link>
          {' · '}
          <Link to="/refund-policy" className="text-blue-600 hover:underline">{t('legal.refundTitle')}</Link>
        </p>
      </main>
    </div>
  );
}
