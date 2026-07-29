// Per-platform handle canonicalization, applied before handle_hmac computation
// and before ALE encryption. Per CLAUDE.md §11: no handle may be HMAC'd or
// encrypted for a platform with no defined canonicalization rule — each rule is
// owned by that platform's verification spec (see CLAUDE_CATEGORY_B_VERIFICATION.md
// for GitHub's, PLAN_telegram_listener.md Step 2 for Telegram's). GitHub and
// Telegram are wired in here (Sprint 2 build scope); Reddit's rule is specified
// in PLAN_reddit_listener.md but not yet applied — add it to this dispatch when
// that plan is executed, rather than a second helper.

const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:-?[A-Za-z0-9])*$/;
const GITHUB_LOGIN_MAX_LENGTH = 39;

function canonicalizeGithubHandle(handle) {
  if (handle.length > GITHUB_LOGIN_MAX_LENGTH || !GITHUB_LOGIN_PATTERN.test(handle)) {
    throw new Error('INVALID_GITHUB_HANDLE');
  }
  return handle.toLowerCase();
}

// Telegram usernames are case-insensitive (@ChuckDev and @chuckdev resolve to
// the same account) — case is presentation, not identity. Strip decoration a
// user might paste (leading @, a t.me/ or https://t.me/ profile link prefix)
// before validating and lowercasing. Pattern is the conservative floor per
// current Telegram constraints (5-32 chars, starts with a letter, letters/
// digits/underscore only) — verify against current docs before loosening.
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

/**
 * Canonicalize a handle per its platform's rule before HMAC/encryption.
 * Platforms with no defined rule pass through unchanged — this is intentional
 * per-platform scope, not an oversight; do not add a blanket default (e.g.
 * lowercasing everything) without defining and documenting the rule for that
 * platform first, per CLAUDE.md §11.
 *
 * Throws Error('INVALID_GITHUB_HANDLE') / Error('INVALID_TELEGRAM_HANDLE') (or
 * a future platform-specific error) if the handle fails that platform's format
 * validation.
 */
function canonicalizeHandle(platform, handle) {
  if (platform === 'github') {
    return canonicalizeGithubHandle(handle);
  }
  if (platform === 'telegram') {
    return canonicalizeTelegramHandle(handle);
  }
  return handle;
}

module.exports = { canonicalizeHandle };
