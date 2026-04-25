// Amazon Seller Central content script.
//
// Targets the seller dashboard (sellercentral.amazon.com and regional
// domains). Reviews show up in Voice of the Customer / Feedback tabs and
// individual product review pages. Amazon doesn't provide a review-reply
// API for third parties — sellers reply via the dashboard UI — so this
// extension follows the standard copy-to-clipboard pattern.

(function () {
  const PLATFORM = 'amazon';

  const REVIEW_SELECTORS = [
    'div[data-hook="review"]',                    // public product review pages
    'div[class*="review-container"]',
    'div[data-reviewer-review]',                   // seller feedback dashboard
    'tr[data-feedback-id]',                         // feedback table rows
  ];

  function findReviews() {
    const seen = new Set();
    const out = [];
    for (const sel of REVIEW_SELECTORS) {
      for (const el of document.querySelectorAll(sel)) {
        if (!seen.has(el)) { seen.add(el); out.push(el); }
      }
    }
    return out;
  }

  function parseReview(el) {
    // Reviewer name — Amazon uses "a-profile-name" class on public reviews
    // and plain text cells on seller-feedback tables
    const nameEl = el.querySelector('.a-profile-name, span[data-hook="review-author"], td[class*="buyer"]');
    const reviewer_name = (nameEl?.textContent || '').trim().slice(0, 200) || 'Customer';

    // Rating — Amazon uses aria-label "X out of 5 stars"
    let rating = 0;
    const ratingEl = el.querySelector('[data-hook="review-star-rating"], i[class*="a-star-"], [aria-label*="out of 5 stars"]');
    if (ratingEl) {
      const txt = ratingEl.getAttribute('aria-label') || ratingEl.textContent || '';
      const m = txt.match(/(\d)(\.\d)?\s*out of/i) || (ratingEl.className || '').match(/a-star-(\d)/);
      if (m) rating = Math.round(parseFloat(m[1]));
    }
    rating = Math.min(5, Math.max(1, rating || 3));

    // Body — the review body has a "review-body" data hook
    let review_text = '';
    const body = el.querySelector('[data-hook="review-body"] span, [data-hook="review-body"], span.review-text-content')
      || [...el.querySelectorAll('span, p')].sort((a, b) => (b.textContent?.length || 0) - (a.textContent?.length || 0))[0];
    review_text = (body?.textContent || '').trim().slice(0, 2000);

    // Business / product name — on seller feedback pages it's the order line,
    // on product pages it's the product title
    const business_name = document.querySelector('#productTitle, h1#title span, h1')?.textContent?.trim().slice(0, 200) || '';

    return { reviewer_name, rating, review_text, business_name };
  }

  function scan() {
    for (const el of findReviews()) {
      // Skip very short reviews (likely non-review elements that matched)
      if ((el.textContent || '').length < 30) continue;
      window.__reviewhub.injectButton({
        reviewEl: el, host: el, parseReview, platform: PLATFORM,
      });
    }
  }

  window.__reviewhub.observe(scan);
})();
