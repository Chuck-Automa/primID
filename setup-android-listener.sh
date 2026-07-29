#!/usr/bin/env bash
# setup-android-listener.sh — guided stand-up of the capcom6 SMS Gateway device
# per CLAUDE_ANDROID_LISTENER.md. Automates every scriptable step (adb, curls,
# key generation, Doze exemption, env output) and pauses with explicit prompts
# at each hands-on-phone step.
#
# Usage: bash setup-android-listener.sh
# Prereqs: adb, curl, openssl (or /dev/urandom), phone connected via USB with
#          USB debugging authorized.

set -u

step()    { echo; echo "==================================================="; echo "  STEP $1"; echo "==================================================="; }
pause()   { echo; read -r -p ">>> ON THE PHONE: $1
    Press Enter when done... " _; }
ask()     { local v; read -r -p "$1 " v; echo "$v"; }
die()     { echo "ABORT: $1" >&2; exit 1; }

echo "primID Android Listener — guided setup"
echo "Spec: CLAUDE_ANDROID_LISTENER.md (runbook steps 1-9 + smoke test prep)"

# ---------------------------------------------------------------- prereqs
step "0/9 — Prerequisites"
command -v adb  >/dev/null || die "adb not found — install android-platform-tools"
command -v curl >/dev/null || die "curl not found"
DEVICES=$(adb devices | awk 'NR>1 && $2=="device"' | wc -l)
[ "$DEVICES" -ge 1 ] || die "no authorized device — connect USB, enable USB debugging, accept the prompt on the phone"
[ "$DEVICES" -eq 1 ] || die "multiple devices connected — disconnect all but the listener phone"
echo "  OK: adb, curl, exactly one authorized device."

LISTENER_PORT=$(ask "Local listener service port on this machine (e.g. 3001):")
[ -n "$LISTENER_PORT" ] || die "listener port required"

echo
echo "Webhook transport (the app requires HTTPS unless the target is http://127.0.0.1):"
echo "  1) adb reverse over USB  — phone posts to 127.0.0.1, forwarded to this machine (default)"
echo "  2) custom HTTPS URL      — Cloudflare Tunnel / staging endpoint"
MODE=$(ask "Choose [1/2]:")
if [ "$MODE" = "2" ]; then
  WEBHOOK_BASE=$(ask "HTTPS base URL (e.g. https://tunnel.example.com):")
  case "$WEBHOOK_BASE" in https://*) : ;; *) die "must be HTTPS" ;; esac
else
  WEBHOOK_BASE="http://127.0.0.1:9876"
fi

# ---------------------------------------------------------------- 1: install
step "1/9 — Install the APK"
echo "Official releases: https://github.com/capcom6/android-sms-gateway/releases"
APK=$(ask "Path to downloaded APK (blank = already installed, skip):")
if [ -n "$APK" ]; then
  [ -f "$APK" ] || die "no file at $APK"
  SHA=$(sha256sum "$APK" | awk '{print $1}')
  echo "  APK SHA-256: $SHA"
  echo "  >>> Record this + the release version in CLAUDE_ANDROID_LISTENER.md (runbook step 1)."
  adb install -r "$APK" || die "adb install failed"
  echo "  Installed."
fi

# Detect the package for the Doze step later
PKG=$(adb shell pm list packages 2>/dev/null | tr -d '\r' | grep -iE "smsgat|sms.gateway|capcom" | head -1 | sed 's/^package://')
if [ -z "$PKG" ]; then
  PKG=$(ask "Could not auto-detect the app package. Enter it (adb shell pm list packages | grep -i sms):")
fi
echo "  App package: $PKG"

# ---------------------------------------------------------------- 2: permissions
step "2/9 — Permissions"
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
pause "Grant the SMS permission at first launch. Do NOT grant MMS/WAP-push if asked separately."

# ---------------------------------------------------------------- 3: local server
step "3/9 — Local Server mode"
pause "Home tab -> start Local Server. Note the Basic-auth username/password shown on the Home tab."
GW_USER=$(ask "Basic-auth username:")
GW_PASS=$(ask "Basic-auth password:")

if [ "$MODE" != "2" ]; then
  # USB mode: reach the device's admin API over the cable — no LAN required,
  # immune to router client isolation. (adb forward = machine->phone; distinct
  # from the adb reverse in step 6, which is phone->machine. They coexist.)
  adb forward tcp:18080 tcp:8080 || die "adb forward failed"
  DEVICE_API="http://127.0.0.1:18080"
  echo "  Admin API via USB: $DEVICE_API (adb forward 18080 -> device 8080)"
else
  DEVICE_IP=$(ask "Device IP (as shown in the app):")
  DEVICE_PORT=$(ask "Device port [8080]:"); DEVICE_PORT=${DEVICE_PORT:-8080}
  DEVICE_API="http://$DEVICE_IP:$DEVICE_PORT"
fi

curl -s -f -m 8 --connect-timeout 5 -u "$GW_USER:$GW_PASS" "$DEVICE_API/webhooks" >/dev/null \
  && echo "  OK: device local API reachable and credentials accepted." \
  || die "cannot reach the device API at $DEVICE_API within 8s — Local Server started on the Home tab? credentials right? (USB mode: is the cable still connected?)"

# ---------------------------------------------------------------- 4: signing key
step "4/9 — Signing Key"
if command -v openssl >/dev/null; then KEY=$(openssl rand -hex 32); else KEY=$(head -c32 /dev/urandom | od -An -tx1 | tr -d ' \n'); fi
echo "  Generated 32-byte key:"
echo
echo "      $KEY"
echo
pause "Settings -> Webhooks -> Signing Key -> paste EXACTLY the value above."
echo "  (It will be written to the env block at the end as ANDROID_FORWARDER_HMAC_SECRET.)"

# ---------------------------------------------------------------- 5: ping
step "5/9 — Ping interval"
pause "Settings -> Ping -> enable, interval 180 seconds."

# ---------------------------------------------------------------- 6: transport
step "6/9 — Transport"
if [ "$MODE" != "2" ]; then
  adb reverse tcp:9876 "tcp:$LISTENER_PORT" || die "adb reverse failed"
  echo "  OK: phone's 127.0.0.1:9876 -> this machine's :$LISTENER_PORT"
  echo "  NOTE: this forward dies if USB disconnects or adb restarts. Re-run:"
  echo "        adb reverse tcp:9876 tcp:$LISTENER_PORT"
else
  echo "  Using $WEBHOOK_BASE — ensure it terminates at the listener service."
fi

# ---------------------------------------------------------------- 7: webhooks
step "7/9 — Register webhooks"
register() { # id event path
  curl -s -f -m 8 --connect-timeout 5 -u "$GW_USER:$GW_PASS" -X POST -H "Content-Type: application/json" \
    -d "{\"id\":\"$1\",\"url\":\"$WEBHOOK_BASE$3\",\"event\":\"$2\"}" \
    "$DEVICE_API/webhooks" >/dev/null \
    && echo "  registered $2 -> $3" || die "failed to register $2"
}
register "primid-sms"   "sms:received" "/webhooks/phone/android"
register "primid-ping"  "system:ping"  "/webhooks/phone/android/heartbeat"
register "primid-start" "app:started"  "/webhooks/phone/android/heartbeat"

LISTED=$(curl -s -m 8 --connect-timeout 5 -u "$GW_USER:$GW_PASS" "$DEVICE_API/webhooks")
COUNT=$(echo "$LISTED" | grep -o "primid-" | wc -l)
[ "$COUNT" -ge 3 ] && echo "  OK: all 3 primid webhooks listed on the device." \
                   || { echo "$LISTED"; die "expected 3 primid webhooks, found $COUNT"; }

# ---------------------------------------------------------------- 8: hardening
step "8/9 — Device hardening"
adb shell cmd deviceidle whitelist "+$PKG" >/dev/null 2>&1 \
  && echo "  OK: Doze exemption applied via adb ($PKG)." \
  || echo "  WARN: deviceidle whitelist failed — set manually: Settings -> Apps -> SMS Gateway -> Battery -> Unrestricted."
pause "Manual checks: (a) disable SMS cloud backup (Google Messages backup / carrier sync); (b) storage encryption on + strong lock screen; (c) set a daily inbox purge reminder; (d) confirm NO auto-reply/send features are enabled anywhere in the app."

# ---------------------------------------------------------------- 9: env
step "9/9 — Server environment"
SIM=$(ask "The SIM's phone number in E.164 (e.g. +15551234567):")
ENVBLOCK="# --- Android listener (generated $(date +%F) by setup-android-listener.sh) ---
PHONE_LISTENER_PROVIDER=android
ANDROID_LISTENER_NUMBER=$SIM
ANDROID_FORWARDER_HMAC_SECRET=$KEY
ANDROID_FORWARDER_REPLAY_WINDOW_S=660
ANDROID_HEARTBEAT_STALE_AFTER_S=600
FEATURE_PHONE_VERIFICATION_LIVE=false
PHONE_MAINTENANCE_NOTICE=\"This service is currently unavailable. Proceeding with next steps.\"
# --- end Android listener ---"
if [ -f .env ]; then
  W=$(ask ".env found in $(pwd) — append the block? [y/N]:")
  if [ "$W" = "y" ] || [ "$W" = "Y" ]; then
    grep -q "PHONE_LISTENER_PROVIDER" .env \
      && echo "  WARN: PHONE_LISTENER_PROVIDER already in .env — NOT appending; merge by hand:" \
      || { printf '%s\n' "$ENVBLOCK" >> .env; echo "  Appended to .env."; }
  fi
fi
echo
printf '%s\n' "$ENVBLOCK"
echo
echo "NOTE: FEATURE_PHONE_VERIFICATION_LIVE is written as 'false' (closed posture)."
echo "      Flip to 'true' deliberately when you want the live path open."

# ---------------------------------------------------------------- smoke test
step "DONE — Smoke test (run with the listener service up)"
echo "Kick (a) now: restarting the app to fire app:started..."
adb shell am force-stop "$PKG" 2>/dev/null
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
cat << 'CHECKS'
  (a) app:started should hit /webhooks/phone/android/heartbeat now
      -> check listener logs / listener_status.last_seen_at updated
  (b) wait 3 min -> system:ping arrives
  (c) flag off: /initiate with a real number -> 403 DEMO_RESTRICTED;
      555 whitelist number -> stub-resolves
  (d) flag on: /initiate with your real number, text the code to the SIM
      from that number -> /status {verified:true}, resolved_via='sms'
  (e) tamper: replay a captured webhook with a stale timestamp -> 401;
      SMS from a number with no open challenge -> 200 no-op
  (f) downtime: kill the app, wait 11 min, /initiate (flag on)
      -> maintenanceNotice present, auto-resolves 3s, resolved_via='stub_fallback';
      restart app -> next /initiate routes live, no notice
CHECKS
echo "Full spec: CLAUDE_ANDROID_LISTENER.md"
