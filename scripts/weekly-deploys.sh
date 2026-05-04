#!/usr/bin/env bash
# Weekly deploys auto-summary.
#
# Diffs main vs 7-days-ago main, groups commits by domain (auth / dashboard
# / billing / etc.), and surfaces behavior-changing commits separately from
# refactors and tests. Designed for a Sunday-morning read.
#
# Usage:
#   bash scripts/weekly-deploys.sh                # last 7 days
#   bash scripts/weekly-deploys.sh 14             # last N days
#   bash scripts/weekly-deploys.sh 7 --markdown   # markdown output (for blog)
#
# Output is plain text by default — designed to fit in one screen of
# `less` when piped. Use --markdown for /changelog candidates.

set -e

DAYS="${1:-7}"
FORMAT="text"
[ "$2" = "--markdown" ] && FORMAT="markdown"

cd "$(git rev-parse --show-toplevel)"

since=$(git log --since="$DAYS days ago" -1 --format='%H' main 2>/dev/null || echo "")
if [ -z "$since" ]; then
  echo "No commits in the last $DAYS days on main. Nothing to summarize."
  exit 0
fi

# Group commits by the prefix before the colon: "auth: fix X" → "auth"
# Commits without a prefix go to "misc".
total=$(git log --since="$DAYS days ago" --format='%h' main | wc -l)
contributors=$(git log --since="$DAYS days ago" --format='%an' main | sort -u | wc -l)

# Header
if [ "$FORMAT" = "markdown" ]; then
  echo "# Weekly deploy summary — last $DAYS days"
  echo ""
  echo "**$total commits** by $contributors contributor(s)."
  echo ""
else
  echo "═══════════════════════════════════════════════════════════"
  echo " WEEKLY DEPLOYS — LAST $DAYS DAYS"
  echo "═══════════════════════════════════════════════════════════"
  echo " $total commits by $contributors contributor(s)"
  echo ""
fi

# Group commits by prefix
declare -A groups
declare -A group_msgs
while IFS=$'\t' read -r hash msg; do
  prefix=$(echo "$msg" | grep -oE '^[a-zA-Z0-9_/-]+:' | head -1 | tr -d ':')
  prefix="${prefix:-misc}"
  groups[$prefix]=$((${groups[$prefix]:-0} + 1))
  group_msgs[$prefix]+="${hash} ${msg}"$'\n'
done < <(git log --since="$DAYS days ago" --format='%h%x09%s' main)

# Sorted list of prefixes — by count desc
sorted_prefixes=$(for p in "${!groups[@]}"; do
  echo "${groups[$p]}|$p"
done | sort -rn | cut -d'|' -f2)

# Categorize: behavior-changing ("auth", "billing", "dashboard", "reviews",
# "test/infra/docs/chore" go to "internal")
INTERNAL_PREFIXES="test docs chore infra build deps refactor style ci"

if [ "$FORMAT" = "markdown" ]; then
  echo "## Customer-facing"
  echo ""
fi

for p in $sorted_prefixes; do
  is_internal=0
  for ip in $INTERNAL_PREFIXES; do
    [ "$p" = "$ip" ] && is_internal=1
  done
  [ "$is_internal" = "1" ] && continue

  count="${groups[$p]}"
  if [ "$FORMAT" = "markdown" ]; then
    echo "### $p ($count)"
    echo "${group_msgs[$p]}" | sed 's/^/- /'
    echo ""
  else
    printf "  %-12s %3d  " "$p" "$count"
    # Show first commit msg as a teaser
    first=$(echo "${group_msgs[$p]}" | head -1 | cut -c1-60)
    echo "  └─ $first…"
  fi
done

if [ "$FORMAT" = "markdown" ]; then
  echo ""
  echo "## Internal (tests, docs, infra)"
  echo ""
else
  echo ""
  echo " Internal (tests/docs/infra):"
fi

for p in $sorted_prefixes; do
  is_internal=0
  for ip in $INTERNAL_PREFIXES; do
    [ "$p" = "$ip" ] && is_internal=1
  done
  [ "$is_internal" = "0" ] && continue

  count="${groups[$p]}"
  if [ "$FORMAT" = "markdown" ]; then
    echo "- $p ($count)"
  else
    printf "  %-12s %3d\n" "$p" "$count"
  fi
done

if [ "$FORMAT" = "text" ]; then
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo " For full markdown (paste into /changelog or blog):"
  echo "   bash scripts/weekly-deploys.sh $DAYS --markdown"
  echo "═══════════════════════════════════════════════════════════"
fi
