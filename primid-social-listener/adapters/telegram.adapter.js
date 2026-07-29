const express = require('express');
const crypto = require('crypto');
const challengeService = require('../../backend/src/shared/services/challenge.service');

const TELEGRAM_API = 'https://api.telegram.org';
const POLL_INTERVAL_MS = 3000; // long-poll re-arm delay between getUpdates calls (dev only)

// Uniform, enumeration-safe replies — never confirm/deny why a code failed.
const REPLY = {
  SUCCESS:       'Your Telegram account is verified! ✅',
  FAILURE:       "That code didn't work. Check the code in your primID app and try again.",
  NO_USERNAME:   'Please set a Telegram username in Settings, then send the code again.',
  EXPLAINER:     'This bot verifies your Telegram account for primID — open the app to get a code, then send it here.',
};

// Word-boundary-anchored so an unanchored 8-char run doesn't match the first
// 8 characters of a longer word. Mixed-case, matching generateCode()'s actual
// charset (upper + lower + digits) — codes are NOT uppercase-only, so this
// must never be case-normalized before comparison. Up to 3 candidates; trying
// all is safe since a miss is inert per spec.
function extractCodeCandidates(text) {
  if (!text) return [];
  return (text.match(/\b[A-Za-z0-9]{8}\b/g) || []).slice(0, 3);
}

// One-time explainer per chat for non-code organic messages — capped in-memory
// set, same bounded-cache shape as the phone android adapter's message dedup.
const MAX_EXPLAINED = 500;
const explainedChats = new Map();
function hasBeenExplainedTo(chatId) {
  return explainedChats.has(chatId);
}
function markExplained(chatId) {
  explainedChats.set(chatId, true);
  if (explainedChats.size > MAX_EXPLAINED) {
    explainedChats.delete(explainedChats.keys().next().value);
  }
}

async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const res = await globalThis.fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text }),
  });

  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    const retryAfterS = body?.parameters?.retry_after ?? 1;
    console.log(`[telegram-adapter] rate limited, retrying in ${retryAfterS}s`);
    await new Promise((resolve) => setTimeout(resolve, retryAfterS * 1000));
    return globalThis.fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text }),
    });
  }

  return res;
}

// Shared by both webhook and polling delivery — never diverges in behavior
// based on how the Update arrived.
async function processMessage(message) {
  if (!message || message.chat?.type !== 'private') {
    // Group/channel messages (or malformed updates): never processed, never replied to.
    return;
  }

  const chatId = message.chat.id;
  // Lowercase only — the Bot API never includes '@' or a t.me/ URL prefix in
  // from.username, so full canonicalizeHandle() (which also strips those) is
  // unnecessary here. This makes both sides of the HMAC comparison canonical;
  // see PLAN_telegram_listener.md Step 2.
  const senderHandle = message.from?.username?.toLowerCase();

  if (!senderHandle) {
    await sendTelegramMessage(chatId, REPLY.NO_USERNAME);
    return;
  }

  const candidates = extractCodeCandidates(message.text);

  if (candidates.length === 0) {
    if (!hasBeenExplainedTo(chatId)) {
      markExplained(chatId);
      await sendTelegramMessage(chatId, REPLY.EXPLAINER);
    }
    return;
  }

  // challenge.service.js owns all handle-match logic; a miss is inert, so
  // trying every candidate in order is safe — no early exit on a non-match.
  let verified = false;
  for (const code of candidates) {
    const result = await challengeService.validateAndMarkSocial({
      code,
      senderHandle,
      platform: 'telegram',
    });
    if (result) verified = true;
  }

  await sendTelegramMessage(chatId, verified ? REPLY.SUCCESS : REPLY.FAILURE);
}

// ── Webhook mode (production) ────────────────────────────────────────────────

function verifyWebhookSecret(req) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const header = req.get('X-Telegram-Bot-Api-Secret-Token');
  if (!secret || !header) return false;

  const expectedBuf = Buffer.from(secret, 'utf8');
  const actualBuf = Buffer.from(header, 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

async function handleWebhook(req, res) {
  // Step 1: secret validation — fail closed, before any parsing.
  if (!verifyWebhookSecret(req)) {
    return res.status(403).end();
  }

  // Always 200 quickly — Telegram retries aggressively on non-2xx, and a miss
  // is a legitimately inert outcome, not an error.
  res.status(200).end();

  try {
    await processMessage(req.body?.message);
  } catch (err) {
    console.log(`[telegram-adapter] webhook processing error: ${err.message}`);
  }
}

// Registers the webhook route only when this process is configured for
// webhook mode — mirrors the self-contained gating pattern in adapters/phone/index.js.
function mount(app) {
  if (process.env.TELEGRAM_SOCIAL_LISTENER !== 'true' || process.env.TELEGRAM_LISTENER_MODE !== 'webhook') {
    return;
  }
  app.post('/webhooks/telegram', express.json({ limit: '256kb' }), handleWebhook);
}

// ── Polling mode (local dev only) ────────────────────────────────────────────

let pollOffset = 0;

async function pollUpdates() {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const res = await globalThis.fetch(
      `${TELEGRAM_API}/bot${token}/getUpdates?timeout=0&offset=${pollOffset}`
    );

    if (!res.ok) {
      console.log(`[telegram-adapter] poll error: HTTP ${res.status}`);
      setTimeout(pollUpdates, POLL_INTERVAL_MS);
      return;
    }

    const json = await res.json();
    const updates = json.result || [];

    for (const update of updates) {
      pollOffset = update.update_id + 1;
      try {
        await processMessage(update.message);
      } catch (err) {
        console.log(`[telegram-adapter] processing error: ${err.message}`);
      }
    }
  } catch (err) {
    console.log(`[telegram-adapter] poll error: ${err.message}`);
  }

  setTimeout(pollUpdates, POLL_INTERVAL_MS);
}

function startPolling() {
  setTimeout(pollUpdates, 0);
}

module.exports = { mount, startPolling };
