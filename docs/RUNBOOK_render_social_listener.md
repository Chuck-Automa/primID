# Runbook: `primid-social-listener` on Render

> Everything below was verified against this repo, not guessed. Where a claim comes with a
> transcript, that transcript was produced in this session by actually running the command — see
> `CLAUDE_ENVIRONMENTS.md`'s "Render service topology" section (traps 1–4, and the env-audit
> findings F1–F4, F2 now resolved) for the background this runbook operationalizes. The service
> **does not exist yet in Render** as of this writing — this document does not create it, per the
> constraints of the task that produced it.

## Service definition

| Setting | Value | Why |
|---|---|---|
| Service type | **Web Service** (not Background Worker) | Only Web Services get a bound port / public HTTPS URL, which is required to receive Telegram's webhook POSTs and the Android SMS Gateway's forwarder webhook. `CLAUDE_ENVIRONMENTS.md` trap 4 / `render.yaml` comment: HMAC signature verification (fail-closed, mandatory) is the actual perimeter control, not network placement. |
| Repo root | **Repository root** (`/`), not `primid-social-listener/` | `CLAUDE_ENVIRONMENTS.md` trap 3: the service's shared-code imports (`../backend/src/shared/...`) reach outside `primid-social-listener/`, and the generated `@prisma/client` lives in `backend/node_modules/`. A build rooted at `primid-social-listener/` never installs or generates either. Confirmed below — Node resolves `require('@prisma/client')` from the *requiring file's* location (`backend/src/shared/db/prisma.js`), so only `backend/`'s own `npm ci` + `prisma generate` produces a client that resolution will actually find. |
| Instance type | **Always-on** (not free/hobby) | `CLAUDE_ENVIRONMENTS.md` trap 4: a sleeping instance turns every Telegram webhook into a cold start. Telegram retries, so updates aren't lost, but replies lag badly — required for any environment with `TELEGRAM_LISTENER_MODE=webhook`. |
| Health check path | `/health` | Matches `render.yaml`'s existing `healthCheckPath: /health` for this service. `app.js` also exposes a richer `/healthz` (adapter state per mode) — see `CLAUDE_ENVIRONMENTS.md` trap 1 — useful for manual verification but not what's configured as the Render health check today. |

## Build command — proven

**Candidate (from the task brief), run clean in this sandbox:**

```bash
cd backend && npm ci --ignore-scripts && npx prisma generate && \
cd ../primid-social-listener && npm ci --ignore-scripts
```

**Proof — ran with both `node_modules` trees removed first** (`rm -rf backend/node_modules
primid-social-listener/node_modules`), from the repo root:

```
$ rm -rf backend/node_modules primid-social-listener/node_modules
$ time (cd backend && npm ci --ignore-scripts && npx prisma generate && \
        cd ../primid-social-listener && npm ci --ignore-scripts)

added 610 packages, and audited 611 packages in 3s
[... npm audit warnings, unrelated to this command's correctness ...]

Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma

✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in 98ms

added 72 packages, and audited 73 packages in 547ms

real    0m5.097s
```

**Result: the candidate command worked as-is — no adjustment needed.** Specifically:

- `npm ci --ignore-scripts` in `backend/` did **not** break `prisma generate` — the postinstall-hook
  suppression that `--ignore-scripts` implies only blocks `npm`-lifecycle scripts; `prisma generate`
  is invoked explicitly as its own step afterward, not relied on to run via a postinstall hook. No
  schema-path adjustment was needed either — `prisma generate` found `backend/prisma/schema.prisma`
  via its own default resolution from the `backend/` working directory.
- `primid-social-listener/package.json` also lists `@prisma/client` as its own dependency, so its
  own `npm ci --ignore-scripts` installs an *ungenerated* copy into
  `primid-social-listener/node_modules/@prisma/client`. This is harmless and does not need to be
  removed from `package.json` for this runbook's purposes: **Node's `require()` resolves relative to
  the file doing the requiring, not the process's original working directory.**
  `primid-social-listener/adapters/telegram.adapter.js` (and every other adapter) reaches Prisma via
  `require('../../backend/src/shared/db/prisma')`, and that file's own
  `require('@prisma/client')` resolves by walking up from `backend/src/shared/db/` — landing on
  `backend/node_modules/@prisma/client` (the generated one), never the listener's own copy. Verified
  directly in this session:

  ```
  $ node -e "
    const p = require('../backend/src/shared/db/prisma');
    console.log(require.resolve('@prisma/client', { paths: [require.resolve('../backend/src/shared/db/prisma.js')] }));
    console.log(typeof p.socialAccount);
  "
  /home/chuck62/primID_local/dev/backend/node_modules/@prisma/client/default.js
  object
  ```

