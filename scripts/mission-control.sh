#!/usr/bin/env bash
# Mission Control — generate a single self-contained HTML snapshot of
# ReviewHub's current state. Open in browser.
#
# What's in it:
#   - Operating queue (todo / blocked / done counts per section)
#   - Last 10 commits with timestamps
#   - Test status (last suite run; freshness from .git mtime)
#   - Memory files index
#   - Production health snapshot
#   - Free disk space
#
# Usage:
#   bash scripts/mission-control.sh > /tmp/mc.html && start /tmp/mc.html
#   (on Windows; on Mac use `open`, on Linux use `xdg-open`)

set -e
cd "$(git rev-parse --show-toplevel)"

QUEUE_FILE="docs/operating-queue.md"
WIKI_FILE="docs/reviewhub-wiki.md"

# ── Data gathering ──────────────────────────────────────────────────
branch=$(git branch --show-current)
last_commit=$(git log -1 --format='%h · %s · %ar' main 2>/dev/null || echo "?")
commits_today=$(git log --since='24 hours ago' --format='%h' main | wc -l | tr -d ' ')

todo=$(grep -c '`\[ \]`' "$QUEUE_FILE" 2>/dev/null | tr -d '\n' || echo "0")
blocked=$(grep -c '`\[wait:' "$QUEUE_FILE" 2>/dev/null | tr -d '\n' || echo "0")
done=$(grep -c '`\[done\]`' "$QUEUE_FILE" 2>/dev/null | tr -d '\n' || echo "0")

free_disk=$(df -h /c 2>/dev/null | awk 'NR==2 {print $4}' || echo "?")

