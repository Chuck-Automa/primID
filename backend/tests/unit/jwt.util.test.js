const {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
} = require('../../src/shared/utils/jwt.util');

const USER_ID = 'abc-123-user-id';

describe('generateAccessToken', () => {
  test('returns a three-part JWT string', () => {
    const token = generateAccessToken(USER_ID, 2);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  test('embeds sub and current_tier in payload', () => {
    const token = generateAccessToken(USER_ID, 2);
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe(USER_ID);
    expect(payload.current_tier).toBe(2);
  });

  test('tier 3 token expires in ~24 hours', () => {
    const token = generateAccessToken(USER_ID, 3);
    const { exp, iat } = verifyAccessToken(token);
    const ttl = exp - iat;
    expect(ttl).toBeGreaterThanOrEqual(86340);
    expect(ttl).toBeLessThanOrEqual(86460);
  });

  test('tier 2 token expires in ~15 minutes', () => {
    const token = generateAccessToken(USER_ID, 2);
    const { exp, iat } = verifyAccessToken(token);
    const ttl = exp - iat;
    expect(ttl).toBeGreaterThanOrEqual(840);  // 14m
    expect(ttl).toBeLessThanOrEqual(960);     // 16m
  });

  test('tier 0 token expires in ~15 minutes', () => {
    const token = generateAccessToken(USER_ID, 0);
    const { exp, iat } = verifyAccessToken(token);
    const ttl = exp - iat;
    expect(ttl).toBeGreaterThanOrEqual(840);
    expect(ttl).toBeLessThanOrEqual(960);
  });

  test('null tier token expires in ~15 minutes (Ghost — should not normally occur)', () => {
    const token = generateAccessToken(USER_ID, null);
    const { exp, iat } = verifyAccessToken(token);
    const ttl = exp - iat;
    expect(ttl).toBeGreaterThanOrEqual(840);
    expect(ttl).toBeLessThanOrEqual(960);
  });
});

describe('verifyAccessToken', () => {
  test('returns decoded payload for a valid token', () => {
    const token = generateAccessToken(USER_ID, 2);
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe(USER_ID);
    expect(payload.current_tier).toBe(2);
  });

  test('throws for a tampered token', () => {
    const token = generateAccessToken(USER_ID, 2);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  test('throws for an empty string', () => {
    expect(() => verifyAccessToken('')).toThrow();
  });

  test('throws for a bogus string', () => {
    expect(() => verifyAccessToken('not.a.jwt')).toThrow();
  });
});

describe('generateRefreshToken', () => {
  test('returns an 80-character hex string', () => {
    const token = generateRefreshToken();
    expect(typeof token).toBe('string');
    expect(token).toHaveLength(80);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  test('generates unique tokens', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
  });
});

describe('hashToken', () => {
  test('returns a 64-character hex SHA-256 hash', () => {
    const hash = hashToken('some-token');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  test('is deterministic — same input produces same hash', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });

  test('different inputs produce different hashes', () => {
    expect(hashToken('abc')).not.toBe(hashToken('def'));
  });
});
