// ReviewHub Chrome extension popup — interactive drafting UI.
//
// Two screens:
//   #setup  — token-paste flow (unchanged from previous popup)
//   #main   — design-ported drafting UI: platform picker, review preview,
//             tone + language controls, generate-and-type-out reply
//
// The popup shows DEMO reviews by default — one per platform. This gives
// first-time users a rich place to try the AI before they've visited a
// real review page. The ✨ Draft button calls the real
// POST /api/extension/draft endpoint via the background service worker,
// so the quota + billing surfaces work identically to an inline click on
// Yelp / Facebook / TripAdvisor / etc.

const DEFAULT_API_BASE = 'https://reviewhub.review';
const TOKEN_PREFIX = 'rh_ext_';

// ─── Platform metadata (icon letter + brand color + demo date) ────────
const PLATFORMS = {
  google:      { name: 'Google',      color: '#4285F4', letter: 'G' },
  yelp:        { name: 'Yelp',        color: '#D32323', letter: 'Y' },
  facebook:    { name: 'Facebook',    color: '#1877F2', letter: 'F' },
  tripadvisor: { name: 'Tripadvisor', color: '#00AF87', letter: 'T' },
  trustpilot:  { name: 'Trustpilot',  color: '#00B67A', letter: 'T' },
  amazon:      { name: 'Amazon',      color: '#FF9900', letter: 'A' },
  etsy:        { name: 'Etsy',        color: '#F1641E', letter: 'E' },
};

