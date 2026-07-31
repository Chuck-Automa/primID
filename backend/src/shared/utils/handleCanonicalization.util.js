// Per-platform handle canonicalization, applied before handle_hmac computation
// and before ALE encryption. Per CLAUDE.md §11 / CLAUDE_SOCIAL_VERIFICATION.md's
// Handle Canonicalization Registry: no handle may be HMAC'd or encrypted for a
// platform with no defined canonicalization rule. This module is the single
// place canonicalization logic lives — controllers, adapters, and crawlers call
// canonicalizeHandle()/hasCanonicalizationRule(), never reimplement a rule.
//
// REGISTRY keys are the platform strings actually used by the product code
// (VALID_PLATFORMS in social.controller.js), not necessarily the strings used
// in CLAUDE_SOCIAL_VERIFICATION.md's prose (e.g. the doc's "twitter" row is
// this codebase's "x"). See the hardening commit message for the full
// doc↔code discrepancy report.

// ── github ────────────────────────────────────────────────────────────────────
// Unchanged from the pre-registry dispatch — byte-for-byte identical behavior.
// Authoritative rule lives in CLAUDE_CATEGORY_B_VERIFICATION.md, not the parent
// doc's registry row (which additionally specifies stripping @ / a github.com/
// URL prefix that this implementation has never done — preserved as-is per the
// no-behavior-change requirement on this hardening pass).
const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:-?[A-Za-z0-9])*$/;
const GITHUB_LOGIN_MAX_LENGTH = 39;

function canonicalizeGithubHandle(handle) {
  if (handle.length > GITHUB_LOGIN_MAX_LENGTH || !GITHUB_LOGIN_PATTERN.test(handle)) {
    throw new Error('INVALID_GITHUB_HANDLE');
  }
  return handle.toLowerCase();
}

// ── telegram ──────────────────────────────────────────────────────────────────
// Unchanged from the pre-registry dispatch — byte-for-byte identical behavior.
const TELEGRAM_HANDLE_PATTERN = /^[a-z][a-z0-9_]{4,31}$/;
const TELEGRAM_URL_PREFIX = /^(https?:\/\/)?t\.me\//i;

function canonicalizeTelegramHandle(handle) {
  let candidate = handle.trim().replace(TELEGRAM_URL_PREFIX, '');
  if (candidate.startsWith('@')) candidate = candidate.slice(1);
  candidate = candidate.toLowerCase();

  if (!TELEGRAM_HANDLE_PATTERN.test(candidate)) {
    throw new Error('INVALID_TELEGRAM_HANDLE');
  }
  return candidate;
}

// ── x (twitter) ───────────────────────────────────────────────────────────────
// Doc row name is "twitter" — code's platform string is "x". See discrepancy
// report in the hardening commit message; not renamed here per instruction.
const X_HANDLE_PATTERN = /^[a-z0-9_]{1,15}$/;
const X_URL_PREFIX = /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\//i;

function canonicalizeXHandle(handle) {
  let candidate = handle.trim().replace(X_URL_PREFIX, '');
  if (candidate.startsWith('@')) candidate = candidate.slice(1);
  candidate = candidate.toLowerCase();

  if (!X_HANDLE_PATTERN.test(candidate)) {
    throw new Error('INVALID_X_HANDLE');
  }
  return candidate;
}

// ── instagram ─────────────────────────────────────────────────────────────────
const INSTAGRAM_URL_PREFIX = /^(https?:\/\/)?(www\.)?instagram\.com\//i;
const INSTAGRAM_BASE_PATTERN = /^[a-z0-9._]{1,30}$/;

function canonicalizeInstagramHandle(handle) {
  let candidate = handle.trim().replace(INSTAGRAM_URL_PREFIX, '');
  if (candidate.startsWith('@')) candidate = candidate.slice(1);
  candidate = candidate.toLowerCase();

  if (
    !INSTAGRAM_BASE_PATTERN.test(candidate) ||
    candidate.startsWith('.') ||
    candidate.endsWith('.') ||
    candidate.includes('..')
  ) {
    throw new Error('INVALID_INSTAGRAM_HANDLE');
  }
  return candidate;
}

// ── facebook ──────────────────────────────────────────────────────────────────
const FACEBOOK_URL_PREFIX = /^(https?:\/\/)?(www\.)?facebook\.com\//i;
const FACEBOOK_PATTERN = /^[a-z0-9.]{5,50}$/;

function canonicalizeFacebookHandle(handle) {
  const candidate = handle.trim().replace(FACEBOOK_URL_PREFIX, '').toLowerCase();

  if (!FACEBOOK_PATTERN.test(candidate)) {
    throw new Error('INVALID_FACEBOOK_HANDLE');
  }
  return candidate;
}

