// Test environment variables — set before any module is loaded
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-chars-long!!';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
// ALE encryption key (64-char hex = 32 bytes). All-zeros is fine for tests.
process.env.ALE_ENCRYPTION_KEY = '0'.repeat(64);
// Separate HMAC secret — must not equal the encryption key.
process.env.HMAC_SECRET = 'test-hmac-secret-for-unit-tests-only-do-not-use!!';
