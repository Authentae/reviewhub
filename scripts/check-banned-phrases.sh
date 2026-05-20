#!/usr/bin/env bash
# scripts/check-banned-phrases.sh
#
# Pre-commit / CI guard against marketing copy that contradicts what we
# actually deliver today. Greps the codebase for known-stale phrases and
# fails the build if any are present.
#
# WHY THIS EXISTS:
# On 2026-05-16 the Landing hero said "from LINE" the day after we
# shipped Telegram. The whole-page audit missed it because the headline
# lived in translations.js, outside the per-page scan. This lint catches
# anything in the banlist regardless of which file it's in.
#
# WHEN TO UPDATE THIS LIST:
#  - A feature SHIPS: remove its banned phrases (e.g. when Pro tier
#    becomes deliverable, drop the "Choose Pro · $29/mo" entries).
#  - A feature gets GATED: add the now-aspirational phrases (e.g. if we
#    pull a vertical, add its "platforms covered" claim here).
#  - A piece of copy becomes a lie: add it the same day. The list IS
#    the canonical "what we currently can't claim" registry.
#
# Run locally: ./scripts/check-banned-phrases.sh
# Wired into: .githooks/pre-commit + .github/workflows/ci.yml
#
# Exit codes:
#   0  no banned phrases found
#   1  banned phrase(s) found — commit blocked
#
set -euo pipefail

# Each entry: "PATTERN|||HUMAN-READABLE REASON"
# Patterns are POSIX-regex compatible with `grep -E`.
# Search is restricted to client/src + server/src to avoid false-
# positives in docs/, node_modules, build output, this script itself.

BANNED=(
  # Channel-coverage lies (we ship LINE + Telegram; never LINE-only)
  "—\\s*from LINE\\.|— from LINE\\.|- from LINE\\.|– from LINE\\.|from LINE\\.\$|ผ่าน LINE\$|on LINE only|via LINE only|in LINE, not Slack|live in LINE|ผ่าน LINE'|LINE-only|LINE only ping|ping you on LINE\\.|ping you on LINE —|ping you on LINE -|ping you on LINE,"
  # Platform-count lies (only Google polls automatically today)
  "60\\+\\s*platforms|60 \\+\\s*platforms|every major platform|6 platforms \\(Google|across every major platform|multi-platform pull is live|all the platforms tourists actually use"
  # Compliance claims we can't make
  "HIPAA-compliant|HIPAA compliant|HIPAA / PDPA-compliant|HIPAA-aware reply|HIPAA aware reply|GDPR-compliant by default|SOC2-compliant"
  # Fake testimonials from when we had 0 paying customers
  "Bangkok bistro owner, beta|Phuket boutique hotel, beta|GP dentist, US|Bangkok wellness studio, beta|Bangkok cocktail bar owner, beta|Bangkok Muay Thai gym owner, beta|independent pharmacist, US beta|independent café owner, Chiang Mai beta"
  # Live CTAs for currently-gated tiers (Pro + Business coming-soon as of 2026-05-16)
  "Choose Pro · \\\$29/mo|Choose Business · \\\$59/mo|to=\"\\/register\"[^>]*>\\s*\\{?[^}]*proCheckout|to=\"\\/register\"[^>]*>\\s*\\{?[^}]*businessCheckout"
  # Killed trial wording — we don't offer a 14-day everything-unlocked trial
  "14-day trial|14 day trial|free 14-day|two-week trial|free trial of Pro|free trial of Business"
)

REASONS=(
  "channel-coverage lie (LINE-only) — we ship both LINE and Telegram, copy must reflect both or be channel-agnostic"
  "platform-count lie — only Google polls automatically today; the rest is aspirational CSV import"
  "compliance claim — we have no BAA, no audit, no formal compliance regime; use 'PHI-aware' / 'privacy-aware' instead"
  "fabricated testimonial — we have 0 paying customers; FTC endorsement-guide violation"
  "live CTA for a gated tier — Pro and Business are currently coming_soon in plans.js; CTA must be disabled"
  "trial wording — the 14-day full-feature trial was killed; Free tier IS the trial"
)

# Restrict the search to actual product source — not docs, scripts, the
# lint itself, build output, node_modules, lockfiles, or git internals.
#
# client/index.html is the SPA shell — has og:description, meta description,
# Schema.org JSON-LD, FAQPage answers. SaaSHub auto-pulled "60+ platforms"
# from here on 2026-05-20 because it wasn't being scanned. Added 2026-05-21
# after that drift escaped to production for ~36 hours undetected.
SEARCH_PATHS=(
  "client/src"
  "client/public"
  "client/index.html"
  "server/src"
)