- Both this repo's test suites pass after the clean reinstall (backend Jest: 190/190; listener
  `node --test`: 6/6) — confirming the reinstalled trees are functionally equivalent to what was
  there before, not just "installs without error."

## Start command — proven

```
node primid-social-listener/index.js
```

Matches `render.yaml`'s existing `startCommand` for this service, run from the repo root (consistent
with "repo root" above — `index.js`'s own `require('../backend/...')` calls are relative to its own
file location regardless of cwd, but Render always runs the start command from the service's
configured root, which must be the repo root for the build's installed trees to line up).

**Proof — ran with only the boot-fatal env vars set, to dummy values, from the repo root:**

```
$ PORT=8888 DATABASE_URL="postgresql://dummy:dummy@127.0.0.1:5432/dummy" \
  HMAC_SECRET="$(openssl rand -hex 32)" \
  node primid-social-listener/index.js &

[listener] primid-social-listener started.
[listener] HTTP server running on port 8888
[cleanup] error during purge: ... Authentication failed against database server ...

$ curl -sf http://127.0.0.1:8888/healthz
{"status":"ok","adapters":{"telegram":"off","phone":"off"}}

$ curl -sf http://127.0.0.1:8888/health
{"status":"ok","timestamp":"2026-07-31T23:58:56.295Z"}

$ kill -0 $LISTENER_PID   # process still running
ALIVE
```

