// Lightweight mock for src/shared/utils/crypto.util.js
// Avoids real AES/HMAC ops and libphonenumber validation in tests.
// normalizePhone: accepts any '+'-prefixed string (no library validation).
// computeHmac: deterministic, prefix-based — same input always gives same output.
// encrypt/decrypt: simple reversible encoding.

module.exports = {
  normalizePhone: (raw) => {
    if (!raw || !raw.startsWith('+')) throw new Error('INVALID_PHONE');
    return raw; // pass-through — no libphonenumber-js call
  },
  computeHmac: (plaintext) => `hmac::${plaintext}`,
  encrypt:     (plaintext) => `enc::${plaintext}`,
  decrypt:     (ciphertext) => ciphertext.replace(/^enc::/, ''),
  encryptWalletAddress: (a) => `enc::${a}`,
  decryptWalletAddress: (a) => a.replace(/^enc::/, ''),
};