# ── Production health (best-effort, 2s timeout) ─────────────────────
prod_health=$(curl -fsS -m 2 https://reviewhub.review/api/health 2>/dev/null || echo '{"status":"unreachable"}')
prod_status=$(echo "$prod_health" | grep -oE '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
prod_uptime=$(echo "$prod_health" | grep -oE '"uptime_seconds":[0-9]+' | head -1 | cut -d':' -f2)

# ── Recent commits (last 10) ───────────────────────────────────────
recent_commits=$(git log -10 --format='<tr><td><code>%h</code></td><td>%s</td><td>%ar</td></tr>' main 2>/dev/null)

# ── Memory files ────────────────────────────────────────────────────
memory_dir="$HOME/.claude/projects/C--Users-Computer-Desktop-App/memory"
memory_files=""
if [ -d "$memory_dir" ]; then
  memory_files=$(ls "$memory_dir" 2>/dev/null | grep -v '^MEMORY.md$' | while read f; do
    desc=$(grep -A1 '^description:' "$memory_dir/$f" 2>/dev/null | head -1 | sed 's/description: //')
    echo "<li><code>$f</code> — ${desc:-(no description)}</li>"
  done)
fi

# ── Per-section queue breakdown ─────────────────────────────────────
section_breakdown=""
if [ -f "$QUEUE_FILE" ]; then
  for sec in CODE WEB BUSINESS CUSTOMER OPS; do
    # Find the section heading line then count [ ] items until next ## heading
    count=$(awk -v s="## $sec" '
      $0 ~ s { in_sec=1; next }
      /^## / && in_sec { exit }
      in_sec && /`\[ \]`/ { c++ }
      END { print c+0 }
    ' "$QUEUE_FILE")
    blocked_in_sec=$(awk -v s="## $sec" '
      $0 ~ s { in_sec=1; next }
      /^## / && in_sec { exit }
      in_sec && /`\[wait:/ { c++ }
      END { print c+0 }
    ' "$QUEUE_FILE")
    section_breakdown+="<tr><td>$sec</td><td>$count</td><td>$blocked_in_sec</td></tr>"
  done
fi

# ── Render ─────────────────────────────────────────────────────────
cat <<HTML
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Mission Control · ReviewHub · $(date '+%Y-%m-%d %H:%M')</title>
<style>
  :root {
    --paper: #fbf8f1; --ink: #1d242c; --ink-2: #4a525a; --ink-3: #8b939c;
    --rule: #e8e3d6; --teal: #1e4d5e; --rose: #c2566c; --sage: #6b8e7a; --ochre: #c48a2c;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    background: var(--paper); color: var(--ink); padding: 32px 24px; line-height: 1.5;
    max-width: 1100px; margin: 0 auto;
  }
  h1 {
    font-family: 'Source Serif Pro', Georgia, serif; font-size: 36px; font-weight: 600;
    letter-spacing: -0.02em; margin-bottom: 4px;
  }
  .sub {
    font-family: ui-monospace, monospace; font-size: 11px; color: var(--ink-3);
    text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 32px;
  }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 32px; }
  .card {
    background: #fff; border: 1px solid var(--rule); border-radius: 10px; padding: 16px;
  }
  .card .label {
    font-family: ui-monospace, monospace; font-size: 10px; text-transform: uppercase;
    letter-spacing: 0.12em; color: var(--ink-3); margin-bottom: 6px;
  }
  .card .v { font-family: 'Source Serif Pro', Georgia, serif; font-size: 28px; font-weight: 600; line-height: 1; }
  .card.teal .v { color: var(--teal); }
  .card.sage .v { color: var(--sage); }
  .card.rose .v { color: var(--rose); }
  .card.ochre .v { color: var(--ochre); }
  section {
    background: #fff; border: 1px solid var(--rule); border-radius: 10px;
    padding: 20px; margin-bottom: 24px;
  }
  h2 {
    font-family: ui-monospace, monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; color: var(--ink-3); margin-bottom: 14px; font-weight: 700;
  }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--rule); }
  th { font-weight: 600; color: var(--ink-2); font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
  td:last-child { color: var(--ink-3); font-size: 13px; }
  td code { font-family: ui-monospace, monospace; font-size: 12px; color: var(--teal); }
  ul { padding-left: 20px; font-size: 13px; }
  ul li { margin-bottom: 6px; color: var(--ink-2); }
  ul li code { background: var(--paper); padding: 1px 6px; border-radius: 4px; font-size: 12px; color: var(--ink); }
  .footer {
    font-size: 11px; color: var(--ink-3); text-align: center; margin-top: 40px;
    font-family: ui-monospace, monospace;
  }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .pill.ok { background: rgba(107, 142, 122, 0.15); color: var(--sage); }
  .pill.bad { background: rgba(194, 86, 108, 0.15); color: var(--rose); }
</style>
</head>
<body>
  <h1>Mission Control</h1>
  <div class="sub">ReviewHub · $(date '+%Y-%m-%d %H:%M')</div>

  <!-- Top stats -->
  <div class="grid">
    <div class="card teal">
      <div class="label">Branch</div>
      <div class="v" style="font-size: 22px;">$branch</div>
    </div>
    <div class="card ochre">
      <div class="label">Queue · todo</div>
      <div class="v">$todo</div>
    </div>
    <div class="card rose">
      <div class="label">Queue · blocked</div>
      <div class="v">$blocked</div>
    </div>
    <div class="card sage">
      <div class="label">Queue · done</div>
      <div class="v">$done</div>
    </div>
    <div class="card">
      <div class="label">Commits / 24h</div>
      <div class="v">$commits_today</div>
    </div>
    <div class="card">
      <div class="label">Free disk (C:)</div>
      <div class="v" style="font-size: 22px;">$free_disk</div>
    </div>
    <div class="card">
      <div class="label">Production</div>
      <div class="v" style="font-size: 18px;">
        <span class="pill ${prod_status:+ok}${prod_status:-bad}">${prod_status:-DOWN}</span>
      </div>
      <div style="font-size: 11px; color: var(--ink-3); margin-top: 8px; font-family: ui-monospace, monospace;">
        ${prod_uptime:+uptime ${prod_uptime}s}
      </div>
    </div>
  </div>

  <!-- Queue per section -->
  <section>
    <h2>Operating queue · by section</h2>
    <table>
      <tr><th>Section</th><th>Todo</th><th>Blocked</th></tr>
      $section_breakdown
    </table>
    <div style="margin-top: 14px; font-size: 12px; color: var(--ink-3);">
      File: <code>docs/operating-queue.md</code> · Priority order: CUSTOMER → BUSINESS → CODE → WEB → OPS
    </div>
  </section>

  <!-- Recent commits -->
  <section>
    <h2>Last 10 commits on main</h2>
    <table>
      <tr><th>Hash</th><th>Message</th><th>When</th></tr>
      $recent_commits
    </table>
  </section>

  <!-- Memory -->
  <section>
    <h2>Long-term memory · ${memory_dir##*/}</h2>
    <ul>
      $memory_files
    </ul>
  </section>

  <div class="footer">
    Generated by <code>scripts/mission-control.sh</code> · re-run for fresh data · last commit: $last_commit
  </div>
</body>
</html>
HTML