The process binds `$PORT` and both health endpoints return 200 with **no ALE env vars set at
all** — confirming the F2 fix (this runbook's Task 2 sibling commit) in a real boot, not just the
unit test. The one error line (`[cleanup] error during purge`) is the daily challenge-cleanup cron
failing against the intentionally-fake `DATABASE_URL` — expected with dummy credentials, and it does
not crash the process (`runCleanup()`'s own try/catch, `index.js`) or block `/healthz` from
responding. With a real `DATABASE_URL` this line would not appear.

## Environment variables

Three tiers, per the audit (`CLAUDE_ENVIRONMENTS.md`) and this session's F2 fix:

### 1. Boot-fatal (process exits 1 if missing)

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Shared Postgres instance — same `primid-db` Render database as the backend and frontend services. |
| `HMAC_SECRET` | ⚠ **Must be byte-identical to the backend service's `HMAC_SECRET`.** This service only ever calls `computeHmac()` (never `encrypt()`/`decrypt()`) to compare an inbound sender handle/phone number against a challenge row written by the backend under the *same* HMAC key — a mismatched secret means no handle or phone code ever matches, silently. |

Notably **absent** from this tier: `ALE_ENCRYPTION_KEY` / `ALE_KMS_KEY_ARN`. Prior to this
session's F2 fix these were also boot-fatal despite never being used by any code path this service
reaches (`challenge.service.js` calls `computeHmac()` only). `crypto.util.js`'s `encrypt()`/
`decrypt()` already throw a clear error at call time if invoked without a key configured — that
lazy gate is sufficient, and is the only one that applies to this service now. Leave both unset for
this service; there is no reason to provision either.

### 2. Inert-but-set-now (ships in `render.yaml`, defaulted off)

| Variable | Value | Effect while off |
|---|---|---|
| `TELEGRAM_SOCIAL_LISTENER` | `false` | Telegram adapter never mounts its webhook route or starts polling — `mount()`/`startPolling()` both no-op (and, as of this session, their own registry startup-guard never even runs, since it's gated behind these same checks). |
| `TELEGRAM_LISTENER_MODE` | `off` | Must be exactly `polling` \| `webhook` the moment `TELEGRAM_SOCIAL_LISTENER=true` is set, or the process exits 1 at boot (fail-closed guard, unchanged by this session). Never set to `polling` in this deployment — webhook mode is what a Render Web Service is for. |

### 3. Set-at-activation only (Render dashboard — **never** committed to `render.yaml`)

| Variable | Set when | Notes |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram goes live | From @BotFather. Never logged, never in config files — `render.yaml` declares the key name only (`sync: false`), the value lives only in the dashboard. |
| `TELEGRAM_WEBHOOK_SECRET` | Telegram goes live | The `secret_token` passed to Telegram's `setWebhook` call and validated on every inbound webhook request via `crypto.timingSafeEqual`. Generate independently of `HMAC_SECRET`/ALE keys — it protects a different boundary (webhook authenticity, not handle matching). |
| `PHONE_LISTENER_PROVIDER=android`, `ANDROID_LISTENER_NUMBER`, `ANDROID_FORWARDER_HMAC_SECRET`, `ANDROID_FORWARDER_REPLAY_WINDOW_S` | Only if staging's phone verification is ever moved onto this service | Prohibited in `prod` by a boot-time guard in `index.js` regardless of this value (unchanged, not part of this session's work). Currently staging's Android path runs on its own separate service instance per `render.yaml`'s comments — only relevant here if that topology changes. |

## Activation steps

The following is the operator sequence from `CLAUDE_ENVIRONMENTS.md`'s "Social verification (Sprint
2)" section, copied verbatim:

> **Activation note:** everything above ships defaulted off/inert. Going live additionally requires
> the manual operator steps in `SESSION_2026-07-28_category_ab_deployment.md`: BotFather token,
> Telegram backfill run via Render Shell on `primid-backend` (`npm run db:backfill-telegram-canonical`),
> the manual `setWebhook` call (not automated anywhere in the codebase), and real secrets in the
> Render dashboard.

Operationalized as a checklist, cross-referenced against `SESSION_2026-07-28_category_ab_deployment.md`
(the source `CLAUDE_ENVIRONMENTS.md` points to for full detail):

1. **Obtain a bot token** from @BotFather.
2. **Run the canonicalization backfill against production data**, via Render Shell on the
   `primid-backend` service (not this service — the npm script and its Prisma/crypto imports live
   in `backend/`): `npm run db:backfill-telegram-canonical`, or — now that the registry covers every
   platform (see this session's canonicalization-hardening commit) — the more general
   `npm run db:backfill-handle-canonical -- --platform=telegram`. Either is equivalent for Telegram
   specifically.
3. **Set the real secrets** in the Render dashboard for *this* service (`primid-social-listener`):
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`. Flip `TELEGRAM_SOCIAL_LISTENER=true` and
   `TELEGRAM_LISTENER_MODE=webhook` at the same time — the boot guard requires a valid mode the
   instant the listener flag is true.
4. **Register the webhook with Telegram** — a manual, one-time call, not automated anywhere in the
   codebase:
   ```
   POST https://api.telegram.org/bot<TOKEN>/setWebhook
     ?url=https://<this-service>.onrender.com/webhooks/telegram
     &secret_token=<TELEGRAM_WEBHOOK_SECRET>
   ```
   Per `CLAUDE_CATEGORY_A_VERIFICATION.md`, this URL must be *this service's* own Render-issued
   HTTPS URL — never the backend service's URL (silent 404s, verification never completes).
5. **Confirm registration succeeded** by calling Telegram's `getWebhookInfo` and checking the
   response's `url` field matches step 4's URL and `last_error_message` is absent. *(This
   confirmation step is not itself written down in `CLAUDE_ENVIRONMENTS.md` or the session doc —
   both stop at "the manual `setWebhook` call" — but is standard practice for verifying a webhook
   registration actually took before relying on it, and is included here as a recommended addition,
   not as a sourced/verbatim step.)*
   ```
   GET https://api.telegram.org/bot<TOKEN>/getWebhookInfo
   ```
6. **Redeploy is not required** for steps 3–5 (Render env var changes on a running service restart
   it automatically); confirm the restart happened and `/healthz` reports
   `"adapters":{"telegram":"webhook", ...}` before considering activation complete.
