#!/usr/bin/env bash
# test-cron-auth.sh
#
# Verifies that the cron auth guard on send-weekly-engagement is working correctly.
# Tests three scenarios:
#   1. No secret → expect 401
#   2. Wrong secret → expect 401
#   3. Correct x-cron-secret header → expect 200 (or 204)
#
# Usage:
#   # Against local supabase (default):
#   ./scripts/test-cron-auth.sh
#
#   # Against a specific URL and secret:
#   CRON_URL=https://julraghuunmzqxcayict.supabase.co/functions/v1/send-weekly-engagement \
#   CRON_SECRET=oli-engage-2026 \
#   ANON_KEY=<your-anon-key> \
#   ./scripts/test-cron-auth.sh
#
# Requirements: curl, jq (optional for pretty-printing)

set -euo pipefail

# ── Config ─────────────────────────────────────────────────────────────────────
CRON_URL="${CRON_URL:-http://localhost:54321/functions/v1/send-weekly-engagement}"
CRON_SECRET="${CRON_SECRET:-}"          # populated from env or .env.local below
ANON_KEY="${ANON_KEY:-}"

# Try to load from .env.local if values are not set
if [ -f ".env.local" ]; then
  [ -z "$CRON_SECRET" ] && CRON_SECRET=$(grep -E '^CRON_SECRET=' .env.local 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
  [ -z "$ANON_KEY"    ] && ANON_KEY=$(grep -E '^SUPABASE_ANON_KEY=' .env.local 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
fi

if [ -z "$CRON_SECRET" ]; then
  echo "ERROR: CRON_SECRET is not set. Pass it as an env var or add to .env.local"
  exit 1
fi
if [ -z "$ANON_KEY" ]; then
  # For local Supabase, use the default anon key from `supabase status`
  ANON_KEY=$(supabase status 2>/dev/null | grep 'anon key' | awk '{print $NF}' || echo "")
fi
if [ -z "$ANON_KEY" ]; then
  echo "ERROR: ANON_KEY is not set. Pass it as an env var or run 'supabase start' first."
  exit 1
fi

PASS=0
FAIL=0

check() {
  local label="$1"
  local expected_status="$2"
  local actual_status="$3"
  if [ "$actual_status" = "$expected_status" ]; then
    echo "  PASS: $label (HTTP $actual_status)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label — expected HTTP $expected_status, got HTTP $actual_status"
    FAIL=$((FAIL + 1))
  fi
}

BODY='{"mode":"engagement_cron"}'

echo ""
echo "Testing cron auth on: $CRON_URL"
echo "──────────────────────────────────────────"

# Test 1: No secret → 401
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$CRON_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -d "$BODY")
check "No cron secret → 401" "401" "$STATUS"

# Test 2: Wrong secret → 401
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$CRON_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "x-cron-secret: wrong-secret-value" \
  -d "$BODY")
check "Wrong x-cron-secret → 401" "401" "$STATUS"

# Test 3: Correct x-cron-secret header → 200
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$CRON_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d "$BODY")
check "Correct x-cron-secret header → 200" "200" "$STATUS"

# Test 4: Secret in body (fallback) → 200
BODY_WITH_SECRET=$(printf '{"mode":"engagement_cron","cron_secret":"%s"}' "$CRON_SECRET")
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$CRON_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -d "$BODY_WITH_SECRET")
check "Secret in request body (fallback) → 200" "200" "$STATUS"

echo "──────────────────────────────────────────"
echo "Results: $PASS passed, $FAIL failed"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
