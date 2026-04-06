const crypto = require('crypto');
const { parsePhoneNumberFromString } = require('libphonenumber-js');

// ── Key bootstrap ─────────────────────────────────────────────────────────────
//
// Production: set ALE_KMS_KEY_ARN in .env. Call AWS KMS GenerateDataKey /
// Decrypt at startup to obtain a 32-byte data key held in memory only.
// Never write the plaintext data key to disk or logs.
//
// Dev / staging: set ALE_ENCRYPTION_KEY as a 64-char hex string (32 bytes).
// Generate with: openssl rand -hex 32
//
// TODO (pre-prod): replace _loadKeyFromEnv with KMS data-key fetch below:
//
//   const { KMSClient, DecryptCommand } = require('@aws-sdk/client-kms');
//   async function loadKeyFromKms() {
//     const client = new KMSClient({ region: process.env.AWS_REGION });
//     const { Plaintext } = await client.send(new DecryptCommand({
//       CiphertextBlob: Buffer.from(process.env.ALE_ENCRYPTED_DATA_KEY, 'base64'),
//       KeyId: process.env.ALE_KMS_KEY_ARN,
//     }));
//     return Buffer.from(Plaintext);
//   }

let _aleKey = null;

function getAleKey() {
  if (_aleKey) return _aleKey;
  const raw = process.env.ALE_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'ALE_ENCRYPTION_KEY not set. ' +
      'For dev: generate with `openssl rand -hex 32`. ' +
      'For production: set ALE_KMS_KEY_ARN and use KMS-derived data key.'
    );
  }
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) {
    throw new Error('ALE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  }
  _aleKey = key;
  return _aleKey;
}

function getHmacSecret() {
  const s = process.env.HMAC_SECRET;
  if (!s) throw new Error('HMAC_SECRET not set. Generate with: openssl rand -hex 32');
  return s;
}

// ── Phone normalization ───────────────────────────────────────────────────────
/**
 * Normalize a raw phone string to canonical E.164.
 * E.164 format is required at the API boundary — no region defaulting.
 * Throws Error('INVALID_PHONE') if the input is missing, lacks a '+' prefix,
 * or does not parse as a valid international number.
 *
 * Must be called as the FIRST step in any code path that touches phone_number —
 * before HMAC computation, before encryption, before any DB operation.
 */
function normalizePhone(raw) {
  if (!raw || !raw.startsWith('+')) throw new Error('INVALID_PHONE');
  const parsed = parsePhoneNumberFromString(raw);
  if (!parsed || !parsed.isValid()) throw new Error('INVALID_PHONE');
  return parsed.number; // canonical E.164, e.g. '+12025551234'
}

// ── HMAC ──────────────────────────────────────────────────────────────────────
/**
 * Compute a deterministic HMAC-SHA256 over plaintext using HMAC_SECRET.
 * Used as the lookup / uniqueness index for ALE-encrypted fields.
 * Same input + same key always produces the same output.
 * Returns a hex string. NEVER return this value in an API response.
 */
function computeHmac(plaintext) {
  return crypto.createHmac('sha256', getHmacSecret()).update(plaintext).digest('hex');
}

// ── AES-256-GCM encrypt / decrypt ─────────────────────────────────────────────
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns a Base64 string encoding: [12-byte IV][ciphertext][16-byte auth tag]
 * Random IV per call — same plaintext produces a different ciphertext each time.
 * NEVER use the ciphertext column for WHERE clauses; use the _hmac column instead.
 */
function encrypt(plaintext) {
  const key = getAleKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, body, tag]).toString('base64');
}

/**
 * Decrypt a Base64 ALE ciphertext produced by encrypt().
 * Throws on tampered data or wrong key (GCM auth tag mismatch).
 */
function decrypt(ciphertext) {
  const key = getAleKey();
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(buf.length - TAG_BYTES);
  const body = buf.subarray(IV_BYTES, buf.length - TAG_BYTES);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

// wallet_address encryption scaffolding — field is nullable until Sprint 2.
// Call encryptWalletAddress / decryptWalletAddress when the field becomes active.
const encryptWalletAddress = encrypt;
const decryptWalletAddress = decrypt;

module.exports = {
  normalizePhone,
  computeHmac,
  encrypt,
  decrypt,
  encryptWalletAddress,
  decryptWalletAddress,
};
