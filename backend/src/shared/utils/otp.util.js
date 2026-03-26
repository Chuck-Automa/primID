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
 * Store OTP hash for a phone number (overwrites any existing OTP).
 * In dev (no Twilio creds), logs the code to console and returns it.
 * In prod, sends via Twilio and returns null.
 */
async function sendOtp(phoneNumber, code) {
  const hash = hashOtp(code);
  const expiry = Date.now() + OTP_TTL_MS;
  otpStore.set(phoneNumber, { hash, expiry });

  const hasTwilioCreds =
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER;

  if (hasTwilioCreds) {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body: `Your primID verification code is: ${code}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });
    return null;
  }

  // Dev stub: log to console
  console.log(`[DEV OTP] Phone: ${phoneNumber} → Code: ${code}`);
  return code;
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

module.exports = { generateOtp, sendOtp, validateOtp };
