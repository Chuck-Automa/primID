const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/shared/db/prisma');

const PHONE = '+15555550102';
const TEST_GOOGLE_CLIENT_ID = 'test-google-client-id';

let _originalFetch;
beforeEach(() => { _originalFetch = global.fetch; });

function makeUser(overrides = {}) {
  return {
    id: 'uid-verify-test',
    phoneNumber: `enc::${PHONE}`,
    phoneNumberHmac: `hmac::${PHONE}`,
    zkPassportVerified: false,
    zkEmailVerified: false,
    pohVerified: false,
    ecointerVerified: false,
    oauthVerifiedAt: null,
    phoneVerified: false,
    currentTier: null,
    ...overrides,
  };
}

afterEach(() => {
  delete process.env.NODE_ENV;
  delete process.env.STAGING_PHONE_WHITELIST;
  delete process.env.GOOGLE_CLIENT_ID;
  global.fetch = _originalFetch;
});

// Mocks authenticate's tombstone check (findUnique for gdprErasedAt).
function mockAuthTombstone() {
  prisma.user.findUnique.mockResolvedValueOnce({ gdprErasedAt: null });
}

// Signs a test access token using the updated claim names (sub, current_tier).
function makeAuthToken(userId = 'uid-verify-test', tier = 3) {
  const jwt = require('../../vendor/jsonwebtoken');
  return jwt.sign(
    { sub: userId, current_tier: tier },
    process.env.JWT_SECRET || 'test-secret-not-for-production',
    { expiresIn: '1h' }
  );
}

