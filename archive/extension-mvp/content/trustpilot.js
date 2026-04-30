// Trustpilot content script.

(function () {
  const PLATFORM = 'trustpilot';

  const REVIEW_SELECTORS = [
    'article[data-service-review-card-paper]',
    'article[class*="review"]',
    'section[data-review-card]',
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
    // Trustpilot has fairly clear data attrs
    const nameEl = el.querySelector('[data-consumer-name-typography]') || el.querySelector('a[href*="/users/"]');
    const reviewer_name = (nameEl?.textContent || '').trim().slice(0, 200) || 'Customer';

    // Rating comes as an img alt="Rated 5 out of 5 stars" or as a class attribute
    let rating = 0;
    const ratingImg = el.querySelector('img[alt*="Rated"], div[data-service-review-rating] img');
    if (ratingImg) {
      const m = (ratingImg.getAttribute('alt') || '').match(/Rated\s+(\d)/i);
      if (m) rating = parseInt(m[1], 10);
    }
    if (!rating) {
      const star = el.querySelector('[data-service-review-rating]');
      const cls = star?.getAttribute('data-service-review-rating');
      if (cls) rating = parseInt(cls, 10);
    }
    rating = Math.min(5, Math.max(1, rating || 3));

    // Body
    const body = el.querySelector('[data-service-review-text-typography]')
      || el.querySelector('p[data-service-review-text]')
      || [...el.querySelectorAll('p, span')].sort((a, b) => (b.textContent?.length || 0) - (a.textContent?.length || 0))[0];
    const review_text = (body?.textContent || '').trim().slice(0, 2000);

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
