// ReviewHub extension — background service worker.
//
// Responsibilities:
//   - Hold the API endpoint configuration (prod vs dev)
//   - Proxy /api/extension/draft requests from content scripts, injecting the
//     user's saved extension token. Content scripts can't access extension
//     storage directly in MV3 without passing through a message to the
//     service worker, which is the pattern we use here.
//   - Never store the token on any page's window/localStorage — only in
//     chrome.storage.local, which is isolated per extension.

const DEFAULT_API_BASE = 'https://reviewhub.app';

async function getConfig() {
  const { apiBase, token } = await chrome.storage.local.get(['apiBase', 'token']);
  return {
    apiBase: apiBase || DEFAULT_API_BASE,
    token: token || null,
  };
}

// On first install, open the welcome/onboarding page in a new tab.
// Skipped on updates so we don't nag returning users on every release.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
});

// Listen to messages from content scripts + popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'DRAFT_REPLY') {
    handleDraft(msg.payload).then(sendResponse).catch((err) => {
      sendResponse({ ok: false, error: err?.message || 'Unknown error' });
    });
    return true; // async
  }
  if (msg?.type === 'GET_STATUS') {
    getConfig().then((cfg) => sendResponse({
      connected: !!cfg.token,
      apiBase: cfg.apiBase,
    }));
    return true;
  }
});

async function handleDraft(payload) {
  const { apiBase, token } = await getConfig();
  if (!token) {
    return { ok: false, error: 'NOT_CONFIGURED', message: 'Paste your extension token in the popup first.' };
  }

  try {
    const res = await fetch(`${apiBase}/api/extension/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: body.error || `HTTP ${res.status}`,
        upgradeTo: body.upgradeTo,
        quota: body.quota,
      };
    }
    return { ok: true, draft: body.draft, source: body.source, platform: body.platform };
  } catch (err) {
    return { ok: false, error: err?.message || 'Network error' };
  }
}
