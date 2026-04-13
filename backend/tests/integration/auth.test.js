const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/shared/db/prisma');

const PHONE = '+15555550101';
const TEST_GOOGLE_CLIENT_ID = 'test-google-client-id';

let _originalFetch;
beforeEach(() => { _originalFetch = global.fetch; });

function makeUser(overrides = {}) {
  return {
    id: 'uid-auth-test',
    phoneNumber: 'enc::' + PHONE,
    phoneNumberHmac: 'hmac::' + PHONE,
    phoneVerified: false,
    oauthProvider: null,
    oauthVerifiedAt: null,
    currentTier: null,
    ...overrides,
  };
}

afterEach(() => {
  delete process.env.NODE_ENV;
  delete process.env.STAGING_OTP_WHITELIST;
  delete process.env.STAGING_OTP_FIXED_CODE;
  delete process.env.GOOGLE_CLIENT_ID;
  global.fetch = _originalFetch;
});

describe('POST /api/auth/register', () => {
  describe('method=otp', () => {
    test('200 — creates ghost user and sends OTP', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null); // no existing user
      prisma.user.create.mockResolvedValue(makeUser());

      const res = await request(app)
        .post('/api/auth/register')
        .send({ method: 'otp', phoneNumber: PHONE });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/OTP sent/i);
      expect(res.body.devCode).toMatch(/^\d{6}$/);
    });

    test('409 — conflict when phone already exists', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(makeUser()); // existing user

      const res = await request(app)
        .post('/api/auth/register')
        .send({ method: 'otp', phoneNumber: PHONE });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already exists/i);
    });

    test('403 DEMO_RESTRICTED — non-whitelisted number in staging', async () => {
      process.env.NODE_ENV              = 'staging';
      process.env.STAGING_OTP_WHITELIST = '+12025550199'; // different number

      const res = await request(app)
        .post('/api/auth/register')
        .send({ method: 'otp', phoneNumber: PHONE });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('DEMO_RESTRICTED');
    });

    test('400 — missing phoneNumber', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ method: 'otp' });

      expect(res.status).toBe(400);
    });

    test('400 — phone number missing + prefix (not E.164)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ method: 'otp', phoneNumber: '5555550101' });

      expect(res.status).toBe(400);
    });
  });

  describe('method=oauth', () => {
    test('200 — Google OAuth registers new user', async () => {
      process.env.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ sub: 'google-uid-abc', aud: TEST_GOOGLE_CLIENT_ID }),
      });

      // No existing OAuth user → registration path
      prisma.user.findUnique.mockResolvedValueOnce(null); // oauthSubHmac lookup — new user
      const upsertedUser = makeUser({ id: 'uid-oauth-new', oauthVerifiedAt: new Date() });
      prisma.user.upsert.mockResolvedValue(upsertedUser);
      prisma.user.findUniqueOrThrow.mockResolvedValue(upsertedUser);
      prisma.user.update.mockResolvedValue({ ...upsertedUser, currentTier: 2 });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ method: 'oauth', provider: 'google', token: 'valid-google-token' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    test('400 — missing provider', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ method: 'oauth', token: 'some-token' });

      expect(res.status).toBe(400);
    });
  });

  test('400 — invalid method', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ method: 'email', email: 'x@x.com', password: 'pass' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  test('200 — sends OTP to existing user', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(makeUser({ phoneVerified: true }));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ method: 'otp', phoneNumber: PHONE });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.devCode).toMatch(/^\d{6}$/);
  });

  test('404 — phone number not registered', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null); // no existing user

    const res = await request(app)
      .post('/api/auth/login')
      .send({ method: 'otp', phoneNumber: PHONE });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/please register/i);
  });

  test('200 — OAuth login for existing user', async () => {
    process.env.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sub: 'google-uid-existing', aud: TEST_GOOGLE_CLIENT_ID }),
    });

    const existingUser = makeUser({ id: 'uid-existing', oauthVerifiedAt: new Date() });
    prisma.user.findUnique.mockResolvedValueOnce(existingUser); // found by oauthSubHmac
    prisma.user.upsert.mockResolvedValue(existingUser);
    prisma.user.findUniqueOrThrow.mockResolvedValue(existingUser);
    prisma.user.update.mockResolvedValue({ ...existingUser, currentTier: 2 });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ method: 'oauth', provider: 'google', token: 'valid-token' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('404 — OAuth login returns 404 for unregistered account (_isLoginOnly)', async () => {
    process.env.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sub: 'google-uid-unknown', aud: TEST_GOOGLE_CLIENT_ID }),
    });

    prisma.user.findUnique.mockResolvedValueOnce(null); // no account

    const res = await request(app)
      .post('/api/auth/login')
      .send({ method: 'oauth', provider: 'google', token: 'valid-token' });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/sign up first/i);
  });
});

describe('POST /api/auth/logout', () => {
  test('200 — always succeeds (stateless)', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
