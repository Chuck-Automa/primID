const crypto = require('crypto');

// In-memory OTP store: phoneNumber → { hash, expiry }
// NOT for production at scale — replace with Redis for multi-instance deployments
const otpStore = new Map();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Returns staging config if NODE_ENV === 'staging' and whitelist is configured.
 * Returns null in dev/prod (no whitelist restriction).
 */
function getStagingConfig() {
  if (process.env.NODE_ENV !== 'staging') return null;
  const whitelist = (process.env.STAGING_OTP_WHITELIST || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const fixedCode = process.env.STAGING_OTP_FIXED_CODE || '123456';
  return { whitelist, fixedCode };
}

/**
 * Returns true if the phone number is allowed to receive an OTP.
 * In staging: only whitelisted E.164 numbers are allowed.
 * In dev/prod: always returns true (no restriction).
 */
function isOnStagingWhitelist(phoneNumber) {
  const config = getStagingConfig();
  if (!config) return true;
  return config.whitelist.includes(phoneNumber);
}

/**
 * Store OTP hash for a phone number (overwrites any existing OTP).
 *
 * Staging mode: ignores the passed `code` and uses STAGING_OTP_FIXED_CODE instead.
 *   The fixed code is communicated to reviewers out-of-band — never returned in the response.
 *
 * Dev mode (no Twilio creds): logs the code to console and returns it in the response.
 *
 * Prod mode (Twilio configured): sends via Twilio and returns null.
 */
async function sendOtp(phoneNumber, code) {
  const stagingConfig = getStagingConfig();

  // In staging, the fixed OTP overrides whatever was generated.
  const resolvedCode = stagingConfig ? stagingConfig.fixedCode : code;

  otpStore.set(phoneNumber, {
    hash:   hashOtp(resolvedCode),
    expiry: Date.now() + OTP_TTL_MS,
  });

  if (stagingConfig) {
    // Fixed code communicated out-of-band — never expose in response, never call Twilio.
    console.log(`[STAGING OTP] Phone: ${phoneNumber} → fixed code applied`);
    return null;
  }

  const hasTwilioCreds =
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER;

  if (hasTwilioCreds) {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body: `Your primID verification code is: ${resolvedCode}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to:   phoneNumber,
    });
    return null;
  }

  // Dev stub: log to console and return code for display in UI
  console.log(`[DEV OTP] Phone: ${phoneNumber} → Code: ${resolvedCode}`);
  return resolvedCode;
}

/**
 * Validate a submitted OTP code against the stored hash.
 * Returns true if valid and not expired; removes entry on success.
 */
function validateOtp(phoneNumber, code) {
  const entry = otpStore.get(phoneNumber);
  if (!entry) return false;
  if (Date.now() > entry.expiry) {
    otpStore.delete(phoneNumber);
    return false;
  }
  const valid = hashOtp(code) === entry.hash;
  if (valid) otpStore.delete(phoneNumber);
  return valid;
}

module.exports = { generateOtp, sendOtp, validateOtp, isOnStagingWhitelist };
