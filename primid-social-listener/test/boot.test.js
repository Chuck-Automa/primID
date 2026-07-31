// Boot-behavior tests for index.js/app.js — no jest, no new dependency: uses
// Node's built-in test runner (node --test) and spawns the real process, since
// what's under test is process-level (does $PORT bind, does the process exit)
// rather than anything unit-testable in-process.
'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');

const INDEX_PATH = path.join(__dirname, '..', 'index.js');
const LISTENER_DIR = path.join(__dirname, '..');

const BASE_ENV = {
  PATH: process.env.PATH,
  DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/primid_boot_test',
  HMAC_SECRET: 'a'.repeat(64),
  ALE_ENCRYPTION_KEY: 'b'.repeat(64),
};

const children = [];

function spawnListener(port, overrides) {
  const env = {
    ...BASE_ENV,
    PORT: String(port),
    ...overrides,
  };
  // Strip anything a developer's shell might have set for these flags so each
  // test's env is exactly what it declares — nothing implicit.
  for (const key of [
    'REDDIT_SOCIAL_LISTENER', 'TELEGRAM_SOCIAL_LISTENER', 'TELEGRAM_LISTENER_MODE',
    'PHONE_LISTENER_PROVIDER', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET',
    'REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_REFRESH_TOKEN',
    'ANDROID_FORWARDER_HMAC_SECRET', 'ALE_KMS_KEY_ARN', 'NODE_ENV',
  ]) {
    if (!(key in env)) delete env[key];
  }

  const child = spawn(process.execPath, [INDEX_PATH], {
    cwd: LISTENER_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });

  return {
    child,
    getOutput: () => ({ stdout, stderr }),
    exited: new Promise((resolve) => {
      child.on('exit', (code, signal) => resolve({ code, signal }));
    }),
  };
}

function killAll() {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
    }
  }
}
after(killAll);

function getJson(port, pathName, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { host: '127.0.0.1', port, path: pathName, timeout: timeoutMs },
      (res) => {
        let body = '';
        res.on('data', (d) => { body += d; });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, body: body ? JSON.parse(body) : null });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('request timeout')); });
  });
}

// Polls until the server responds or the deadline passes — the child needs a
// moment to finish requiring app.js and call listen().
async function waitForHealthz(port, deadlineMs) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < deadlineMs) {
    try {
      return await getJson(port, '/healthz', 500);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw lastErr || new Error('healthz never responded');
}

// Waits for process exit, racing against a deadline so a test can't hang
// forever if the process unexpectedly stays alive.
async function waitForExit(exitedPromise, deadlineMs) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ code: null, signal: 'TIMEOUT' }), deadlineMs);
  });
  const result = await Promise.race([exitedPromise, timeout]);
  clearTimeout(timer);
  return result;
}

test('all flags off: server binds $PORT, /healthz is 200, no adapters active', async () => {
  const port = 8191;
  const { child, exited, getOutput } = spawnListener(port, {});

  const res = await waitForHealthz(port, 5000);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { status: 'ok', adapters: { telegram: 'off', phone: 'off' } });
  assert.equal(child.exitCode, null, `process should still be running; stderr: ${getOutput().stderr}`);

  child.kill('SIGKILL');
  await exited;
});

test('webhook mode: /healthz reports telegram=webhook and the webhook route is mounted', async () => {
  const port = 8192;
  const { child, exited, getOutput } = spawnListener(port, {
    TELEGRAM_SOCIAL_LISTENER: 'true',
    TELEGRAM_LISTENER_MODE: 'webhook',
    TELEGRAM_BOT_TOKEN: 'fake-token',
    TELEGRAM_WEBHOOK_SECRET: 'fake-secret',
  });

  const res = await waitForHealthz(port, 5000);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { status: 'ok', adapters: { telegram: 'webhook', phone: 'off' } });

  // Confirm the route was actually mounted (403 on missing secret header, not
  // a 404 which would mean mount() didn't run for this mode).
  const webhookRes = await new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: '/webhooks/telegram', method: 'POST', timeout: 2000 },
      (r) => resolve(r)
    );
    req.on('error', reject);
    req.end(JSON.stringify({}));
  });
  assert.equal(webhookRes.statusCode, 403);

  assert.equal(child.exitCode, null, `process should still be running; stderr: ${getOutput().stderr}`);
  child.kill('SIGKILL');
  await exited;
});

test('polling mode: server still binds $PORT even though no webhook route is needed', async () => {
  const port = 8193;
  const { child, exited, getOutput } = spawnListener(port, {
    TELEGRAM_SOCIAL_LISTENER: 'true',
    TELEGRAM_LISTENER_MODE: 'polling',
    TELEGRAM_BOT_TOKEN: 'fake-token',
  });

  const res = await waitForHealthz(port, 5000);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { status: 'ok', adapters: { telegram: 'polling', phone: 'off' } });
  assert.equal(child.exitCode, null, `process should still be running; stderr: ${getOutput().stderr}`);

  child.kill('SIGKILL');
  await exited;
});

test('invalid TELEGRAM_LISTENER_MODE: process exits 1 and never binds a port', async () => {
  const port = 8194;
  const { exited, getOutput } = spawnListener(port, {
    TELEGRAM_SOCIAL_LISTENER: 'true',
    TELEGRAM_LISTENER_MODE: 'bogus',
    TELEGRAM_BOT_TOKEN: 'fake-token',
  });

  const result = await waitForExit(exited, 3000);
  assert.equal(result.signal, null, 'process should have exited on its own, not been left running');
  assert.equal(result.code, 1);
  assert.match(getOutput().stderr, /TELEGRAM_LISTENER_MODE=polling\|webhook/);

  // Belt-and-suspenders: confirm nothing is actually listening on the port.
  await assert.rejects(() => getJson(port, '/healthz', 500));
});

// Regression test for audit finding F4: phone.android.adapter.js required a
// pre-relocation path ('../../services/challenge.service') that no longer
// exists, so PHONE_LISTENER_PROVIDER=android crashed at boot with
// MODULE_NOT_FOUND the instant phoneAdapters.mount(app) required it. This
// only asserts module resolution succeeds and the server comes up — real
// gateway connectivity (or DB connectivity, for that matter) failing is fine
// and expected with the dummy env used here.
test('PHONE_LISTENER_PROVIDER=android: boots past module resolution and binds $PORT', async () => {
  const port = 8195;
  const { child, exited, getOutput } = spawnListener(port, {
    PHONE_LISTENER_PROVIDER: 'android',
    ANDROID_FORWARDER_HMAC_SECRET: 'dummy-forwarder-secret',
  });

  const res = await waitForHealthz(port, 5000);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { status: 'ok', adapters: { telegram: 'off', phone: 'android' } });
  assert.doesNotMatch(getOutput().stderr, /MODULE_NOT_FOUND/);
  assert.equal(child.exitCode, null, `process should still be running; stderr: ${getOutput().stderr}`);

  // Confirm the android webhook route was actually mounted (401 on missing
  // signature, not a 404, which would mean mount() silently didn't run).
  const webhookRes = await new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: '/webhooks/phone/android', method: 'POST', timeout: 2000 },
      (r) => resolve(r)
    );
    req.on('error', reject);
    req.end('{}');
  });
  assert.equal(webhookRes.statusCode, 401);

  child.kill('SIGKILL');
  await exited;
});
