#!/usr/bin/env node
// Outreach pre-send validator. Runs the machine-checkable subset of
// docs/skills/outreach-pre-send.md against an email-text file. Exits
// 0 if all checks pass, 1 with detailed errors if any fail.
//
// Usage:
//   node scripts/validate-outreach.js path/to/email.txt
//
// Email file format: simple structured text with headers and body:
//
//   To: prospect@example.com
//   From: earth.reviewhub@gmail.com
//   Subject: Loftel 22 Hostel — ติดตามสั้นๆ
//   Type: followup    (one of: cold | followup | customer-dev | warm)
//   ---
//   <body text here>
//
// The validator checks:
//   §1.1 From identity (earth.reviewhub, never theearth1659)
//   §1.3 Length per type (cold ≤200, followup ≤150, custdev ≤100, warm ≤80)
//   §2.1 URL HTTP 200 (every http(s):// in body must return 200)
//   §2.2 Recipient address format (basic regex)
//   §2.3 Placeholder replacement (no {{...}} or {brackets} left)
//   §2.5 From-account = earth.reviewhub
//
// Items requiring human judgment (voice, language match, tone, timing)
// are NOT mechanized; they stay in docs/skills/outreach-pre-send.md.
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

if (process.argv.length < 3) {
  console.error('Usage: node scripts/validate-outreach.js <path/to/email.txt>');
  process.exit(2);
}

const file = process.argv[2];
const raw = fs.readFileSync(file, 'utf8');

// Parse simple header/body format
const sep = raw.indexOf('\n---\n');
if (sep < 0) {
  console.error(`❌ ${file}: missing "---" separator between headers and body`);
  process.exit(1);
}
const headerBlock = raw.slice(0, sep);
const body = raw.slice(sep + 5);

const headers = {};
for (const line of headerBlock.split('\n')) {
  const m = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/);
  if (m) headers[m[1].toLowerCase()] = m[2].trim();
}

const errors = [];
const warnings = [];

// §1.1 + §2.5: from identity
const fromAddr = (headers.from || '').toLowerCase();
if (!fromAddr) {
  errors.push('FROM  missing "From:" header');
} else if (fromAddr === 'theearth1659@gmail.com') {
  errors.push('FROM  is theearth1659@gmail.com (personal account) — must be earth.reviewhub@gmail.com (brand) per CLAUDE.md identity rule');
} else if (fromAddr !== 'earth.reviewhub@gmail.com') {
  warnings.push(`FROM  is "${fromAddr}" — usually should be earth.reviewhub@gmail.com for outreach`);
}

// §2.2: recipient address format
const toAddr = headers.to || '';
if (!toAddr) {
  errors.push('TO  missing "To:" header');
} else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toAddr)) {
  errors.push(`TO  invalid email address format: "${toAddr}"`);
}

// §1.3: word/char count by type
const type = (headers.type || 'cold').toLowerCase();
const wordCount = body.trim().split(/\s+/).length;
const limits = {
  cold:          { max: 200, label: 'cold first-touch' },
  followup:      { max: 150, label: 'follow-up' },
  'customer-dev': { max: 100, label: 'customer-dev' },
  warm:          { max:  80, label: 'warm reply' },
};
const limit = limits[type];
if (!limit) {
  errors.push(`TYPE  unknown "Type: ${type}" — must be one of: cold, followup, customer-dev, warm`);
} else if (wordCount > limit.max) {
  errors.push(`LENGTH  ${wordCount} words exceeds ${limit.max} for ${limit.label}`);
}

// §2.3: placeholder replacement
const placeholders = body.match(/\{\{?[a-zA-Z_][a-zA-Z0-9_]*\}?\}/g);
if (placeholders) {
  errors.push(`PLACEHOLDER  unreplaced template variables: ${placeholders.join(', ')}`);
}

// §2.1: URL HTTP 200 (async — collect URLs first, check after)
const urls = [...new Set(body.match(/https?:\/\/[^\s<>"')]+/g) || [])];

async function checkUrl(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'HEAD', timeout: 15000 }, (res) => {
      // Follow one redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return checkUrl(new URL(res.headers.location, url).href).then(resolve);
      }
      resolve({ url, status: res.statusCode });
    });
    req.on('error', (err) => resolve({ url, status: 0, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ url, status: 0, error: 'timeout' }); });
    req.end();
  });
}

(async () => {
  const urlResults = await Promise.all(urls.map(checkUrl));
  for (const r of urlResults) {
    if (r.status === 200) continue;
    if (r.status === 0) {
      errors.push(`URL  ${r.url} — request failed (${r.error || 'no response'})`);
    } else if (r.status === 403 || r.status === 429) {
      warnings.push(`URL  ${r.url} — got ${r.status}; may be Cloudflare/bot-protection. Manually verify before send.`);
    } else {
      errors.push(`URL  ${r.url} — status ${r.status}, expected 200`);
    }
  }

  // Print results
  console.log(`\nValidating: ${path.basename(file)}`);
  console.log(`  Type:       ${type}`);
  console.log(`  From:       ${fromAddr || '(missing)'}`);
  console.log(`  To:         ${toAddr || '(missing)'}`);
  console.log(`  Subject:    ${headers.subject || '(missing)'}`);
  console.log(`  Word count: ${wordCount}${limit ? ` / ${limit.max}` : ''}`);
  console.log(`  URLs:       ${urls.length} found, ${urlResults.filter(r => r.status === 200).length} return 200`);

  if (warnings.length) {
    console.log('\n⚠ Warnings:');
    for (const w of warnings) console.log(`  - ${w}`);
  }
  if (errors.length) {
    console.log('\n❌ Errors:');
    for (const e of errors) console.log(`  - ${e}`);
    console.log('\nDo NOT queue this draft. Fix errors and re-run.');
    process.exit(1);
  } else {
    console.log('\n✓ All machine-checkable rules pass.');
    console.log('  Reminder: voice, language match, tone, and timing are NOT machine-checked.');
    console.log('  See docs/skills/outreach-pre-send.md §1 for the human-judgment rules.');
    process.exit(0);
  }
})();