# Exclude this script from its own search; also exclude tests that
# legitimately reference banned phrases in regression assertions.
EXCLUDE_DIRS=(
  "--exclude-dir=node_modules"
  "--exclude-dir=dist"
  "--exclude-dir=build"
  "--exclude-dir=__tests__"
  "--exclude-dir=tests"
  "--exclude-dir=.git"
)

# File-level allowlist — files that LEGITIMATELY reference banned
# phrases (negative disclaimers, historical changelog, /line page
# which is specifically about LINE OA, local design mocks not served
# at any user-facing route). Listed as POSIX-extended-regex matched
# against the FULL grep output line.
ALLOWLIST_FILE_PATTERNS=(
  # Historical / disclaimer files where the banned phrase is correct
  "client/src/pages/Changelog\\.jsx"
  "client/src/pages/Register\\.jsx"
  "client/src/pages/LinePivot\\.jsx"
  "client/src/pages/Settings\\.jsx:[0-9]+:.*line_user_id|LINE connected|ping your LINE"
  "server/src/routes/auth\\.js"
  # The /line page is intentionally LINE-specific marketing
  "i18n/translations\\.js:[0-9]+:.*regulatedIndustryBody"
  # Local design experiments — noindex, not user-facing
  "client/public/design-mock-"
  # Self-references in comments about the banned phrase
  "Landing\\.jsx:[0-9]+:[[:space:]]*//"
  "Landing\\.jsx:[0-9]+:[[:space:]]*\\*"
  "Landing\\.jsx:[0-9]+:[[:space:]]*\\{/\\*"
  "Landing\\.jsx:[0-9]+:[[:space:]]*previous metric"
  "Landing\\.jsx:[0-9]+:[[:space:]]*platform registry covers"
  # The lint itself
  "scripts/check-banned-phrases\\.sh"
)

# Color output when run interactively. CI sets NO_COLOR.
if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
  RED='\033[0;31m'
  YELLOW='\033[0;33m'
  GREEN='\033[0;32m'
  NC='\033[0m'
else
  RED=''
  YELLOW=''
  GREEN=''
  NC=''
fi

FOUND_ANY=0

for i in "${!BANNED[@]}"; do
  PATTERN="${BANNED[$i]}"
  REASON="${REASONS[$i]}"

  # grep -E for extended regex; -r recursive; -n line numbers; -I skip binary.
  # `|| true` keeps the script alive when grep returns 1 (no match found,
  # the case we want most of the time).
  RAW=$(grep -E -r -n -I "${EXCLUDE_DIRS[@]}" "$PATTERN" "${SEARCH_PATHS[@]}" 2>/dev/null || true)

  # Apply file-level allowlist — drop lines matching any allowlisted
  # path pattern. Done in shell so the allowlist stays in one place.
  HITS=""
  if [[ -n "$RAW" ]]; then
    while IFS= read -r line; do
      ALLOW=0
      for allow_pat in "${ALLOWLIST_FILE_PATTERNS[@]}"; do
        if [[ "$line" =~ $allow_pat ]]; then
          ALLOW=1
          break
        fi
      done
      if [[ $ALLOW -eq 0 ]]; then
        HITS+="${line}"$'\n'
      fi
    done <<< "$RAW"
    HITS="${HITS%$'\n'}"  # strip trailing newline
  fi

  if [[ -n "$HITS" ]]; then
    if [[ $FOUND_ANY -eq 0 ]]; then
      echo
      echo -e "${RED}✗ Banned-phrase lint failed.${NC}"
      echo -e "  Run: ${YELLOW}./scripts/check-banned-phrases.sh${NC} to re-check locally."
      echo
    fi
    FOUND_ANY=1
    echo -e "${YELLOW}— ${REASON}${NC}"
    echo "$HITS" | sed 's/^/    /'
    echo
  fi
done

if [[ $FOUND_ANY -eq 0 ]]; then
  echo -e "${GREEN}✓ Banned-phrase lint passed.${NC} No stale marketing copy detected."
  exit 0
fi

echo -e "${RED}Commit blocked.${NC} Either:"
echo "  (a) update the copy to match current reality"
echo "  (b) if the phrase is now TRUE (feature shipped), remove it from"
echo "      the BANNED list in scripts/check-banned-phrases.sh in the"
echo "      same commit that ships the feature"
echo
exit 1
