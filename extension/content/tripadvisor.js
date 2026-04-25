// TripAdvisor content script.
//
// TripAdvisor has a clearer DOM than Facebook — reviews are in well-marked
// card elements with data attributes. The main gotcha is they A/B test
// multiple layouts, so we cover the common ones.

(function () {
  const PLATFORM = 'tripadvisor';

  const REVIEW_SELECTORS = [
    'div[data-test-target*="review"]',
    'div[data-reviewid]',
    'div.review-container',
    'article[data-automation*="review"]',
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
    // Reviewer name — usually in a link to their profile
    const nameEl = el.querySelector('a[href*="/Profile/"], a.ui_header_link, span.username, [data-test-target="reviewer-name"]');
    const reviewer_name = (nameEl?.textContent || '').trim().slice(0, 200) || 'Customer';

    // Rating — TA uses bubble ratings 10/20/30/40/50 in class names, or aria-label
    let rating = 0;
    const bubble = el.querySelector('span.ui_bubble_rating, [class*="bubble_"]');
    if (bubble) {
      const cls = bubble.className || '';
      const m = cls.match(/bubble_(\d)(\d)/);
      if (m) rating = parseInt(m[1], 10);
    }
    if (!rating) {
      const aria = el.querySelector('[aria-label*="of 5"], [aria-label*="out of"], [title*="of 5"]');
      const txt = (aria?.getAttribute('aria-label') || aria?.getAttribute('title') || '').match(/(\d)(\.\d)?\s*(of|out of)/i);
      if (txt) rating = Math.round(parseFloat(txt[0]));
    }
    rating = Math.min(5, Math.max(1, rating || 3));

    // Body — TA wraps reviews in <q> tags or specific divs
    let review_text = '';
    const body = el.querySelector('q, p.partial_entry, span.partial_entry, div[data-test-target="review-body"]')
      || [...el.querySelectorAll('p, span')].sort((a, b) => (b.textContent?.length || 0) - (a.textContent?.length || 0))[0];
    review_text = (body?.textContent || '').trim().slice(0, 2000);

    const business_name = document.querySelector('h1')?.textContent?.trim().slice(0, 200) || '';

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