// ── bluesky ───────────────────────────────────────────────────────────────────
// Handles are DNS names — lowercase by definition.
const BLUESKY_URL_PREFIX = /^https?:\/\//i;
const BLUESKY_HOSTNAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

function canonicalizeBlueskyHandle(handle) {
  let candidate = handle.trim().replace(BLUESKY_URL_PREFIX, '');
  if (candidate.startsWith('@')) candidate = candidate.slice(1);
  candidate = candidate.toLowerCase();

  if (!BLUESKY_HOSTNAME_PATTERN.test(candidate)) {
    throw new Error('INVALID_BLUESKY_HANDLE');
  }
  return candidate;
}

// ── farcaster ─────────────────────────────────────────────────────────────────
// fnames and ENS-style names both in use.
const FARCASTER_URL_PREFIX = /^(https?:\/\/)?(www\.)?warpcast\.com\//i;
const FARCASTER_FNAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,15}$/;
const FARCASTER_ENS_PATTERN = /^[a-z0-9-]+\.eth$/;

function canonicalizeFarcasterHandle(handle) {
  let candidate = handle.trim().replace(FARCASTER_URL_PREFIX, '');
  if (candidate.startsWith('@')) candidate = candidate.slice(1);
  candidate = candidate.toLowerCase();

  if (!FARCASTER_FNAME_PATTERN.test(candidate) && !FARCASTER_ENS_PATTERN.test(candidate)) {
    throw new Error('INVALID_FARCASTER_HANDLE');
  }
  return candidate;
}

// ── linkedin ──────────────────────────────────────────────────────────────────
// Vanity URL slug is the handle.
const LINKEDIN_URL_PREFIX = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\//i;
const LINKEDIN_PATTERN = /^[a-z0-9-]{3,100}$/;

function canonicalizeLinkedinHandle(handle) {
  let candidate = handle.trim().replace(LINKEDIN_URL_PREFIX, '');
  candidate = candidate.replace(/\/+$/, ''); // strip trailing slash(es)
  candidate = candidate.toLowerCase();

  if (!LINKEDIN_PATTERN.test(candidate)) {
    throw new Error('INVALID_LINKEDIN_HANDLE');
  }
  return candidate;
}

// ── signal (Category C) ──────────────────────────────────────────────────────
// name.NN username+discriminator format.
const SIGNAL_PATTERN = /^[a-z_][a-z0-9_.]{2,31}\.[0-9]{2,9}$/;

function canonicalizeSignalHandle(handle) {
  let candidate = handle.trim();
  if (candidate.startsWith('@')) candidate = candidate.slice(1);
  candidate = candidate.toLowerCase();

  if (!SIGNAL_PATTERN.test(candidate)) {
    throw new Error('INVALID_SIGNAL_HANDLE');
  }
  return candidate;
}

// ── bitchat (Category C) ─────────────────────────────────────────────────────
// Provisional — ephemeral-nickname model poorly suited to stable handles.
const BITCHAT_PATTERN = /^[a-z0-9_-]{1,32}$/;

function canonicalizeBitchatHandle(handle) {
  const candidate = handle.trim().toLowerCase();

  if (!BITCHAT_PATTERN.test(candidate)) {
    throw new Error('INVALID_BITCHAT_HANDLE');
  }
  return candidate;
}

// ── nostr ─────────────────────────────────────────────────────────────────────
// The only non-lowercase-transform rule: canonical form is the 64-char hex
// pubkey, decoded from the user-supplied bech32 npub. No npm dependency
// (nostr-tools rejected per CLAUDE_SUPPLY_CHAIN.md review) — vendored minimal
// bech32 decode below, implementing BIP-173's reference algorithm (the same
// algorithm NIP-19 specifies as "bech32-(not-m)"). Verified against the two
// official test vectors published in NIP-19
// (https://github.com/nostr-protocol/nips/blob/master/19.md):
//   npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6
//     -> 3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d
//   npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg
//     -> 7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e
// plus round-trip and invalid-checksum-rejection — see handleCanonicalization.util.test.js.
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function bech32Polymod(values) {
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((b >> i) & 1) chk ^= BECH32_GEN[i];
    }
  }
  return chk >>> 0;
}

function bech32HrpExpand(hrp) {
  const ret = [];
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >> 5);
  ret.push(0);
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31);
  return ret;
}

