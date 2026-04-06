const { generateOtp, sendOtp, validateOtp, isOnStagingWhitelist } = require('../../src/shared/utils/otp.util');

// Ensure Twilio is not configured so sendOtp uses the dev stub
beforeAll(() => {
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_PHONE_NUMBER;
});

afterEach(() => {
  // Reset NODE_ENV and staging env vars after each test
  delete process.env.NODE_ENV;
  delete process.env.STAGING_OTP_WHITELIST;
  delete process.env.STAGING_OTP_FIXED_CODE;
});

describe('generateOtp', () => {
  test('returns a 6-digit string', () => {
    const code = generateOtp();
    expect(code).toMatch(/^\d{6}$/);
  });

  test('returns different codes on successive calls (probabilistic)', () => {
    const codes = new Set(Array.from({ length: 10 }, () => generateOtp()));
    // Extremely unlikely all 10 are the same
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('sendOtp + validateOtp — dev mode', () => {
  const PHONE = '+15555550100';

  test('sendOtp returns the code in dev mode (no Twilio creds)', async () => {
    const code = generateOtp();
    const returned = await sendOtp(PHONE, code);
    expect(returned).toBe(code);
  });

  test('validateOtp returns true for correct code immediately after sendOtp', async () => {
    const code = generateOtp();
    await sendOtp(PHONE, code);
    expect(validateOtp(PHONE, code)).toBe(true);
  });

  test('validateOtp returns false for wrong code', async () => {
    const code = generateOtp();
    await sendOtp(PHONE, code);
    expect(validateOtp(PHONE, '000000')).toBe(false);
  });

  test('validateOtp returns false when no OTP has been sent for that phone', () => {
    expect(validateOtp('+15555550199', '123456')).toBe(false);
  });

  test('validateOtp removes OTP after successful validation (single-use)', async () => {
    const code = generateOtp();
    await sendOtp(PHONE, code);
    expect(validateOtp(PHONE, code)).toBe(true);
    // Second attempt with same code must fail
    expect(validateOtp(PHONE, code)).toBe(false);
  });

  test('sendOtp overwrites any existing OTP for the same phone', async () => {
    const code1 = generateOtp();
    const code2 = generateOtp();
    await sendOtp(PHONE, code1);
    await sendOtp(PHONE, code2); // overwrites code1
    expect(validateOtp(PHONE, code1)).toBe(false);
    expect(validateOtp(PHONE, code2)).toBe(true);
  });
});

describe('sendOtp + validateOtp — staging mode', () => {
  const WHITELISTED = '+12025550101';
  const FIXED_CODE  = '123456';

  beforeEach(() => {
    process.env.NODE_ENV                = 'staging';
    process.env.STAGING_OTP_WHITELIST   = WHITELISTED;
    process.env.STAGING_OTP_FIXED_CODE  = FIXED_CODE;
  });

  test('sendOtp returns null in staging (code is not exposed in response)', async () => {
    const code = generateOtp();
    const returned = await sendOtp(WHITELISTED, code);
    expect(returned).toBeNull();
  });

  test('validateOtp accepts the fixed staging code regardless of what was generated', async () => {
    const randomCode = generateOtp();
    await sendOtp(WHITELISTED, randomCode); // randomCode is ignored; fixed code stored
    expect(validateOtp(WHITELISTED, FIXED_CODE)).toBe(true);
  });

  test('validateOtp rejects a non-fixed code in staging', async () => {
    const randomCode = generateOtp();
    await sendOtp(WHITELISTED, randomCode);
    // randomCode was NOT stored — fixed code was
    if (randomCode !== FIXED_CODE) {
      expect(validateOtp(WHITELISTED, randomCode)).toBe(false);
    }
  });
});

describe('isOnStagingWhitelist', () => {
  test('returns true for any number outside staging (dev/prod)', () => {
    // NODE_ENV not set to 'staging' → no restriction
    expect(isOnStagingWhitelist('+10000000000')).toBe(true);
    expect(isOnStagingWhitelist('+19999999999')).toBe(true);
  });

  test('returns true for a whitelisted number in staging', () => {
    process.env.NODE_ENV              = 'staging';
    process.env.STAGING_OTP_WHITELIST = '+12025550101,+12025550102';
    expect(isOnStagingWhitelist('+12025550101')).toBe(true);
    expect(isOnStagingWhitelist('+12025550102')).toBe(true);
  });

  test('returns false for a non-whitelisted number in staging', () => {
    process.env.NODE_ENV              = 'staging';
    process.env.STAGING_OTP_WHITELIST = '+12025550101';
    expect(isOnStagingWhitelist('+19995550000')).toBe(false);
  });

  test('returns false for all numbers when whitelist is empty in staging', () => {
    process.env.NODE_ENV              = 'staging';
    process.env.STAGING_OTP_WHITELIST = '';
    expect(isOnStagingWhitelist('+12025550101')).toBe(false);
  });
});