const LANGUAGES = [
  { code: 'en', label: 'English',   flag: '🇺🇸' },
  { code: 'th', label: 'ไทย',        flag: '🇹🇭' },
  { code: 'es', label: 'Español',   flag: '🇪🇸' },
  { code: 'fr', label: 'Français',  flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch',   flag: '🇩🇪' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'it', label: 'Italiano',  flag: '🇮🇹' },
  { code: 'ja', label: '日本語',      flag: '🇯🇵' },
  { code: 'zh', label: '中文',        flag: '🇨🇳' },
  { code: 'ko', label: '한국어',      flag: '🇰🇷' },
];

const TONES = ['Friendly', 'Professional', 'Apologetic', 'Grateful'];

// Demo reviews — one per platform, varied star ratings and content. Lets
// new users experience the product before they've found a real review.
const REVIEWS = {
  google: {
    author: 'Sarah M.', avatarColor: '#fbbf24', stars: 5, date: '2 days ago',
    text: "Absolutely loved the oat-milk flat white! The barista remembered my order from last week — the kind of detail that makes a neighborhood café feel like home. Wi-Fi was fast too, got a ton of work done.",
    business: "Ember Coffee House",
  },
  yelp: {
    author: 'David K.', avatarColor: '#f87171', stars: 2, date: '1 week ago',
    text: "Waited 25 minutes for a table even though we had a reservation. Food was okay but by the time it arrived we had to rush to eat. Not the experience I was hoping for on our anniversary.",
    business: "Ember Coffee House",
  },
  facebook: {
    author: 'Priya R.', avatarColor: '#a78bfa', stars: 5, date: '3 days ago',
    text: "Best croissants in the city. Flaky, buttery, and always warm. The new matcha latte is incredible too — please never take it off the menu!",
    business: "Ember Coffee House",
  },
  tripadvisor: {
    author: 'James O.', avatarColor: '#60a5fa', stars: 4, date: '5 days ago',
    text: "Found this spot walking back from the museum and stayed for three hours. Great atmosphere, the staff were welcoming, and the avocado toast hit the spot. Only wish there were more outlets near the window seats.",
    business: "Ember Coffee House",
  },
  trustpilot: {
    author: 'Elena F.', avatarColor: '#34d399', stars: 5, date: 'yesterday',
    text: "Ordered beans online twice now and both shipments arrived within 48 hours. Packaging is beautiful and the Ethiopia single-origin is my new favorite.",
    business: "Ember Coffee House",
  },
  amazon: {
    author: 'M. Thompson', avatarColor: '#fb923c', stars: 3, date: '2 weeks ago',
    text: "Beans taste great but one of the bags in my subscription arrived with a torn seal. Contacted support and haven't heard back after 4 days. Giving 3 stars pending resolution.",
    business: "Ember Coffee House",
  },
  etsy: {
    author: 'Maya L.', avatarColor: '#f472b6', stars: 5, date: '4 days ago',
    text: "The hand-thrown mug arrived perfectly packaged and is even more beautiful in person. You can feel the care that went into it. Thank you!",
    business: "Ember Coffee House",
  },
};

// ─── Mutable state ────────────────────────────────────────────────────
const state = {
  platform: 'google',
  tone: 'Friendly',
  lang: 'en',
  phase: 'idle',   // idle | generating | ready | error
  draft: '',
  typed: '',
  errorMsg: '',
  quotaUsed: null,
  quotaMax: null,
};

// ─── DOM refs ─────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ─── Boot ─────────────────────────────────────────────────────────────
async function init() {
  const { token, apiBase } = await chrome.storage.local.get(['token', 'apiBase']);
  const base = apiBase || DEFAULT_API_BASE;
  $('apiBase').value = base;
  $('getTokenLink').href = base + '/settings';
  $('quota-upgrade').href = base + '/pricing';

  if (token && token.startsWith(TOKEN_PREFIX)) {
    showMain();
  } else {
    showSetup();
  }
}

function showSetup() {
  $('setup').hidden = false;
  $('main').hidden = true;
}
function showMain() {
  $('setup').hidden = true;
  $('main').hidden = false;
  renderAll();
}

// ─── Setup-screen handlers ────────────────────────────────────────────
$('connect').addEventListener('click', async () => {
  const tok = $('token').value.trim();
  if (!tok.startsWith(TOKEN_PREFIX)) {
    const err = $('setup-error');
    err.textContent = `Token should start with "${TOKEN_PREFIX}". Generate one in Settings → Browser Extension.`;
    err.hidden = false;
    return;
  }
  await chrome.storage.local.set({ token: tok });
  $('token').value = '';
  $('setup-error').hidden = true;
  showMain();
});

$('saveApi').addEventListener('click', async () => {
  const v = $('apiBase').value.trim();
  if (!v) return;
  await chrome.storage.local.set({ apiBase: v.replace(/\/$/, '') });
  $('saveApi').textContent = 'Saved ✓';
  setTimeout(() => { $('saveApi').textContent = 'Save'; }, 1500);
});

// ─── Main-screen rendering ────────────────────────────────────────────
function renderAll() {
  renderBanner();
  renderReviewCard();
  renderControls();
  renderActionArea();
}

function renderBanner() {
  const p = PLATFORMS[state.platform];
  const review = REVIEWS[state.platform];
  $('platform-name').textContent = p.name;
  const icon = $('platform-icon');
  icon.textContent = p.letter;
  icon.style.background = p.color;
  $('review-date').textContent = review.date;
}

function renderReviewCard() {
  const review = REVIEWS[state.platform];
  $('reviewer-name').textContent = review.author;
  const avatar = $('avatar');
  avatar.textContent = review.author.split(' ').map(s => s[0]).join('').slice(0, 2);
  avatar.style.background = review.avatarColor;

  const stars = $('stars');
  stars.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', '11');
    s.setAttribute('height', '11');
    s.setAttribute('viewBox', '0 0 16 16');
    s.setAttribute('fill', i <= review.stars ? '#f59e0b' : '#e5e7eb');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M8 1.5l1.9 4.2 4.6.4-3.5 3 1.1 4.5L8 11.2 3.9 13.6 5 9.1 1.5 6.1l4.6-.4L8 1.5z');
    s.appendChild(p);
    stars.appendChild(s);
  }
  $('stars-label').textContent = review.stars.toFixed(1);
  $('review-text').textContent = review.text;
}

