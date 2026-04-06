const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/shared/db/prisma');

jest.mock('axios');
const axios = require('axios');

const PHONE = '+15555550102';

function makeUser(overrides = {}) {
  return {
    id: 'uid-verify-test',
    phoneNumber: `enc::${PHONE}`,
    phoneNumberHmac: `hmac::${PHONE}`,
    zkPassportVerified: false,
    zkEmailVerified: false,
    pohVerified: false,
    ecoinmterVerified: false,
    oauthVerifiedAt: null,
    phoneVerified: false,
    currentTier: null,
    ...overrides,
  };
}

afterEach(() => {
  delete process.env.NODE_ENV;
  delete process.env.STAGING_OTP_WHITELIST;
  delete process.env.STAGING_OTP_FIXED_CODE;
});

describe('POST /api/verify/phone/initiate', () => {
  test('200 — existing user, sends OTP and returns devCode', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(makeUser());

    const res = await request(app)
      .post('/api/verify/phone/initiate')
      .send({ phoneNumber: PHONE });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.devCode).toMatch(/^\d{6}$/);
  });

  test('200 — new user is created automatically and OTP sent', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null); // no existing user
    prisma.user.create.mockResolvedValueOnce(makeUser());

    const res = await request(app)
      .post('/api/verify/phone/initiate')
      .send({ phoneNumber: PHONE });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.devCode).toMatch(/^\d{6}$/);
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
  });

  test('403 DEMO_RESTRICTED — non-whitelisted number in staging', async () => {
    process.env.NODE_ENV              = 'staging';
    process.env.STAGING_OTP_WHITELIST = '+12025550101';

    const res = await request(app)
      .post('/api/verify/phone/initiate')
      .send({ phoneNumber: PHONE }); // PHONE is not on whitelist

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('DEMO_RESTRICTED');
  });

  test('200 — whitelisted number in staging gets fixed OTP (devCode not returned)', async () => {
    const WHITELISTED = '+12025550101';
    process.env.NODE_ENV              = 'staging';
    process.env.STAGING_OTP_WHITELIST = WHITELISTED;
    process.env.STAGING_OTP_FIXED_CODE = '123456';

    prisma.user.findUnique.mockResolvedValueOnce(makeUser({ phoneNumber: `enc::${WHITELISTED}` }));

    const res = await request(app)
      .post('/api/verify/phone/initiate')
      .send({ phoneNumber: WHITELISTED });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // devCode must NOT be returned in staging — reviewers know the fixed code out-of-band
    expect(res.body.devCode).toBeUndefined();
  });

  test('400 — missing phoneNumber', async () => {
    const res = await request(app)
      .post('/api/verify/phone/initiate')
      .send({});

    expect(res.status).toBe(400);
  });

  test('400 — phone number without + prefix', async () => {
    const res = await request(app)
      .post('/api/verify/phone/initiate')
      .send({ phoneNumber: '5555550102' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/verify/phone/confirm', () => {
  test('200 — valid OTP issues JWT and returns Tier 3 user', async () => {
    // Step 1: initiate to store OTP in memory (existing user path)
    prisma.user.findUnique.mockResolvedValueOnce(makeUser());
    const initRes = await request(app)
      .post('/api/verify/phone/initiate')
      .send({ phoneNumber: PHONE });
    const { devCode } = initRes.body;

    // Step 2: confirm — user exists, update phone verification
    const verifiedUser = makeUser({ phoneVerified: true, phoneVerifiedAt: new Date() });
    prisma.user.findUnique.mockResolvedValueOnce(verifiedUser); // existence check
    prisma.user.update
      .mockResolvedValueOnce(verifiedUser)                        // set phoneVerified
      .mockResolvedValueOnce({ ...verifiedUser, currentTier: 3 }); // computeTier update
    prisma.user.findUniqueOrThrow.mockResolvedValue({ ...verifiedUser, currentTier: 3 });

    const res = await request(app)
      .post('/api/verify/phone/confirm')
      .send({ phoneNumber: PHONE, code: devCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.tier).toBe(3);
  });

  test('404 — confirm with phone number that has no account', async () => {
    // Initiate a fresh OTP without a real user (we need the OTP in store)
    prisma.user.findUnique.mockResolvedValueOnce(makeUser()); // initiate: user exists
    const initRes = await request(app)
      .post('/api/verify/phone/initiate')
      .send({ phoneNumber: PHONE });
    const { devCode } = initRes.body;

    // Confirm: user is not found
    prisma.user.findUnique.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/verify/phone/confirm')
      .send({ phoneNumber: PHONE, code: devCode });

    expect(res.status).toBe(404);
  });

  test('400 — invalid OTP code', async () => {
    // Initiate to store a valid OTP
    prisma.user.findUnique.mockResolvedValueOnce(makeUser());
    await request(app)
      .post('/api/verify/phone/initiate')
      .send({ phoneNumber: PHONE });

    // Confirm returns 400 before any DB call — no findUnique mock needed
    const res = await request(app)
      .post('/api/verify/phone/confirm')
      .send({ phoneNumber: PHONE, code: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or expired/i);
  });

  test('400 — missing code field', async () => {
    const res = await request(app)
      .post('/api/verify/phone/confirm')
      .send({ phoneNumber: PHONE });

    expect(res.status).toBe(400);
  });

  test('400 — missing phoneNumber field', async () => {
    const res = await request(app)
      .post('/api/verify/phone/confirm')
      .send({ code: '123456' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/verify/oauth — login (existing user)', () => {
  test('200 — Google OAuth login issues Tier 2 JWT', async () => {
    axios.get = jest.fn().mockResolvedValue({
      data: { sub: 'google-sub-xyz', email: 'user@gmail.com' },
    });

    const existingUser = makeUser({ id: 'uid-existing', oauthVerifiedAt: new Date() });
    prisma.user.findUnique.mockResolvedValueOnce(existingUser); // oauthSubHmac lookup
    prisma.user.upsert.mockResolvedValue(existingUser);
    prisma.user.findUniqueOrThrow.mockResolvedValue(existingUser);
    prisma.user.update.mockResolvedValue({ ...existingUser, currentTier: 2 });

    const res = await request(app)
      .post('/api/verify/oauth')
      .send({ provider: 'google', token: 'valid-google-id-token' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.tier).toBe(2);
  });

  test('200 — Google OAuth creates account for new user (upsert on first sign-in)', async () => {
    axios.get = jest.fn().mockResolvedValue({
      data: { sub: 'google-sub-new', email: 'new@gmail.com' },
    });

    const newUser = makeUser({ id: 'uid-new', oauthVerifiedAt: new Date() });
    prisma.user.findUnique.mockResolvedValueOnce(null); // new user — no _isLoginOnly flag set
    prisma.user.upsert.mockResolvedValue(newUser);
    prisma.user.findUniqueOrThrow.mockResolvedValue(newUser);
    prisma.user.update.mockResolvedValue({ ...newUser, currentTier: 2 });

    const res = await request(app)
      .post('/api/verify/oauth')
      .send({ provider: 'google', token: 'valid-google-id-token' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('200 — Apple stub succeeds in dev (no APPLE_CLIENT_ID)', async () => {
    const newUser = makeUser({ id: 'uid-apple-stub', oauthVerifiedAt: new Date() });
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.upsert.mockResolvedValue(newUser);
    prisma.user.findUniqueOrThrow.mockResolvedValue(newUser);
    prisma.user.update.mockResolvedValue({ ...newUser, currentTier: 2 });

    // APPLE_CLIENT_ID is not set in test env — stub path should be taken.
    const res = await request(app)
      .post('/api/verify/oauth')
      .send({ provider: 'apple', token: 'apple_test_token' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('401 — invalid Google token', async () => {
    axios.get = jest.fn().mockRejectedValue({ response: { status: 400 } });

    const res = await request(app)
      .post('/api/verify/oauth')
      .send({ provider: 'google', token: 'bad-token' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid google token/i);
  });

  test('503 — Apple returns 503 when APPLE_CLIENT_ID is unset in production', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const res = await request(app)
      .post('/api/verify/oauth')
      .send({ provider: 'apple', token: 'any-apple-token' });

    process.env.NODE_ENV = original;

    expect(res.status).toBe(503);
  });

  test('400 — invalid provider', async () => {
    const res = await request(app)
      .post('/api/verify/oauth')
      .send({ provider: 'twitter', token: 'some-token' });

    expect(res.status).toBe(400);
  });

  test('400 — missing token', async () => {
    const res = await request(app)
      .post('/api/verify/oauth')
      .send({ provider: 'google' });

    expect(res.status).toBe(400);
  });
});

describe('Sprint 2 stub endpoints', () => {
  test('POST /api/verify/zkpassport → 501', async () => {
    const res = await request(app).post('/api/verify/zkpassport').send({});
    expect(res.status).toBe(501);
  });

  test('POST /api/verify/zkemail → 501', async () => {
    const res = await request(app).post('/api/verify/zkemail').send({});
    expect(res.status).toBe(501);
  });

  test('POST /api/verify/poh → 501', async () => {
    const res = await request(app).post('/api/verify/poh').send({});
    expect(res.status).toBe(501);
  });

  test('POST /api/verify/ecoinmter → 501', async () => {
    const res = await request(app).post('/api/verify/ecoinmter').send({});
    expect(res.status).toBe(501);
  });
});
