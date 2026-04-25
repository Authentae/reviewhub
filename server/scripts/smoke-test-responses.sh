#!/usr/bin/env bash
# Smoke test for the Business Owner Review Response feature.
#
# Hits each new endpoint introduced by the claim/response feature against a
# running ReviewHub server. Designed to be run post-deploy against staging
# (or carefully against production) to confirm the schema migration applied
# and routes are wired correctly.
#
# Usage:
#   BASE_URL=https://reviewhub.example.com \
#   USER_TOKEN=<jwt-of-business-owner> \
#   ADMIN_TOKEN=<jwt-whose-email-matches-ADMIN_EMAIL> \
#   BUSINESS_ID=<int> \
#   REVIEW_ID=<int> \
#     ./scripts/smoke-test-responses.sh
#
# Required env:
#   BASE_URL       — http(s)://host[:port], no trailing slash
#   USER_TOKEN     — Bearer JWT for a non-admin user (will submit a claim)
#   ADMIN_TOKEN    — Bearer JWT for the configured ADMIN_EMAIL
#   BUSINESS_ID    — id of an existing business the USER does NOT own
#   REVIEW_ID      — id of a review on that business
#
# Exits 0 on full success. Any non-2xx (other than expected pre-cleanup
# 404/409) aborts with the failing step's HTTP body printed.
#
# Idempotency: cleans up the response it creates at the end. The claim row
# is left in place (denial would lock the user out of re-claiming; approval
# is the success state we want to leave behind). If you re-run, the existing
# pending/approved claim short-circuits with a 409 — that's expected and the
# script tolerates it.

set -euo pipefail

: "${BASE_URL:?BASE_URL required}"
: "${USER_TOKEN:?USER_TOKEN required}"
: "${ADMIN_TOKEN:?ADMIN_TOKEN required}"
: "${BUSINESS_ID:?BUSINESS_ID required}"
: "${REVIEW_ID:?REVIEW_ID required}"

CURL_OPTS=(-sS -o /tmp/smoke-body.json -w "%{http_code}")

step() { printf "\n=== %s ===\n" "$1"; }

assert_status() {
  local expected="$1" actual="$2" label="$3"
  if [[ ",$expected," != *",$actual,"* ]]; then
    echo "FAIL: $label — expected $expected got $actual"
    cat /tmp/smoke-body.json
    exit 1
  fi
  echo "OK ($actual): $label"
}

# 1. Submit a claim as the regular user (or accept 409 if already pending/approved).
step "1. POST /api/businesses/$BUSINESS_ID/claim"
code=$(curl "${CURL_OPTS[@]}" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/businesses/$BUSINESS_ID/claim" \
  -d '{"evidence":"Smoke-test claim — owner verification doc on file"}')
assert_status "201,409" "$code" "claim creation (or already exists)"
CLAIM_ID=$(node -e "try{const j=require('/tmp/smoke-body.json');console.log(j.id||j.claim?.id||'')}catch(e){console.log('')}")
echo "claim_id=$CLAIM_ID"

# 2. Read the caller's claim status.
step "2. GET /api/businesses/$BUSINESS_ID/claim"
code=$(curl "${CURL_OPTS[@]}" \
  -H "Authorization: Bearer $USER_TOKEN" \
  "$BASE_URL/api/businesses/$BUSINESS_ID/claim")
assert_status "200" "$code" "claim status read"

# 3. Admin lists pending claims.
step "3. GET /api/admin/claims?status=pending (admin)"
code=$(curl "${CURL_OPTS[@]}" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE_URL/api/admin/claims?status=pending&limit=50")
assert_status "200" "$code" "admin claim list"

# Resolve claim_id from queue if not captured above.
if [[ -z "$CLAIM_ID" ]]; then
  CLAIM_ID=$(node -e "
    const j=require('/tmp/smoke-body.json');
    const row=(j.rows||[]).find(r=>r.business_id==$BUSINESS_ID);
    console.log(row?row.id:'')
  ")
fi
echo "resolved claim_id=$CLAIM_ID"

# 4. Admin approves the claim (skip if already approved → 409).
if [[ -n "$CLAIM_ID" ]]; then
  step "4. POST /api/admin/claims/$CLAIM_ID/approve (admin)"
  code=$(curl "${CURL_OPTS[@]}" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/admin/claims/$CLAIM_ID/approve" \
    -d '{}')
  assert_status "200,409" "$code" "claim approval (or already approved)"
fi

# 5. Owner posts a public response (skip if already exists → 409 cleanup-then-retry).
step "5. POST /api/reviews/$REVIEW_ID/response"
RESP_BODY='{"response_text":"Thanks for the feedback — we appreciate you taking the time to share your experience and look forward to seeing you again soon."}'
code=$(curl "${CURL_OPTS[@]}" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/reviews/$REVIEW_ID/response" \
  -d "$RESP_BODY")
if [[ "$code" == "409" ]]; then
  echo "Response already exists — deleting and retrying."
  curl -sS -H "Authorization: Bearer $USER_TOKEN" \
    -X DELETE "$BASE_URL/api/reviews/$REVIEW_ID/response" >/dev/null
  code=$(curl "${CURL_OPTS[@]}" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/reviews/$REVIEW_ID/response" \
    -d "$RESP_BODY")
fi
assert_status "201,402" "$code" "response create (402 if user not on paid plan — verify plan tier)"

# 6. Public read of business reviews — should include the response inline.
step "6. GET /api/public/businesses/$BUSINESS_ID/reviews"
code=$(curl "${CURL_OPTS[@]}" \
  "$BASE_URL/api/public/businesses/$BUSINESS_ID/reviews?limit=25")
assert_status "200" "$code" "public reviews feed"
HAS_RESP=$(node -e "
  const j=require('/tmp/smoke-body.json');
  const r=(j.reviews||[]).find(x=>x.id==$REVIEW_ID);
  console.log(r&&r.owner_response?'yes':'no')
")
echo "review $REVIEW_ID has owner_response inline: $HAS_RESP"

# 7. GET single response.
step "7. GET /api/reviews/$REVIEW_ID/response"
code=$(curl "${CURL_OPTS[@]}" \
  -H "Authorization: Bearer $USER_TOKEN" \
  "$BASE_URL/api/reviews/$REVIEW_ID/response")
assert_status "200" "$code" "single response read"

# 8. Cleanup: delete the response we created so re-runs are idempotent.
step "8. DELETE /api/reviews/$REVIEW_ID/response (cleanup)"
code=$(curl "${CURL_OPTS[@]}" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -X DELETE "$BASE_URL/api/reviews/$REVIEW_ID/response")
assert_status "200,404" "$code" "cleanup delete"

echo
echo "ALL SMOKE TESTS PASSED."
