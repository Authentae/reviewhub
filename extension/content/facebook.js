// Facebook / Meta content script.
//
// Facebook's markup is heavily obfuscated (randomized class names) and
// changes frequently. We target structural patterns: review blocks tend to
// have a recommender name link, a rating/recommendation indicator, and a
// block of text. We do NOT attempt auto-paste into their reply UI because
// Facebook's reply boxes are React-controlled and rejecting synthetic input.
//
// Users should expect to copy the draft and paste into the Page's reply UI.

(function () {
  const PLATFORM = 'facebook';

  // Reviews on Pages show up in feed-like cards. FB strips semantic
  // attributes, so we rely on role + shape heuristics.
  const REVIEW_SELECTORS = [
    'div[role="article"]',
    'div[data-pagelet*="FeedUnit"]',
  ];

  function findReviews() {
    const candidates = [];
    for (const sel of REVIEW_SELECTORS) {
      for (const el of document.querySelectorAll(sel)) {
        // Filter: only keep cards that look like reviews — has a "recommends"
        // or "review" marker somewhere inside.
        const text = (el.textContent || '').toLowerCase();
        if (text.includes('recommend') || text.includes('review') || text.includes('star')) {
          // Avoid the outer feed container (which has a huge textContent)
          if ((el.textContent || '').length < 3000) {
            candidates.push(el);
          }
        }
      }
    }
    return candidates;
  }

  function parseReview(el) {
    // Reviewer name: first anchor that looks like a profile link
    const nameEl = el.querySelector('a[role="link"] strong, a[role="link"] span, h3 a, h4 a');
    const reviewer_name = (nameEl?.textContent || '').trim().slice(0, 200) || 'Customer';

    // Rating: Facebook uses "recommends" / "doesn't recommend" more than stars.
    // Normalize to 5 (recommend) or 1 (doesn't recommend) — caller can override
    // by parsing explicit star counts where available.
    let rating = 5;
    const text = (el.textContent || '').toLowerCase();
    if (text.includes("doesn't recommend") || text.includes('does not recommend')) {
      rating = 1;
    } else if (text.includes('recommend')) {
      rating = 5;
    } else {
      const starMatch = (el.getAttribute('aria-label') || '').match(/(\d) star/i)
        || text.match(/(\d)\s*stars?/i);
      if (starMatch) rating = Math.min(5, Math.max(1, parseInt(starMatch[1], 10)));
    }

    // Review body: largest text block, preferring the one following the name
    let review_text = '';
    const blocks = el.querySelectorAll('div[dir="auto"], span[dir="auto"]');
    let best = '';
    for (const b of blocks) {
      const txt = (b.textContent || '').trim();
      if (txt.length > best.length && txt.length < 3000 && txt !== reviewer_name) {
        best = txt;
      }
    }
    review_text = best.slice(0, 2000);

    // Business name: Page title in document
    const business_name = document.querySelector('h1')?.textContent?.trim().slice(0, 200) || '';

    return { reviewer_name, rating, review_text, business_name };
  }

  function scan() {
    for (const el of findReviews()) {
      // Only inject if the review has meaningful text
      if ((el.textContent || '').length < 30) continue;
      window.__reviewhub.injectButton({
        reviewEl: el,
        host: el,
        parseReview,
        platform: PLATFORM,
      });
    }
  }

  window.__reviewhub.observe(scan);
})();
