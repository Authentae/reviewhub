#!/usr/bin/env node
/**
 * scripts/wave-diagnostic.mjs
 *
 * Wave-N result-harvest diagnostic. Consumes:
 *   1. A wave manifest at docs/outreach/wave-<N>-manifest.json
 *      (structured roster: prospects[].business_name + .vertical)
 *   2. The /api/admin/outreach-stats JSON response
 *      (per-audit view counts + reply markers + timestamps)
 *
 * Produces a human-readable report showing per-vertical:
 *   - sent / opened / replied counts and rates
 *   - per-prospect status (open / unopened / replied)
 *   - recommended action keyed to wave-N-outcomes-tree.md
 *
 * Why this exists:
 * /api/admin/outreach-stats lists ALL audits — Wave 5's 14 prospects
 * are interleaved with prior waves + product test rows. Spotting
 * "Wave 5 = 8/14 opened, 0/14 replied" by eye is hard. This makes
 * Wave 5 result-harvest a 30-second task instead of a 30-minute one.
 *
 * Usage:
 *   # Drive Chrome MCP to /admin/outreach-stats, save the JSON, then:
 *   node scripts/wave-diagnostic.mjs --wave=5 --stats=tmp/outreach-stats.json
 *
 *   # Or pipe directly (e.g. from a curl with cookie):
 *   curl -s --cookie-jar - https://reviewhub.review/api/admin/outreach-stats \
 *     | node scripts/wave-diagnostic.mjs --wave=5 --stats=-
 *
 * Output:
 *   - stdout: human-readable report
 *   - tmp/wave-diagnostic/wave-<N>-<timestamp>.md (archived)
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'tmp', 'wave-diagnostic');

function parseArgs() {
  const flags = process.argv.slice(2);
  const wave = (flags.find(f => f.startsWith('--wave=')) || '--wave=5').split('=')[1];
  const stats = (flags.find(f => f.startsWith('--stats=')) || '--stats=').split('=')[1];
  if (!stats) {
    console.error('Usage: node scripts/wave-diagnostic.mjs --wave=<N> --stats=<path-or-->');
    process.exit(1);
  }
  return { wave, stats };
}

async function readJsonStream(path) {
  if (path === '-') {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

// Normalise business names for matching. Outreach-stats stores whatever
// the audit-preview was created with; manifest uses Earth's canonical
// spelling. Tolerate punctuation, casing, whitespace.
function normaliseName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[‘’“”'"]/g, '')
    .replace(/[^a-z0-9ก-๛]+/g, ' ')
    .trim();
}

function classifyProspect(audit) {
  if (!audit) return 'unsent';
  if (audit.marked_as_replied_at) return 'replied';
  if ((audit.view_count || 0) > 0) return 'opened';
  return 'unopened';
}

function pct(n, d) {
  if (!d) return '—';
  return Math.round((n / d) * 100) + '%';
}

async function main() {
  const { wave, stats } = parseArgs();
  await mkdir(OUT_DIR, { recursive: true });

  const manifestPath = path.join(ROOT, 'docs', 'outreach', `wave-${wave}-manifest.json`);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const statsJson = await readJsonStream(stats);

  if (!statsJson.audits) {
    console.error(`stats JSON missing 'audits' array. Are you sure this is /api/admin/outreach-stats output?`);
    process.exit(1);
  }

  // Build a fuzzy lookup of audits by business name. Multiple audits
  // per business possible (re-sent audit-preview) — pick the most-
  // recently-viewed if dup.
  const auditMap = new Map();
  for (const a of statsJson.audits) {
    const key = normaliseName(a.business_name);
    const existing = auditMap.get(key);
    if (!existing) auditMap.set(key, a);
    else {
      // Prefer the one with the more-recent activity
      const aTs = a.last_viewed_at || a.first_viewed_at || a.created_at;
      const eTs = existing.last_viewed_at || existing.first_viewed_at || existing.created_at;
      if (aTs > eTs) auditMap.set(key, a);
    }
  }

  // Match manifest prospects to audits
  const matched = manifest.prospects.map(p => {
    const audit = auditMap.get(normaliseName(p.business_name));
    return { ...p, audit, status: classifyProspect(audit) };
  });

  // Per-vertical roll-up
  const verticals = {};
  for (const m of matched) {
    const v = m.vertical;
    if (!verticals[v]) verticals[v] = { sent: 0, opened: 0, replied: 0, unopened: 0, unsent: 0, prospects: [] };
    verticals[v].prospects.push(m);
    if (m.status === 'replied') { verticals[v].sent++; verticals[v].opened++; verticals[v].replied++; }
    else if (m.status === 'opened')  { verticals[v].sent++; verticals[v].opened++; }
    else if (m.status === 'unopened'){ verticals[v].sent++; verticals[v].unopened++; }
    else                              { verticals[v].unsent++; }
  }

  // Overall
  const overall = {
    expected: manifest.expected_total,
    sent: matched.filter(m => m.status !== 'unsent').length,
    opened: matched.filter(m => m.status === 'opened' || m.status === 'replied').length,
    replied: matched.filter(m => m.status === 'replied').length,
    unopened: matched.filter(m => m.status === 'unopened').length,
    unsent: matched.filter(m => m.status === 'unsent').length,
  };

  // Action recommendation per Wave 5's outcomes tree shape
  // (cribbed from wave-4-outcomes-tree.md but specific to a multi-
  // vertical 4-arm test)
  function recommendAction() {
    if (overall.replied >= 1) {
      return [
        '🎉 **REPLY CONFIRMED — execute first-customer playbook.**',
        '',
        '1. Drop everything else.',
        '2. Hour-0 ack within 30 min (3-sentence reply).',
        '3. Run `docs/skills/first-customer-playbook.md`.',
        '4. Note the vertical that converted in `docs/reviewhub-wiki.md`.',
        '5. If multiple verticals replied, the vertical with the highest CONVERSION (not just reply rate) wins — schedule follow-ups with the others but prioritise the converter.',
      ].join('\n');
    }
    if (overall.opened === 0 && overall.sent > 0) {
      return [
        '🚨 **0 opens across all sent — deliverability regressed.**',
        '',
        'Wave 1-4 hit 35% open rate; Wave 5 at 0% means something broke since 2026-05-13 mail-tester confirmation.',
        '',
        '1. Re-run mail-tester from `earth.reviewhub@gmail.com`.',
        '2. Check Gmail sent folder for bounce notifications.',
        '3. Check spam-flagging via Google Postmaster Tools.',
        '4. If clean → check sender reputation deteriorated (sent ~50 cold in 2 weeks).',
      ].join('\n');
    }
    if (overall.opened > 0 && overall.replied === 0) {
      const byVertical = Object.entries(verticals)
        .map(([v, d]) => `${v}: ${d.opened}/${d.sent} opened (${pct(d.opened, d.sent)}), ${d.replied} replied`)
        .join('  ·  ');
      return [
        '⚠️ **Opens but no replies — same pattern as Waves 1-4. Pitch/offer problem confirmed across multiple verticals.**',
        '',
        `By vertical: ${byVertical}`,
        '',
        'The hypothesis that audience-fit was the issue is now CLOSER to falsified. Strong signal that the offer / CTA / audit-preview is the conversion bottleneck, not the audience.',
        '',
        '**Next moves (pick ONE — these are mutually-exclusive bets):**',
        '',
        '1. **Send Wave 5 followups** (Tue 2026-05-26, +7 days). One follow-up, soft ask, "did you have a chance to look?" — industry recovery is 30-50% so this could surface 1-2 replies. See `docs/wave-postmortems/wave-5-followup-template.md`.',
        '',
        '2. **Audit-preview CTA rewrite** — the bottleneck is the audit page, not the cold email. A/B variants on the "Generate replies" CTA, the price-anchor, the "Connect Google" friction. Then re-send 5-10 prospects with the rewritten audit.',
        '',
        '3. **Channel pivot** — email may not be the channel. LINE OA outbound (Earth-managed list) + warm intros from existing network. Higher per-prospect effort but reply-rate compounds.',
        '',
        '4. **Vertical-double-down on the highest-opener** (' + Object.entries(verticals).sort((a,b) => (b[1].opened/b[1].sent || 0) - (a[1].opened/a[1].sent || 0))[0]?.[0] + '). Send 10-15 more in that vertical with a SHARPENED pitch for that segment.',
        '',
        'Default if undecided: **#2 (audit-preview CTA rewrite)** — fastest learning loop, doesn\'t need new prospects, validates whether the bottleneck is upstream of the email.',
      ].join('\n');
    }
    if (overall.unsent > 0 && overall.sent === 0) {
      return [
        '⏸️ **0 sends matched manifest — either (a) Wave 5 hasn\'t fired yet, (b) business_names in manifest don\'t match audit_previews rows, or (c) the wrong outreach-stats JSON was supplied.**',
        '',
        '1. Confirm send timestamps: `grep "Wave 5\\|2026-05-19\\|2026-05-20" docs/outreach/*.md`.',
        '2. Verify audit-preview business_names — open one Wave 5 prospect\'s audit URL and check the heading. Compare to manifest.',
        '3. If naming drift, update `docs/outreach/wave-5-manifest.json` business_name strings to match.',
      ].join('\n');
    }
    return '_Indeterminate state — manual review of per-prospect table below._';
  }

  // Markdown output
  const lines = [
    `# Wave ${wave} diagnostic — ${new Date().toISOString()}`,
    '',
    `Manifest: \`docs/outreach/wave-${wave}-manifest.json\` (${manifest.prospects.length} prospects)`,
    `Stats source: \`${stats === '-' ? 'stdin' : stats}\` (${statsJson.audits.length} total audits, ${statsJson.summary?.total ?? '?'} reported in summary)`,
    '',
    '## Overall',
    '',
    `| Metric | Count | Rate |`,
    `|---|---:|---:|`,
    `| Manifest prospects | ${manifest.prospects.length} | — |`,
    `| Matched in DB (sent) | ${overall.sent} | ${pct(overall.sent, manifest.prospects.length)} |`,
    `| Opened audit URL | ${overall.opened} | ${pct(overall.opened, overall.sent)} of sent |`,
    `| Replied | ${overall.replied} | ${pct(overall.replied, overall.opened)} of opened |`,
    `| Opened-no-reply | ${overall.opened - overall.replied} | ${pct(overall.opened - overall.replied, overall.sent)} of sent |`,
    `| Unopened | ${overall.unopened} | ${pct(overall.unopened, overall.sent)} of sent |`,
    `| Unmatched in manifest | ${overall.unsent} | — |`,
    '',
    '## By vertical',
    '',
    '| Vertical | Sent | Opened | Reply | Open rate | Reply rate |',
    '|---|---:|---:|---:|---:|---:|',
    ...Object.entries(verticals).map(([v, d]) =>
      `| ${v} | ${d.sent}${d.unsent ? ` (${d.unsent} unsent)` : ''} | ${d.opened} | ${d.replied} | ${pct(d.opened, d.sent)} | ${pct(d.replied, d.sent)} |`
    ),
    '',
    '## Per-prospect',
    '',
    '| Vertical | Business | Status | Views | First viewed | Hours since sent |',
    '|---|---|---|---:|---|---:|',
    ...matched.map(m => {
      const a = m.audit;
      const statusEmoji = m.status === 'replied' ? '🎉 replied' :
                          m.status === 'opened'  ? '✅ opened' :
                          m.status === 'unopened'? '⚪ unopened' :
                                                   '❓ unmatched';
      return `| ${m.vertical} | ${m.business_name} | ${statusEmoji} | ${a?.view_count ?? '—'} | ${a?.first_viewed_at ?? '—'} | ${a?.hours_since_sent ?? '—'} |`;
    }),
    '',
    '## Recommended action',
    '',
    recommendAction(),
    '',
    '## Followup candidates (opened-no-reply)',
    '',
    ...(() => {
      const candidates = matched.filter(m => m.status === 'opened');
      if (candidates.length === 0) return ['_None — no opened-no-reply prospects yet._'];
      return [
        'These prospects opened the audit URL but didn\'t reply. They\'re the best followup candidates per industry pattern (30-50% recovery on one followup):',
        '',
        ...candidates.map(c => `- **${c.business_name}** (${c.vertical}) — ${c.audit?.view_count} views, last viewed ${c.audit?.last_viewed_at ?? '?'}. Email: \`${c.email}\``),
        '',
        'Use `docs/wave-postmortems/wave-5-followup-template.md` — reply to original thread, soft ask, "ไม่ใช่" / "not a fit" framed as valid response.',
      ];
    })(),
  ];

  const md = lines.join('\n');
  console.log(md);

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(OUT_DIR, `wave-${wave}-${ts}.md`);
  await writeFile(out, md);
  console.log(`\n_Report archived to ${out}_`);
}

main().catch(err => {
  console.error('Wave diagnostic failed:', err);
  process.exit(2);
});
