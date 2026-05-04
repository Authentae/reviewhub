#!/usr/bin/env bash
# Production smoke check.
#
# Hits the live deployment over HTTP and asserts the prospect-facing
# critical paths are alive. Run after every deploy. Exits 0 on green,
# nonzero on the first failure.
#
# Doesn't authenticate — only checks public surfaces. The audit-share
# endpoint is the most important one because that's what every cold
# email points at; if it's broken, every prospect we DM'd today gets
# a 500.
#
# Usage:
#   ./scripts/prod-smoke.sh                 # uses default https://reviewhub.review
#   ./scripts/prod-smoke.sh https://staging.reviewhub.review

set -euo pipefail

BASE="${1:-https://reviewhub.review}"
PASS_COUNT=0
FAIL_COUNT=0

check() {
  local label="$1"
  local url="$2"
  local expect="$3"   # expected HTTP status code
  local got
  got=$(curl -sS -o /dev/null -w "%{http_code}" -L --max-time 15 "$url" || echo "000")
  if [[ "$got" == "$expect" ]]; then
    echo "✓ $label  ($got)"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "✗ $label  expected=$expect  got=$got  url=$url"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

check_contains() {
  local label="$1"
  local url="$2"
  local needle="$3"
  local body
  body=$(curl -sS -L --max-time 15 "$url" || echo "")
  if echo "$body" | grep -q -- "$needle"; then
    echo "✓ $label"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "✗ $label  url=$url  expected-contains=$needle"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

echo "Smoke-checking $BASE"
echo "──────────────────────────────────────────────"

# Public marketing pages — first impression for cold-email click-throughs
check "landing"       "$BASE/"           "200"
check "pricing"       "$BASE/pricing"    "200"
check "terms"         "$BASE/terms"      "200"
check "privacy"       "$BASE/privacy"    "200"
check "roadmap"       "$BASE/roadmap"    "200"
check "status page"   "$BASE/status"     "200"

# Auth pages
check "login"         "$BASE/login"      "200"
check "register"      "$BASE/register"   "200"

# Audit-preview routes — most-traveled path on cold-email day
# Bogus token: must 404 (proves the route + validation are wired)
check "audit-preview API rejects invalid token" \
  "$BASE/api/audit-previews/share/notarealtoken" "404"

# Bogus 48-hex-char token that doesn't exist: must 404 (proves DB lookup runs)
check "audit-preview API 404s missing token" \
  "$BASE/api/audit-previews/share/0000000000000000000000000000000000000000000000ff" "404"

# noindex headers on the share-token page (anti-leak for per-prospect URLs)
check "robots.txt accessible"        "$BASE/robots.txt"        "200"
check_contains "robots disallows /audit-preview" "$BASE/robots.txt" "/audit-preview"

# Sitemap exists and lists indexable pages
check "sitemap.xml accessible"       "$BASE/sitemap.xml"       "200"

# Server health (if exposed)
check "API up (any non-5xx on /api/health)" "$BASE/api/health" "200"

echo "──────────────────────────────────────────────"
echo "Pass: $PASS_COUNT   Fail: $FAIL_COUNT"
if [[ "$FAIL_COUNT" -gt 0 ]]; then
  echo "❌ Smoke FAILED — investigate before declaring deploy healthy."
  exit 1
fi
echo "✅ All smoke checks passed."
