const { generateCode, isOnStagingWhitelist } = require('../../src/shared/utils/otp.util');

afterEach(() => {
  delete process.env.NODE_ENV;
  delete process.env.STAGING_PHONE_WHITELIST;
});

describe('generateCode', () => {
  test('returns an 8-character alphanumeric string by default', () => {
    const code = generateCode();
    expect(code).toMatch(/^[A-Za-z0-9]{8}$/);
  });

  test('returns different codes on successive calls (probabilistic)', () => {
    const codes = new Set(Array.from({ length: 10 }, () => generateCode()));
    expect(codes.size).toBeGreaterThan(1);
  });

  test('honours a custom length', () => {
    expect(generateCode(4)).toMatch(/^[A-Za-z0-9]{4}$/);
    expect(generateCode(12)).toMatch(/^[A-Za-z0-9]{12}$/);
  });
});

describe('isOnStagingWhitelist', () => {
  test('returns true for any number outside staging (dev/prod)', () => {
    expect(isOnStagingWhitelist('+10000000000')).toBe(true);
    expect(isOnStagingWhitelist('+19999999999')).toBe(true);
  });

  test('returns true for a whitelisted number in staging', () => {
    process.env.NODE_ENV = 'staging';
    process.env.STAGING_PHONE_WHITELIST = '+12025550101,+12025550102';
    expect(isOnStagingWhitelist('+12025550101')).toBe(true);
    expect(isOnStagingWhitelist('+12025550102')).toBe(true);
  });

  test('returns false for a non-whitelisted number in staging', () => {
    process.env.NODE_ENV = 'staging';
    process.env.STAGING_PHONE_WHITELIST = '+12025550101';
    expect(isOnStagingWhitelist('+19995550000')).toBe(false);
  });

  test('returns false for all numbers when whitelist is empty in staging', () => {
    process.env.NODE_ENV = 'staging';
    process.env.STAGING_PHONE_WHITELIST = '';
    expect(isOnStagingWhitelist('+12025550101')).toBe(false);
  });
});
