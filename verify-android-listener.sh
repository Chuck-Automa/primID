#!/usr/bin/env bash
# verify-android-listener.sh — spec conformance check against CLAUDE_ANDROID_LISTENER.md
# Run from the repo root: bash verify-android-listener.sh
# Grep-based, read-only. Exit 0 = all checks pass.

set -u
PASS=0; FAIL=0; WARN=0
ok()   { echo "  PASS  $1"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL  $1"; FAIL=$((FAIL+1)); }
warn() { echo "  WARN  $1"; WARN=$((WARN+1)); }

# Locate the adapter and schema regardless of exact directory layout
ADAPTER=$(find . -path ./node_modules -prune -o -name "phone.android.adapter.js" -print | head -1)
SRC_DIRS=$(find . -path ./node_modules -prune -o -type d -name src -print)
SCHEMA=$(find . -name "schema.prisma" -not -path "*/node_modules/*" | head -1)

echo "== 1. Provider architecture =="
[ -n "$ADAPTER" ] && ok "phone.android.adapter.js exists ($ADAPTER)" || bad "phone.android.adapter.js not found"
grep -rq "PHONE_LISTENER_PROVIDER" --include="*.js" --exclude-dir=node_modules . \
  && ok "PHONE_LISTENER_PROVIDER selection wired" || bad "PHONE_LISTENER_PROVIDER not referenced in code"

echo "== 2. Signature verification (the load-bearing checks) =="
if [ -n "$ADAPTER" ]; then
  grep -q "timingSafeEqual" "$ADAPTER" \
    && ok "constant-time compare (timingSafeEqual)" || bad "no timingSafeEqual — non-constant-time compare is a spec violation"
  grep -q "x-signature\|X-Signature" "$ADAPTER" && grep -q "x-timestamp\|X-Timestamp" "$ADAPTER" \
    && ok "X-Signature and X-Timestamp headers read" || bad "signature/timestamp headers not both present"
  # rawBody handling: express.json() consumes the stream; HMAC must run over raw bytes.
  grep -rq "express.raw\|rawBody\|verify:" --include="*.js" --exclude-dir=node_modules . \
    && ok "raw body capture present (express.raw / verify hook / rawBody)" \
    || bad "no raw-body capture found — HMAC over JSON.stringify(req.body) will NOT match the app's signature (key order/whitespace differ). Use express.raw() on the webhook routes or a json({verify}) hook."
  grep -q "660\|REPLAY_WINDOW" "$ADAPTER" \
    && ok "replay window enforced" || bad "no replay-window check in adapter"
  grep -Eq "ANDROID_FORWARDER_HMAC_SECRET" "$ADAPTER" \
    && ok "dedicated forwarder secret used" || bad "ANDROID_FORWARDER_HMAC_SECRET not used in adapter"
  grep -nE "(^|[^A-Z_])HMAC_SECRET" "$ADAPTER" >/dev/null \
    && bad "adapter references the lookup HMAC_SECRET — key reuse is a never-do" || ok "no ALE/lookup key reuse detected in adapter"
fi

echo "== 3. Fail-closed / no-op semantics =="
if [ -n "$ADAPTER" ]; then
  grep -q "401" "$ADAPTER" && ok "401 on verification failure" || bad "no 401 path in adapter"
  grep -q "200" "$ADAPTER" && ok "200 no-op path present" || warn "no explicit 200 no-op — bad messages may trigger 2-day app retries"
  grep -Eq "payload\.sender|payload\.message" "$ADAPTER" && \
    { grep -E "console\.|logger\.|log\(" "$ADAPTER" | grep -Eq "sender|payload\.message" \
      && bad "adapter appears to log sender/message — PII, never-do" \
      || ok "no sender/message logging detected"; }
fi

echo "== 4. Heartbeat + listener_status =="
grep -rq "system:ping\|system_ping" --include="*.js" --exclude-dir=node_modules . \
  && ok "system:ping handler present" || bad "no system:ping handling found"
grep -rq "app:started\|app_started" --include="*.js" --exclude-dir=node_modules . \
  && ok "app:started handled" || warn "app:started not handled — recovery after restart waits up to one ping interval"
grep -q "listener_status\|ListenerStatus" "$SCHEMA" 2>/dev/null \
  && ok "ListenerStatus in prisma schema ($SCHEMA)" || bad "ListenerStatus model missing from schema (searched: ${SCHEMA:-no schema.prisma found})"
grep -rq "listenerStatus.*upsert\|ListenerStatus.*upsert" --include="*.js" --exclude-dir=node_modules . \
  && ok "heartbeat upserts last_seen_at" || warn "no upsert on ListenerStatus found — verify write path"
# Ownership rule: main API must not write listener_status. Adjust the path to your main-API dir if it differs.
MAIN_API=$(find . -path ./node_modules -prune -o -type d -name "primid-api" -print | head -1)
if [ -n "$MAIN_API" ]; then
  grep -rEq "listenerStatus\.(create|update|upsert|delete)" --include="*.js" "$MAIN_API" \
    && bad "main API writes listener_status — listener-owned, read-only violation" \
    || ok "main API does not write listener_status"
fi

echo "== 5. Flag routing + degraded mode =="
grep -rq "FEATURE_PHONE_VERIFICATION_LIVE" --include="*.js" --exclude-dir=node_modules . \
  && ok "FEATURE_PHONE_VERIFICATION_LIVE referenced" || bad "flag not wired"
grep -rq "DEMO_RESTRICTED" --include="*.js" --exclude-dir=node_modules . \
  && ok "403 DEMO_RESTRICTED path retained" || bad "DEMO_RESTRICTED missing — flag-off posture broken"
grep -rq "resolved_via\|resolvedVia" --include="*.js" --exclude-dir=node_modules . prisma/schema.prisma 2>/dev/null \
  && ok "resolved_via present" || bad "resolved_via column/usage missing — stub_fallback audit trail required"
grep -rq "stub_fallback" --include="*.js" --exclude-dir=node_modules . \
  && ok "stub_fallback marking present" || bad "stub_fallback not implemented"
grep -rq "PHONE_MAINTENANCE_NOTICE" --include="*.js" --exclude-dir=node_modules . \
  && ok "maintenance notice read from env" || bad "PHONE_MAINTENANCE_NOTICE not read from env"
grep -rq "currently unavailable. Proceeding with next steps" --include="*.js" --exclude-dir=node_modules . \
  && bad "notice string hard-coded in code — never-do; env only" || ok "notice string not hard-coded"
grep -rq "PHONE_VERIFICATION_UNAVAILABLE" --include="*.js" --exclude-dir=node_modules . \
  && ok "prod 503 path present" || warn "503 PHONE_VERIFICATION_UNAVAILABLE not found — verify prod fail-closed branch"

echo "== 6. Prohibitions =="
grep -rq "mms:received\|sms:data-received" --include="*.js" --exclude-dir=node_modules . \
  && bad "MMS/data-SMS event referenced — SMS only" || ok "no MMS/data-SMS events"
grep -rEq "messages/send|/message\b.*POST|sendSms|sendSMS" --include="*.js" --exclude-dir=node_modules . \
  && warn "possible outbound-send reference — confirm receive-only" || ok "no outbound SMS references"
NEW_DEPS=$(git diff HEAD~1 -- package.json 2>/dev/null | grep -c '^\+.*"')
[ "${NEW_DEPS:-0}" -gt 0 ] && warn "package.json changed in last commit — confirm zero new deps (built-in crypto only)" || ok "no package.json additions in last commit"

echo
echo "======================================"
echo "  PASS: $PASS   FAIL: $FAIL   WARN: $WARN"
echo "======================================"
[ $FAIL -eq 0 ] && exit 0 || exit 1
