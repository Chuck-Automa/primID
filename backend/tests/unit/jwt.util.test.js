const { generateToken, verifyToken } = require('../../src/shared/utils/jwt.util');

describe('JWT utilities', () => {
  const USER_ID = 'abc-123-user-id';

  describe('generateToken', () => {
    test('returns a non-empty JWT string', () => {
      const token = generateToken(USER_ID, 2);
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // header.payload.signature
    });

    test('embeds userId and tier in payload', () => {
      const token = generateToken(USER_ID, 2);
      const payload = verifyToken(token);
      expect(payload.userId).toBe(USER_ID);
      expect(payload.tier).toBe(2);
    });

    test('tier 3 token expires in ~24 hours', () => {
      const before = Math.floor(Date.now() / 1000);
      const token = generateToken(USER_ID, 3);
      const { exp, iat } = verifyToken(token);
      const ttl = exp - iat;
      // 24h = 86400s; allow ±60s clock skew
      expect(ttl).toBeGreaterThanOrEqual(86340);
      expect(ttl).toBeLessThanOrEqual(86460);
    });

    test('tier 2 token expires in ~90 days', () => {
      const token = generateToken(USER_ID, 2);
      const { exp, iat } = verifyToken(token);
      const ttl = exp - iat;
      // 90d = 7776000s; allow ±60s clock skew
      expect(ttl).toBeGreaterThanOrEqual(7775940);
      expect(ttl).toBeLessThanOrEqual(7776060);
    });

    test('tier 0 token expires in ~90 days (same as tier 2)', () => {
      const token = generateToken(USER_ID, 0);
      const { exp, iat } = verifyToken(token);
      const ttl = exp - iat;
      expect(ttl).toBeGreaterThanOrEqual(7775940);
      expect(ttl).toBeLessThanOrEqual(7776060);
    });

    test('null tier token expires in ~90 days (Ghost user)', () => {
      const token = generateToken(USER_ID, null);
      const { exp, iat } = verifyToken(token);
      const ttl = exp - iat;
      expect(ttl).toBeGreaterThanOrEqual(7775940);
      expect(ttl).toBeLessThanOrEqual(7776060);
    });
  });

  describe('verifyToken', () => {
    test('returns decoded payload for valid token', () => {
      const token = generateToken(USER_ID, 2);
      const payload = verifyToken(token);
      expect(payload.userId).toBe(USER_ID);
    });

    test('throws for an invalid (tampered) token', () => {
      const token = generateToken(USER_ID, 2);
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(() => verifyToken(tampered)).toThrow();
    });

    test('throws for an empty string', () => {
      expect(() => verifyToken('')).toThrow();
    });

    test('throws for a completely bogus string', () => {
      expect(() => verifyToken('not.a.jwt')).toThrow();
    });
  });
});
