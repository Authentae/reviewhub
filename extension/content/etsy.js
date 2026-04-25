// Etsy content script.
//
// Etsy shop reviews live on public shop pages (etsy.com/shop/<name>/reviews)
// and in the seller dashboard (etsy.com/your/shops/.../reviews). Etsy's
// Open API v3 exposes reviews as read-only; replies are dashboard-only, so
// the extension uses the same copy-to-clipboard pattern.

(function () {
  const PLATFORM = 'etsy';

  const REVIEW_SELECTORS = [
    'li[class*="review-"]',
    'div[data-region-type="shop_home"] li',
    'div[data-review-container]',
    'div[class*="shop2-review-attribute"]',
    // Seller dashboard reviews panel
    'div[data-appears-component-name="ReviewsPanelReview"]',
  ];

  function findReviews() {
    const seen = new Set();
    const out = [];
    for (const sel of REVIEW_SELECTORS) {
      for (const el of document.querySelectorAll(sel)) {
        if (!seen.has(el) && (el.textContent || '').length > 30) {
          seen.add(el);
          out.push(el);
        }
      }
    }
    return out;
  }

  function parseReview(el) {
    // Reviewer — link to their Etsy profile or displayed name
    const nameEl = el.querySelector('a[href*="/people/"], p[class*="reviewer"], span[class*="reviewer-name"]');
    const reviewer_name = (nameEl?.textContent || '').trim().slice(0, 200) || 'Customer';

    // Rating — Etsy uses "X out of Y stars" aria-labels
    let rating = 0;
    const ratingEl = el.querySelector('[aria-label*="out of 5 stars"], [aria-label*="star rating"], input[name="rating"]');
    if (ratingEl) {
      const txt = ratingEl.getAttribute('aria-label') || ratingEl.value || '';
      const m = txt.match(/(\d)(\.\d)?\s*out of/i);
      if (m) rating = Math.round(parseFloat(m[1]));
    }
    if (!rating) {
      // Some review cards show filled stars — count them
      const filled = el.querySelectorAll('svg[class*="icon-star"]:not([class*="inactive"])');
      if (filled.length) rating = Math.min(5, Math.max(1, filled.length));
    }
    rating = Math.min(5, Math.max(1, rating || 3));

    // Body — longest text block
    let review_text = '';
    const body = el.querySelector('p[class*="review-text"], p[data-review-text], div[class*="review-content"] p')
      || [...el.querySelectorAll('p')].sort((a, b) => (b.textContent?.length || 0) - (a.textContent?.length || 0))[0];
    review_text = (body?.textContent || '').trim().slice(0, 2000);

    // Shop name — h1 on the shop page, or page title
    const business_name = document.querySelector('h1, .shop-name-header')?.textContent?.trim().slice(0, 200) || '';

    return { reviewer_name, rating, review_text, business_name };
  }

  function scan() {
    for (const el of findReviews()) {
      window.__reviewhub.injectButton({
        reviewEl: el, host: el, parseReview, platform: PLATFORM,
      });
    }
  }

  window.__reviewhub.observe(scan);
})();