function bech32Decode(bechString) {
  if (typeof bechString !== 'string' || bechString.length > 90) {
    throw new Error('INVALID_NOSTR_HANDLE');
  }
  if (bechString !== bechString.toLowerCase() && bechString !== bechString.toUpperCase()) {
    throw new Error('INVALID_NOSTR_HANDLE'); // mixed case is invalid bech32
  }
  const str = bechString.toLowerCase();
  const pos = str.lastIndexOf('1');
  if (pos < 1 || pos + 7 > str.length) throw new Error('INVALID_NOSTR_HANDLE');

  const hrp = str.substring(0, pos);
  const data = [];
  for (const c of str.substring(pos + 1)) {
    const d = BECH32_CHARSET.indexOf(c);
    if (d === -1) throw new Error('INVALID_NOSTR_HANDLE');
    data.push(d);
  }
  if (bech32Polymod(bech32HrpExpand(hrp).concat(data)) !== 1) {
    throw new Error('INVALID_NOSTR_HANDLE'); // checksum mismatch
  }
  return { hrp, data: data.slice(0, data.length - 6) }; // strip 6-word checksum
}

// Regroups an array of 5-bit words into 8-bit bytes (no padding — npub data
// must divide evenly into whole bytes).
function convertBits5to8(data) {
  let acc = 0;
  let bits = 0;
  const ret = [];
  for (const value of data) {
    acc = (acc << 5) | value;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      ret.push((acc >> bits) & 0xff);
    }
  }
  if (bits >= 5 || (acc << (8 - bits)) & 0xff) {
    throw new Error('INVALID_NOSTR_HANDLE'); // non-zero padding — malformed
  }
  return ret;
}

const NOSTR_URI_PREFIX = /^nostr:/i;
const NOSTR_NPUB_PATTERN = /^npub1[a-z0-9]{58}$/;
const NOSTR_HEX_PATTERN = /^[0-9a-f]{64}$/i;

function canonicalizeNostrHandle(handle) {
  const candidate = handle.trim().replace(NOSTR_URI_PREFIX, '');

  if (NOSTR_HEX_PATTERN.test(candidate)) {
    return candidate.toLowerCase();
  }

  const lowered = candidate.toLowerCase();
  if (NOSTR_NPUB_PATTERN.test(lowered)) {
    const { hrp, data } = bech32Decode(lowered);
    if (hrp !== 'npub') throw new Error('INVALID_NOSTR_HANDLE');
    const bytes = convertBits5to8(data);
    if (bytes.length !== 32) throw new Error('INVALID_NOSTR_HANDLE');
    return Buffer.from(bytes).toString('hex');
  }

  throw new Error('INVALID_NOSTR_HANDLE');
}

// ── registry ──────────────────────────────────────────────────────────────────
// Keys MUST match VALID_PLATFORMS in social.controller.js exactly. "reddit" is
// intentionally absent — it is not in VALID_PLATFORMS (self-reported reddit
// accounts cannot currently be registered at all; see the discrepancy report),
// even though a reddit.adapter.js already exists in primid-social-listener.
// reddit.adapter.js's own startup guard (added in this hardening pass) makes
// enabling REDDIT_SOCIAL_LISTENER=true fail fast until reddit is deliberately
// added here — consistent with CLAUDE_CATEGORY_A_VERIFICATION.md's rule that
// the Reddit adapter is blocked on an open compliance review.
const REGISTRY = {
  github:    canonicalizeGithubHandle,
  telegram:  canonicalizeTelegramHandle,
  x:         canonicalizeXHandle,
  instagram: canonicalizeInstagramHandle,
  facebook:  canonicalizeFacebookHandle,
  bluesky:   canonicalizeBlueskyHandle,
  farcaster: canonicalizeFarcasterHandle,
  linkedin:  canonicalizeLinkedinHandle,
  signal:    canonicalizeSignalHandle,
  bitchat:   canonicalizeBitchatHandle,
  nostr:     canonicalizeNostrHandle,
};

/**
 * True iff `platform` has a defined canonicalization rule. Used by structural
 * guards (registration, adapter/crawler startup) to refuse an unregistered
 * platform rather than silently passing a handle through unchanged.
 */
function hasCanonicalizationRule(platform) {
  return Object.prototype.hasOwnProperty.call(REGISTRY, platform);
}

/**
 * Canonicalize a handle per its platform's rule before HMAC/encryption.
 * Throws Error('UNSUPPORTED_PLATFORM') if the platform has no registry entry —
 * there is no passthrough default; every platform must define its rule here
 * (CLAUDE.md §11) before any code path may HMAC or ALE-encrypt its handles.
 * Throws a platform-specific Error (e.g. 'INVALID_GITHUB_HANDLE') if the
 * handle fails that platform's format validation.
 */
function canonicalizeHandle(platform, handle) {
  const fn = REGISTRY[platform];
  if (!fn) throw new Error('UNSUPPORTED_PLATFORM');
  return fn(handle);
}

module.exports = { canonicalizeHandle, hasCanonicalizationRule };
