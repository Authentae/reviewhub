// For each missing i18n key, find its `t('key') || 'fallback'` pattern
// in the codebase and extract the fallback string. Output as a paste-ready
// JS object.
const fs = require('fs');
const path = require('path');

const missing = [
  'autoRules.deleteAria','claim.approved','claim.checking','claim.claimCta','claim.failed',
  'claim.fieldName','claim.fieldNote','claim.fieldNotePlaceholder','claim.fieldRole',
  'claim.fieldRolePlaceholder','claim.missingFields','claim.modalSubtitle','claim.modalTitle',
  'claim.pending','claim.rejected','claim.signInToClaim','claim.submit','claim.submitted',
  'claim.submitting','common.delete','common.deleting','common.edit','common.no',
  'common.optional','common.yes','owner.backToDashboard','owner.emptyBody','owner.emptyTitle',
  'owner.heading','owner.loadFailed','owner.pageTitle','owner.row.manage','owner.row.pendingAria',
  'owner.row.totalReviews','owner.subheading','owner.upsellBadge','owner.upsellBody',
  'owner.upsellCta','owner.upsellTitle','ownerResponse.badge','ownerResponse.confirmDelete',
  'ownerResponse.confirmDeleteAria','ownerResponse.deleteAria','ownerResponse.deleteFailed',
  'ownerResponse.deleted','ownerResponse.editAria','ownerResponse.edited','ownerResponse.formAria',
  'ownerResponse.label','ownerResponse.maxHint','ownerResponse.minHint','ownerResponse.placeholder',
  'ownerResponse.postFailed','ownerResponse.posted','ownerResponse.publish','ownerResponse.regionAria',
  'ownerResponse.saveEdit','ownerResponse.saving','ownerResponse.updateFailed','ownerResponse.updated',
  'settings.subtitle','tags.deleteAria','unsub.body','unsub.note','unsub.openSettings','unsub.title',
  'value.receiptAria','value.receiptBody','value.thisMonthLabel','webhooks.deleteAria',
];

const found = {};
const walk = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) {
      if (f.name === 'node_modules' || f.name === '__tests__') continue;
      walk(p);
    } else if (/\.(jsx?|tsx?)$/.test(f.name)) {
      const content = fs.readFileSync(p, 'utf8');
      for (const key of missing) {
        if (found[key]) continue;
        // pattern: t('key') || 'string'  OR  t('key', {...}) || 'string'
        const escaped = key.replace(/\./g, '\\.');
        const re = new RegExp(`t\\(\\s*['"\`]${escaped}['"\`](?:\\s*,\\s*\\{[^}]*\\})?\\s*\\)\\s*\\|\\|\\s*['"\`]([^'"\`]+)['"\`]`, 'g');
        const m = re.exec(content);
        if (m) found[key] = m[1];
      }
    }
  }
};
walk(path.join(__dirname, '..', 'client/src'));

console.log('Found defaults for', Object.keys(found).length, '/', missing.length);
console.log();
for (const key of missing) {
  const v = found[key] || `<<MISSING: ${key}>>`;
  // Escape single quotes for JS string literal output
  const safe = v.replace(/'/g, "\\'");
  console.log(`  '${key}': '${safe}',`);
}