function renderControls() {
  // Default tone based on sentiment
  if (state.phase === 'idle') {
    const r = REVIEWS[state.platform];
    if (r.stars <= 2) state.tone = 'Apologetic';
    else if (r.stars === 3) state.tone = 'Professional';
    else state.tone = 'Friendly';
  }

  // Tone segment
  const seg = $('tone-seg');
  seg.innerHTML = '';
  TONES.forEach(t => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tone-btn' + (t === state.tone ? ' active' : '');
    b.textContent = t;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', t === state.tone ? 'true' : 'false');
    b.addEventListener('click', () => {
      state.tone = t;
      resetDraftIfReady();
      renderControls();
    });
    seg.appendChild(b);
  });

  // Language pill
  const lang = LANGUAGES.find(l => l.code === state.lang);
  $('lang-flag').textContent = lang.flag;
  $('lang-name').textContent = lang.label;
}

function renderActionArea() {
  const gen = $('btn-generate');
  const generating = $('state-generating');
  const ready = $('state-ready');
  const err = $('state-error');

  gen.hidden = state.phase !== 'idle';
  generating.hidden = state.phase !== 'generating';
  ready.hidden = state.phase !== 'ready';
  err.hidden = state.phase !== 'error';

  if (state.phase === 'generating') {
    const lang = LANGUAGES.find(l => l.code === state.lang);
    $('gen-subtitle').textContent = `${state.tone.toLowerCase()} · ${lang.label} · reading the review`;
  }
  if (state.phase === 'ready') {
    $('draft-text').innerHTML = '';
    $('draft-text').appendChild(document.createTextNode(state.typed));
    if (state.typed.length < state.draft.length) {
      const cur = document.createElement('span');
      cur.className = 'cursor';
      $('draft-text').appendChild(cur);
    }
    $('char-count').textContent = `${state.draft.length} chars`;
  }
  if (state.phase === 'error') {
    $('error-msg').textContent = state.errorMsg;
  }

  // Quota footer
  if (state.quotaMax != null) {
    $('quota-used').textContent = state.quotaUsed ?? 0;
    $('quota-max').textContent = state.quotaMax;
    $('footer-quota').hidden = false;
  } else {
    // Unlimited plan — hide free-drafts text, keep upgrade link hidden too
    $('footer-quota').hidden = true;
  }
}

function resetDraftIfReady() {
  if (state.phase === 'ready') {
    state.phase = 'idle';
    state.draft = '';
    state.typed = '';
    renderActionArea();
  }
}

// ─── Platform dropdown ────────────────────────────────────────────────
$('btn-platform').addEventListener('click', () => {
  togglePlatformMenu();
});
function togglePlatformMenu() {
  const menu = $('platform-menu');
  const open = menu.hidden;
  // Close language menu if open
  $('lang-menu').hidden = true;
  if (!open) { menu.hidden = true; return; }

  menu.innerHTML = '';
  Object.entries(PLATFORMS).forEach(([id, p]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dropdown-item' + (id === state.platform ? ' active' : '');
    b.innerHTML = `<span class="platform-icon" style="background:${p.color}">${p.letter}</span>${p.name}`;
    b.addEventListener('click', () => {
      state.platform = id;
      menu.hidden = true;
      resetDraftIfReady();
      renderAll();
    });
    menu.appendChild(b);
  });
  menu.hidden = false;
}

// ─── Language dropdown ────────────────────────────────────────────────
$('btn-lang').addEventListener('click', () => {
  toggleLangMenu();
});
function toggleLangMenu() {
  const menu = $('lang-menu');
  const open = menu.hidden;
  $('platform-menu').hidden = true;
  if (!open) { menu.hidden = true; return; }

  menu.innerHTML = '';
  LANGUAGES.forEach(l => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dropdown-item' + (l.code === state.lang ? ' active' : '');
    b.innerHTML = `<span class="lang-flag">${l.flag}</span>${l.label}`;
    b.addEventListener('click', () => {
      state.lang = l.code;
      menu.hidden = true;
      resetDraftIfReady();
      renderControls();
    });
    menu.appendChild(b);
  });
  menu.hidden = false;
}

