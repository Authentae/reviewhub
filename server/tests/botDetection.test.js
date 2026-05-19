// Tests for lib/botDetection.js — the UA filter used by /audit-preview/:token
// to distinguish a real human viewer from a link-preview crawler.
//
// Critical because false positives directly degrade founder trust:
//   - false negative: a Slack-paste preview-fetch fires "prospect opened
//     your audit" → founder thinks the lead engaged → wastes follow-up
//   - false positive: a real human flagged as bot → no notification →
//     founder misses the warm moment to follow up
//
// The module deliberately leans conservative (more false-positives, fewer
// false-negatives) so the founder's "someone opened it" channel stays
// high-signal even at the cost of some missed real-human notifications.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { isLikelyBot } = require('../src/lib/botDetection');

describe('isLikelyBot — known preview-bot user agents', () => {
  // Real UA strings observed in production access logs. Each MUST match.
  const REAL_BOT_UAS = [
    ['Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)', 'Slack link preview'],
    ['Twitterbot/1.0', 'Twitter card fetcher'],
    ['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'Facebook OG fetcher'],
    ['LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)', 'LinkedIn'],
    ['WhatsApp/2.21.12.21 A', 'WhatsApp link preview'],
    ['TelegramBot (like TwitterBot)', 'Telegram preview'],
    ['Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)', 'Discord'],
    ['Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)', 'iMessage'],
    ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Google'],
    ['Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', 'Bing'],
    ['DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)', 'DuckDuckGo'],
    ['Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)', 'Yandex'],
    ['Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)', 'Baidu'],
    ['Mozilla/5.0 (compatible; Pinterestbot/1.0; +http://www.pinterest.com/bot.html)', 'Pinterest'],
    ['Mozilla/5.0 (compatible; redditbot/1.0)', 'Reddit'],
    ['embedly/0.5', 'Embedly'],
    ['iframely/0.9.0', 'Iframely'],
    ['http.rb/4.4.1 (Mastodon/3.4.6; +https://mastodon.social/)', 'Mastodon preview'],
    ['SkypeUriPreview Preview/0.5', 'Skype preview'],
  ];

  for (const [ua, label] of REAL_BOT_UAS) {
    test(`flags as bot: ${label}`, () => {
      assert.strictEqual(isLikelyBot(ua), true, `expected bot for: ${ua}`);
    });
  }
});

describe('isLikelyBot — generic patterns catch long-tail crawlers', () => {
  const GENERIC_BOTS = [
    'CustomMonitoringBot/1.0',           // bot
    'WebCrawler/2.0',                    // crawl
    'GenericSpider/1.0',                 // spider
    'LinkPreviewService/3.0',            // preview
    'HeadlessChrome/100.0',              // headless
    'UptimeCheck/1.0',                   // uptime
    'CustomFetcher/1.0',                 // fetch
    'WebsiteScraper/2.0',                // scrape
    'SiteMonitoring/1.0',                // monitoring
  ];

  for (const ua of GENERIC_BOTS) {
    test(`flags by pattern: "${ua}"`, () => {
      assert.strictEqual(isLikelyBot(ua), true);
    });
  }

  test('case-insensitive — "BOT" in caps matches', () => {
    assert.strictEqual(isLikelyBot('SOMEBOT/1.0'), true);
  });
});

describe('isLikelyBot — real browser UAs are NOT flagged', () => {
  // Real UAs from genuine human visitors. Each MUST be classified human.
  // If any of these start failing, founder notifications get suppressed
  // for real prospects who actually opened the audit link.
  const REAL_HUMAN_UAS = [
    // Chrome Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // Chrome Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // Safari iPhone
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    // Firefox Linux
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    // Edge Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    // Chrome Android
    'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  ];

  for (const ua of REAL_HUMAN_UAS) {
    test(`classifies as human: ${ua.slice(0, 50)}...`, () => {
      assert.strictEqual(isLikelyBot(ua), false, `expected human for: ${ua}`);
    });
  }
});

describe('isLikelyBot — missing or invalid UA', () => {
  test('empty string is treated as bot (no real browser omits UA)', () => {
    assert.strictEqual(isLikelyBot(''), true);
  });

  test('null is treated as bot', () => {
    assert.strictEqual(isLikelyBot(null), true);
  });

  test('undefined is treated as bot', () => {
    assert.strictEqual(isLikelyBot(undefined), true);
  });

  test('non-string (number) is treated as bot — defensive', () => {
    assert.strictEqual(isLikelyBot(12345), true);
  });

  test('non-string (object) is treated as bot — defensive', () => {
    assert.strictEqual(isLikelyBot({ ua: 'fake' }), true);
  });
});
