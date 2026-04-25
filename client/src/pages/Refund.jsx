import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';

// Refund Policy. Clear, specific, and pre-answers the most common disputes:
//  - free trial (not charged)
//  - first paid month (30-day money-back)
//  - subsequent months (cancel anytime, no pro-rata refund)
//  - when we WILL refund anyway (billing error, incident credit, legal req)
//  - when we WON'T (forgot to cancel, didn't use it, AUP violation)
//
// This matters for dispute prevention: most chargebacks come from customers
// who didn't understand the cancellation flow. Being explicit up front
// reduces those dramatically.

const SECTIONS = [
  ['intro', 'introBody'],
  ['trial', 'trialBody'],
  ['firstMonth', 'firstMonthBody'],
  ['ongoing', 'ongoingBody'],
  ['exceptions', 'exceptionsBody'],
  ['noRefund', 'noRefundBody'],
  ['process', 'processBody'],
  ['chargeback', 'chargebackBody'],
  ['changes', 'changesBody'],
  ['contact', 'contactBody'],
];

export default function Refund() {
  const { t } = useI18n();
  usePageTitle(t('legal.refundTitle'));
  const updated = '2025-04-22';

  return (
    <div className="rh-design rh-app min-h-screen">
      <Navbar />
      <main id="main-content" className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-2">{t('legal.refundTitle')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">{t('legal.lastUpdated', { date: updated })}</p>

        <article className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
          {SECTIONS.map(([heading, body]) => (
            <section key={heading}>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {t(`legal.refund.${heading}`)}
              </h2>
              <p className="whitespace-pre-line">{t(`legal.refund.${body}`)}</p>
            </section>
          ))}
        </article>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-12">
          <Link to="/terms" className="text-blue-600 hover:underline">{t('legal.termsTitle')}</Link>
          {' · '}
          <Link to="/privacy" className="text-blue-600 hover:underline">{t('legal.privacyTitle')}</Link>
          {' · '}
          <Link to="/acceptable-use" className="text-blue-600 hover:underline">{t('legal.aupTitle')}</Link>
        </p>
      </main>
    </div>
  );
}
