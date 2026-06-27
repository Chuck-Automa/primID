const { computeTierFromUser } = require('../../src/shared/utils/computeTier');

// computeTierFromUser is a pure function — no DB, no mocks needed.

describe('computeTierFromUser', () => {
  const base = {
    zkPassportVerified: false,
    zkEmailVerified: false,
    pohVerified: false,
    ecointerVerified: false,
    oauthVerifiedAt: null,
    phoneVerified: false,
  };

  test('returns null (Ghost) when no verifications', () => {
    expect(computeTierFromUser(base)).toBeNull();
  });

  test('returns 3 when only phone is verified', () => {
    expect(computeTierFromUser({ ...base, phoneVerified: true })).toBe(3);
  });

  test('returns 2 when OAuth is verified (no ZK proofs)', () => {
    expect(computeTierFromUser({ ...base, oauthVerifiedAt: new Date() })).toBe(2);
  });

  test('returns 2 when OAuth + phone are both verified (ZK takes priority)', () => {
    // OAuth alone → 2; phone alone → 3; together → 2 (higher trust wins)
    expect(computeTierFromUser({ ...base, oauthVerifiedAt: new Date(), phoneVerified: true })).toBe(2);
  });

  test('returns 1 when exactly 1 ZK proof is verified (zkPassport)', () => {
    expect(computeTierFromUser({ ...base, zkPassportVerified: true })).toBe(1);
  });

  test('returns 1 when exactly 1 ZK proof is verified (zkEmail)', () => {
    expect(computeTierFromUser({ ...base, zkEmailVerified: true })).toBe(1);
  });

  test('returns 1 when exactly 1 ZK proof is verified (poh)', () => {
    expect(computeTierFromUser({ ...base, pohVerified: true })).toBe(1);
  });

  test('returns 1 when exactly 1 ZK proof is verified (ecointer)', () => {
    expect(computeTierFromUser({ ...base, ecointerVerified: true })).toBe(1);
  });

  test('returns 0 when exactly 2 ZK proofs are verified', () => {
    expect(computeTierFromUser({ ...base, zkPassportVerified: true, zkEmailVerified: true })).toBe(0);
  });

  test('returns 0 when 3 ZK proofs are verified', () => {
    expect(
      computeTierFromUser({ ...base, zkPassportVerified: true, zkEmailVerified: true, pohVerified: true })
    ).toBe(0);
  });

  test('returns 0 when all 4 ZK proofs are verified', () => {
    expect(
      computeTierFromUser({
        ...base,
        zkPassportVerified: true,
        zkEmailVerified: true,
        pohVerified: true,
        ecointerVerified: true,
      })
    ).toBe(0);
  });

  test('ZK proof overrides OAuth and phone when both present', () => {
    expect(
      computeTierFromUser({
        ...base,
        zkPassportVerified: true,
        oauthVerifiedAt: new Date(),
        phoneVerified: true,
      })
    ).toBe(1);
  });

  test('Tier 0 with ZK overrides OAuth and phone', () => {
    expect(
      computeTierFromUser({
        ...base,
        zkPassportVerified: true,
        zkEmailVerified: true,
        oauthVerifiedAt: new Date(),
        phoneVerified: true,
      })
    ).toBe(0);
  });

  test('any 2 distinct protocols from the pool qualify for Tier 0 (poh + ecointer)', () => {
    expect(computeTierFromUser({ ...base, pohVerified: true, ecointerVerified: true })).toBe(0);
  });
});
