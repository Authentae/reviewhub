// Yelp content script.
//
// Targets both biz.yelp.com (owner dashboard) and yelp.com public review
// pages. Owner dashboard has a reply UI; public review pages don't, but the
// extension still works for drafting replies the owner can paste later.
//
// DOM selectors are brittle by necessity — Yelp changes their markup every
// ~6 months. If the script stops working, the selector list below is the
// one file to update.

(function () {
  const PLATFORM = 'yelp';

  // Yelp review cards — broad net, multiple possible containers. Start with
  // the most-specific and fall back.
  const REVIEW_SELECTORS = [
    'article[data-testid*="review"]',
    'div[data-testid="review"]',
    'li[class*="review"] article',
    'div[class*="review"] > article',
  ];

  function findReviews() {
    const seen = new Set();
    const results = [];
    for (const sel of REVIEW_SELECTORS) {
      for (const el of document.querySelectorAll(sel)) {
        if (!seen.has(el)) {
          seen.add(el);
          results.push(el);
        }
      }
    }
    return results;
  }

  function parseReview(el) {
    // Reviewer name — the first link or strong tag inside the review header
    const nameEl = el.querySelector('[data-testid="user-passport-info"] a, a[href*="/user_details"], a.user-display-name, header a, [data-font-weight="semibold"]');
    const reviewer_name = (nameEl?.textContent || '').trim().slice(0, 200) || 'Customer';

    // Rating — look for aria-label like "5 star rating" or a star-count SVG
    let rating = 0;
    const ratingEl = el.querySelector('[aria-label*="star rating"], [aria-label*="rating"], div[role="img"][aria-label*="star"]');
    if (ratingEl) {
      const match = (ratingEl.getAttribute('aria-label') || '').match(/(\d)(\.\d)?/);
      if (match) rating = Math.round(parseFloat(match[0]));
    }
    if (!rating) {
      // Fallback: count filled star SVGs
      const stars = el.querySelectorAll('svg[class*="star"], span[class*="star--regular"], span[class*="star--filled"]');
      if (stars.length) rating = Math.min(5, Math.max(1, stars.length));
    }
    rating = Math.min(5, Math.max(1, rating || 3));

    // Review body — longest <p> or <span> descendant is usually the review text
    let review_text = '';
    const candidates = el.querySelectorAll('p, span, [lang]');
    let best = '';
    for (const c of candidates) {
      const txt = (c.textContent || '').trim();
      if (txt.length > best.length && txt.length < 5000 && !txt.includes('Yelp')) {
        best = txt;
      }
    }
    review_text = best.slice(0, 2000);

    // Business name — Yelp's business pages put it in <h1>
    const business_name = document.querySelector('h1')?.textContent?.trim().slice(0, 200) || '';

    return { reviewer_name, rating, review_text, business_name };
  }

  function scan() {
    const reviews = findReviews();
    for (const el of reviews) {
      window.__reviewhub.injectButton({
        reviewEl: el,
        host: el, // append button inside the review card
        parseReview,
        platform: PLATFORM,
      });
    }
  }

  window.__reviewhub.observe(scan);
})();