// ─── Generate (calls real API via background service worker) ─────────
$('btn-generate').addEventListener('click', () => {
  generateDraft();
});

async function generateDraft() {
  state.phase = 'generating';
  state.draft = '';
  state.typed = '';
  renderActionArea();

  const review = REVIEWS[state.platform];
  const startedAt = Date.now();
  const tickEl = $('elapsed');
  const tickInterval = setInterval(() => {
    const e = Math.min(9.9, (Date.now() - startedAt) / 1000);
    tickEl.textContent = `${e.toFixed(1)}s`;
  }, 80);

  try {
    const payload = {
      platform: state.platform,
      reviewer_name: review.author,
      rating: review.stars,
      review_text: review.text,
      business_name: review.business,
      // Note: tone + language are hints in the prompt; the real server
      // currently uses review sentiment + language passthrough, not an
      // explicit tone parameter. A future update to /extension/draft
      // can accept `tone` + `lang` directly.
    };
    const response = await chrome.runtime.sendMessage({
      type: 'DRAFT_REPLY',
      payload,
    });
    clearInterval(tickInterval);

    if (!response?.ok) {
      state.phase = 'error';
      if (response?.error === 'NOT_CONFIGURED') {
        state.errorMsg = 'Paste your extension token in the popup to connect.';
      } else if (response?.status === 402) {
        const q = response.quota;
        state.errorMsg = `Free-plan quota reached${q ? ` (${q.used}/${q.max})` : ''}. Upgrade to Solo for unlimited drafts.`;
        if (q) { state.quotaUsed = q.used; state.quotaMax = q.max; }
      } else {
        state.errorMsg = response?.error || 'Couldn\'t generate a draft right now.';
      }
      renderActionArea();
      return;
    }

    state.draft = response.draft || '';
    state.typed = '';
    state.phase = 'ready';
    renderActionArea();

    // Typewriter — approximately the speed the design shows
    const target = state.draft;
    let i = 0;
    const id = setInterval(() => {
      i += Math.max(1, Math.round(target.length / 90));
      if (i >= target.length) {
        state.typed = target;
        renderActionArea();
        clearInterval(id);
      } else {
        state.typed = target.slice(0, i);
        renderActionArea();
      }
    }, 22);
  } catch (err) {
    clearInterval(tickInterval);
    state.phase = 'error';
    state.errorMsg = err?.message || 'Network error';
    renderActionArea();
  }
}

// Copy
$('btn-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(state.draft);
    const btn = $('btn-copy');
    btn.classList.add('copied');
    $('btn-copy-text').textContent = `Copied — paste into ${PLATFORMS[state.platform].name}`;
    setTimeout(() => {
      btn.classList.remove('copied');
      $('btn-copy-text').textContent = 'Copy reply';
    }, 1800);
  } catch { /* noop */ }
});

// Regenerate
$('btn-regen').addEventListener('click', () => {
  generateDraft();
});

// Settings icon → disconnect (back to setup screen)
$('btn-settings').addEventListener('click', async () => {
  if (!window.confirm('Disconnect this extension? You\'ll need to paste your token again.')) return;
  await chrome.storage.local.remove('token');
  showSetup();
});

// Click-outside closes dropdowns
document.addEventListener('click', (e) => {
  if (!$('main') || $('main').hidden) return;
  const inPlatform = e.target.closest('#btn-platform, #platform-menu');
  const inLang = e.target.closest('#btn-lang, #lang-menu');
  if (!inPlatform) $('platform-menu').hidden = true;
  if (!inLang) $('lang-menu').hidden = true;
}, true);

init();
