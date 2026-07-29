const express = require('express');
const crypto = require('crypto');
const { normalizePhone } = require('../../../backend/src/shared/utils/crypto.util');
const challengeService = require('../../services/challenge.service');
const heartbeatService = require('../../services/heartbeat.service');

// In-memory dedup on payload.messageId — the app retries on non-2xx and slow
// responses (>30s). usedAt in challenge.service.js remains the authoritative
// dedup; this just avoids redundant work on legitimate app-side retries.
//
// hasSeen() is check-only; markSeen() is called only after a message has been
// fully processed without throwing. Marking on first sight (before the DB
// call) would poison the cache on a transient failure: the app's legitimate
// retry would then hit the cache, no-op with 200, and the SMS would be
// dropped forever instead of being retried into success.
const MAX_SEEN = 500;
const seenMessageIds = new Map();

function hasSeen(messageId) {
  if (!messageId) return false;
  return seenMessageIds.has(messageId);
}

function markSeen(messageId) {
  if (!messageId) return;
  seenMessageIds.set(messageId, true);
  if (seenMessageIds.size > MAX_SEEN) {
    seenMessageIds.delete(seenMessageIds.keys().next().value);
  }
}

// Signed message = raw request body bytes + timestamp string, concatenated in
// that order, no separator. Verified against the raw body before JSON parsing.
function verifySignature(req) {
  const secret = process.env.ANDROID_FORWARDER_HMAC_SECRET;
  const signatureHeader = req.get('X-Signature');
  const timestampHeader = req.get('X-Timestamp');
  if (!secret || !signatureHeader || !timestampHeader || !Buffer.isBuffer(req.body)) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(Buffer.concat([req.body, Buffer.from(timestampHeader, 'utf8')]))
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(signatureHeader, 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

function withinReplayWindow(req) {
  const windowS = Number(process.env.ANDROID_FORWARDER_REPLAY_WINDOW_S) || 660;
  const ts = Number(req.get('X-Timestamp'));
  if (!Number.isFinite(ts)) return false;
  return Math.abs(Date.now() / 1000 - ts) <= windowS;
}

// Best-effort parse for logging deviceId/webhookId on a signature/replay
// failure — never logs payload.sender or payload.message.
function safeParseForLogging(req) {
  try {
    const parsed = JSON.parse(req.body.toString('utf8'));
    return { deviceId: parsed.deviceId, webhookId: parsed.webhookId };
  } catch {
    return {};
  }
}

// Word-boundary-anchored: an unanchored 8-char run would match the first 8
// characters of a longer word (e.g. "Verification ABCD1234" incorrectly
// yielding "Verifica"), shadowing the real code. Up to 3 candidates are
// returned; trying all of them is safe since a miss is inert per spec.
function extractCodeCandidates(message) {
  if (!message) return [];
  return (message.match(/\b[A-Za-z0-9]{8}\b/g) || []).slice(0, 3);
}

async function handleSmsReceived(req, res) {
  // Step 1: signature verification — fail closed, before any other processing.
  if (!verifySignature(req)) {
    const { deviceId, webhookId } = safeParseForLogging(req);
    console.log(`[phone.android.adapter] signature mismatch deviceId=${deviceId} webhookId=${webhookId}`);
    return res.status(401).end();
  }

  // Step 2: replay window.
  if (!withinReplayWindow(req)) {
    const { deviceId, webhookId } = safeParseForLogging(req);
    console.log(`[phone.android.adapter] stale timestamp deviceId=${deviceId} webhookId=${webhookId}`);
    return res.status(401).end();
  }

  try {
    const parsed = JSON.parse(req.body.toString('utf8'));
    const payload = parsed.payload || {};

    // Step 3: dedup on messageId — check only; marking happens after
    // processing completes below, so a transient failure can't poison the
    // cache against the app's legitimate retry.
    if (hasSeen(payload.messageId)) {
      return res.status(200).end();
    }

    // Step 4: normalize sender — never error back to the app on a bad number,
    // it would retry a permanently bad message for ~2 days.
    let normalizedFrom;
    try {
      normalizedFrom = normalizePhone(payload.sender);
    } catch {
      return res.status(200).end();
    }

    // Step 5: extract candidate 8-char challenge codes (up to 3).
    const candidates = extractCodeCandidates(payload.message);

    // Step 6: shared challenge service owns all FROM-vs-expected matching.
    // A miss is inert per spec, so trying every candidate in order is safe —
    // no early exit on a non-match.
    for (const code of candidates) {
      await challengeService.validateAndMarkPhone({ code, senderHandle: normalizedFrom });
    }

    // The message is now fully processed with no transient error — safe to
    // mark seen so a legitimate app-side retry short-circuits at Step 3
    // instead of re-running the candidate loop. This holds regardless of
    // whether any candidate matched, and regardless of the candidate list
    // being empty.
    markSeen(payload.messageId);

    // Step 7: always 2xx for a handled case — a miss (no match found) is
    // legitimately inert per spec, not an error.
    return res.status(200).end();
  } catch (err) {
    // Transient/internal error (e.g. DB down) — 500 lets the app's legitimate
    // retry-with-backoff succeed later, distinct from the permanently
    // unprocessable cases above which always return 200.
    console.log(`[phone.android.adapter] error: ${err.message}`);
    return res.status(500).end();
  }
}

async function handleHeartbeat(req, res) {
  if (!verifySignature(req) || !withinReplayWindow(req)) {
    return res.status(401).end();
  }

  try {
    const parsed = JSON.parse(req.body.toString('utf8'));
    await heartbeatService.recordHeartbeat({ provider: 'android', deviceId: parsed.deviceId });
    return res.status(200).end();
  } catch (err) {
    console.log(`[phone.android.adapter] heartbeat error: ${err.message}`);
    return res.status(500).end();
  }
}

function mount(app) {
  app.post('/webhooks/phone/android', express.raw({ type: '*/*', limit: '256kb' }), handleSmsReceived);
  app.post('/webhooks/phone/android/heartbeat', express.raw({ type: '*/*', limit: '64kb' }), handleHeartbeat);
}

module.exports = { mount };