describe('POST /api/verify/phone/initiate', () => {
  test('200 — existing user receives challengeId, listenerNumber, and code', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(makeUser());
    prisma.phoneChallenge.create.mockResolvedValueOnce({ id: 'challenge-1' });

    const res = await request(app)
      .post('/api/verify/phone/initiate')
      .send({ phoneNumber: PHONE });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.challengeId).toBe('challenge-1');
    expect(res.body.listenerNumber).toBeDefined();
    expect(res.body.code).toMatch(/^[A-Za-z0-9]{8}$/);
  });

  test('200 — new user is created automatically and challenge issued', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce(makeUser());
    prisma.phoneChallenge.create.mockResolvedValueOnce({ id: 'challenge-2' });

    const res = await request(app)
      .post('/api/verify/phone/initiate')
      .send({ phoneNumber: PHONE });

    expect(res.status).toBe(200);
    expect(res.body.challengeId).toBe('challenge-2');
    expect(res.body.code).toMatch(/^[A-Za-z0-9]{8}$/);
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
  });

  test('403 DEMO_RESTRICTED — non-whitelisted number in staging', async () => {
    process.env.NODE_ENV               = 'staging';
    process.env.STAGING_PHONE_WHITELIST = '+12025550101';

    const res = await request(app)
      .post('/api/verify/phone/initiate')
      .send({ phoneNumber: PHONE });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('DEMO_RESTRICTED');
  });

  test('200 — whitelisted number in staging receives code (auto-resolve queued)', async () => {
    const WHITELISTED = '+12025550101';
    process.env.NODE_ENV                = 'staging';
    process.env.STAGING_PHONE_WHITELIST = WHITELISTED;

    prisma.user.findUnique.mockResolvedValueOnce(makeUser({ phoneNumber: `enc::${WHITELISTED}` }));
    prisma.phoneChallenge.create.mockResolvedValueOnce({ id: 'challenge-staging' });

    const res = await request(app)
      .post('/api/verify/phone/initiate')
      .send({ phoneNumber: WHITELISTED });

    expect(res.status).toBe(200);
    expect(res.body.challengeId).toBe('challenge-staging');
    expect(res.body.code).toMatch(/^[A-Za-z0-9]{8}$/);
  });

  test('400 — missing phoneNumber', async () => {
    const res = await request(app).post('/api/verify/phone/initiate').send({});
    expect(res.status).toBe(400);
  });

  test('400 — phone number without + prefix', async () => {
    const res = await request(app)
      .post('/api/verify/phone/initiate')
      .send({ phoneNumber: '5555550102' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/verify/phone/status/:challengeId', () => {
  test('200 {verified:false} — challenge exists but user has not texted yet', async () => {
    prisma.phoneChallenge.findFirst.mockResolvedValueOnce({
      id: 'ch-pending', userId: 'uid-verify-test', usedAt: null,
    });

    const res = await request(app).get('/api/verify/phone/status/ch-pending');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.verified).toBe(false);
  });

  test('200 {verified:true} — confirmed challenge issues 24h access token, no refresh cookie', async () => {
    const verifiedUser = makeUser({ phoneVerified: true, phoneVerifiedAt: new Date() });

    prisma.phoneChallenge.findFirst.mockResolvedValueOnce({
      id: 'ch-done', userId: verifiedUser.id, usedAt: new Date(),
    });
    prisma.user.findUnique.mockResolvedValueOnce(verifiedUser);
    prisma.user.update.mockResolvedValueOnce({ ...verifiedUser, phoneVerified: true });
    prisma.user.findUniqueOrThrow.mockResolvedValueOnce({ ...verifiedUser, phoneVerified: true });
    prisma.user.update.mockResolvedValueOnce({ ...verifiedUser, currentTier: 3 });

    const res = await request(app).get('/api/verify/phone/status/ch-done');

    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.currentTier).toBe(3);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  test('404 — challenge not found or expired', async () => {
    prisma.phoneChallenge.findFirst.mockResolvedValueOnce(null);

    const res = await request(app).get('/api/verify/phone/status/nonexistent');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/verify/oauth — authenticated upgrade path', () => {
  test('200 — authenticated user links Google, upgrades to Tier 2, receives accessToken and refresh cookie', async () => {
    process.env.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sub: 'google-sub-xyz', aud: TEST_GOOGLE_CLIENT_ID }),
    });

    const user = makeUser({ id: 'uid-verify-test', oauthVerifiedAt: new Date() });
    mockAuthTombstone();
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.update.mockResolvedValueOnce(user);
    prisma.user.findUniqueOrThrow.mockResolvedValueOnce(user);
    prisma.user.update.mockResolvedValueOnce({ ...user, currentTier: 2 });
    prisma.refreshToken.create.mockResolvedValueOnce({ id: 'rt-1' });

    const res = await request(app)
      .post('/api/verify/oauth')
      .set('Authorization', `Bearer ${makeAuthToken()}`)
      .send({ provider: 'google', token: 'valid-google-id-token' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.currentTier).toBe(2);
    // Refresh cookie must be set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some(c => c.startsWith('primid_rt='))).toBe(true);
  });

  test('200 — authenticated user links Apple stub (no APPLE_CLIENT_ID)', async () => {
    const user = makeUser({ id: 'uid-verify-test', oauthVerifiedAt: new Date() });
    mockAuthTombstone();
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.update.mockResolvedValueOnce(user);
    prisma.user.findUniqueOrThrow.mockResolvedValueOnce(user);
    prisma.user.update.mockResolvedValueOnce({ ...user, currentTier: 2 });
    prisma.refreshToken.create.mockResolvedValueOnce({ id: 'rt-1' });

    const res = await request(app)
      .post('/api/verify/oauth')
      .set('Authorization', `Bearer ${makeAuthToken()}`)
      .send({ provider: 'apple', token: 'apple_test_token' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  test('409 — OAuth identity already linked to a different account', async () => {
    process.env.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sub: 'google-sub-conflict', aud: TEST_GOOGLE_CLIENT_ID }),
    });

    mockAuthTombstone();
    prisma.user.findUnique.mockResolvedValueOnce(makeUser({ id: 'uid-other-user' }));

    const res = await request(app)
      .post('/api/verify/oauth')
      .set('Authorization', `Bearer ${makeAuthToken('uid-verify-test')}`)
      .send({ provider: 'google', token: 'valid-google-id-token' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already linked/i);
  });

  test('401 — invalid Google token', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'invalid_token' }),
    });

    mockAuthTombstone();
    const res = await request(app)
      .post('/api/verify/oauth')
      .set('Authorization', `Bearer ${makeAuthToken()}`)
      .send({ provider: 'google', token: 'bad-token' });

    expect(res.status).toBe(401);
  });

  test('503 — Apple returns 503 when APPLE_CLIENT_ID is unset in production', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    mockAuthTombstone();
    const res = await request(app)
      .post('/api/verify/oauth')
      .set('Authorization', `Bearer ${makeAuthToken()}`)
      .send({ provider: 'apple', token: 'any-apple-token' });

    process.env.NODE_ENV = original;
    expect(res.status).toBe(503);
  });

  test('400 — invalid provider', async () => {
    mockAuthTombstone();
    const res = await request(app)
      .post('/api/verify/oauth')
      .set('Authorization', `Bearer ${makeAuthToken()}`)
      .send({ provider: 'twitter', token: 'some-token' });
    expect(res.status).toBe(400);
  });

  test('400 — missing token', async () => {
    mockAuthTombstone();
    const res = await request(app)
      .post('/api/verify/oauth')
      .set('Authorization', `Bearer ${makeAuthToken()}`)
      .send({ provider: 'google' });
    expect(res.status).toBe(400);
  });

  test('401 — unauthenticated request rejected', async () => {
    const res = await request(app)
      .post('/api/verify/oauth')
      .send({ provider: 'google', token: 'some-token' });
    expect(res.status).toBe(401);
  });
});

describe('Sprint 2 stub endpoints', () => {
  test('POST /api/verify/qv/zkpassport → 501', async () => {
    expect((await request(app).post('/api/verify/qv/zkpassport').send({})).status).toBe(501);
  });
  test('POST /api/verify/qv/zkemail → 501', async () => {
    expect((await request(app).post('/api/verify/qv/zkemail').send({})).status).toBe(501);
  });
  test('POST /api/verify/qv/poh → 501', async () => {
    expect((await request(app).post('/api/verify/qv/poh').send({})).status).toBe(501);
  });
  test('POST /api/verify/qv/ecointer → 501', async () => {
    expect((await request(app).post('/api/verify/qv/ecointer').send({})).status).toBe(501);
  });
});
