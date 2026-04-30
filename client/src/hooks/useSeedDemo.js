import { useState } from 'react';
import api from '../lib/api';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../components/Toast';

// Shared helper for the "Try demo data" path surfaced on the Dashboard empty
// state, Analytics empty state, and Onboarding checklist. Centralises the
// POST, the seeding state flag, and the success/failure toast so callers only
// need to handle their own follow-up (refetch, navigate, etc.).
//
// Returns { seed, seeding }. `seed` resolves to the number of reviews added
// (0 if the account was already seeded), or null on error.
export default function useSeedDemo() {
  const { t } = useI18n();
  const toast = useToast();
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function seed() {
    setSeeding(true);
    try {
      const { data } = await api.post('/reviews/seed');
      if (data.reviews_added > 0) {
        toast(t('dashboard.seedLoaded', { n: data.reviews_added }), 'success');
      }
      return data.reviews_added ?? 0;
    } catch (err) {
      toast(err?.response?.data?.error || t('dashboard.seedFailed'), 'error');
      return null;
    } finally {
      setSeeding(false);
    }
  }

  // Counterpart to `seed`. Used by the Dashboard "Clear demo data" affordance
  // so a user who tried demo data can return their account to a clean slate
  // without manually deleting 12 fake reviews one-by-one.
  async function clear() {
    setClearing(true);
    try {
      const { data } = await api.delete('/reviews/seed');
      const removed = data?.removed ?? 0;
      if (removed > 0) {
        toast(t('dashboard.seedCleared', { n: removed }), 'success');
      }
      return removed;
    } catch (err) {
      toast(err?.response?.data?.error || t('dashboard.seedClearFailed'), 'error');
      return null;
    } finally {
      setClearing(false);
    }
  }

  return { seed, seeding, clear, clearing };
}
