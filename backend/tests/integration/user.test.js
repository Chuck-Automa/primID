const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/shared/db/prisma');
const { generateAccessToken } = require('../../src/shared/utils/jwt.util');

const USER_ID = 'user-uuid-me-test';

function authHeader(userId = USER_ID, tier = 2) {
  return { Authorization: `Bearer ${generateAccessToken(userId, tier)}` };
}

function makeUser(overrides = {}) {
  return {
    id: USER_ID,
    phoneVerified: true,
    phoneVerifiedAt: new Date('2024-01-01'),
    oauthProvider: 'google',
    oauthVerifiedAt: new Date('2024-02-01'),
    biometricLastUsedAt: null,
    zkPassportVerified: false,
    zkPassportVerifiedAt: null,
    zkEmailVerified: false,
    zkEmailVerifiedAt: null,
    pohVerified: false,
    pohVerifiedAt: null,
    ecoinmterVerified: false,
    ecoinmterVerifiedAt: null,
    currentTier: 2,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-02-01'),
    ...overrides,
  };
}

// Mocks authenticate's tombstone check (findUnique for gdprErasedAt).
function mockAuthTombstone() {
  prisma.user.findUnique.mockResolvedValueOnce({ gdprErasedAt: null });
}

describe('GET /api/user/me', () => {
  test('200 — returns profile for authenticated user', async () => {
    mockAuthTombstone();
    prisma.user.findUniqueOrThrow.mockResolvedValue(makeUser());

    const res = await request(app)
      .get('/api/user/me')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.id).toBe(USER_ID);
    expect(res.body.user.currentTier).toBe(2);
  });

  test('never exposes phoneNumber in response', async () => {
    mockAuthTombstone();
    prisma.user.findUniqueOrThrow.mockResolvedValue(makeUser({ phoneNumber: '+15555551234' }));

    const res = await request(app)
      .get('/api/user/me')
      .set(authHeader());

    expect(res.body.user).not.toHaveProperty('phoneNumber');
    expect(res.body.user).not.toHaveProperty('phone_number');
  });

  test('never exposes oauthSub in response', async () => {
    mockAuthTombstone();
    prisma.user.findUniqueOrThrow.mockResolvedValue(makeUser({ oauthSub: 'google|abc123' }));

    const res = await request(app)
      .get('/api/user/me')
      .set(authHeader());

    expect(res.body.user).not.toHaveProperty('oauthSub');
    expect(res.body.user).not.toHaveProperty('oauth_sub');
  });

  test('never exposes HMAC columns in response', async () => {
    mockAuthTombstone();
    prisma.user.findUniqueOrThrow.mockResolvedValue(makeUser());

    const res = await request(app)
      .get('/api/user/me')
      .set(authHeader());

    expect(res.body.user).not.toHaveProperty('phoneNumberHmac');
    expect(res.body.user).not.toHaveProperty('oauthSubHmac');
  });

  test('exposes biometricEverUsed as boolean, not timestamp', async () => {
    mockAuthTombstone();
    prisma.user.findUniqueOrThrow.mockResolvedValue(
      makeUser({ biometricLastUsedAt: new Date('2024-03-01') })
    );

    const res = await request(app)
      .get('/api/user/me')
      .set(authHeader());

    expect(res.body.user.biometricEverUsed).toBe(true);
    expect(res.body.user).not.toHaveProperty('biometricLastUsedAt');
  });

  test('biometricEverUsed is false when biometricLastUsedAt is null', async () => {
    mockAuthTombstone();
    prisma.user.findUniqueOrThrow.mockResolvedValue(makeUser({ biometricLastUsedAt: null }));

    const res = await request(app)
      .get('/api/user/me')
      .set(authHeader());

    expect(res.body.user.biometricEverUsed).toBe(false);
  });

  test('401 — no authorization header', async () => {
    const res = await request(app).get('/api/user/me');
    expect(res.status).toBe(401);
  });

  test('401 — invalid token', async () => {
    const res = await request(app)
      .get('/api/user/me')
      .set({ Authorization: 'Bearer bad.token.here' });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/user/me', () => {
  test('200 — returns user for empty body (no-op in Sprint 1)', async () => {
    mockAuthTombstone();
    prisma.user.findUniqueOrThrow.mockResolvedValue(makeUser());

    const res = await request(app)
      .patch('/api/user/me')
      .set(authHeader())
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('400 — rejects attempt to update currentTier', async () => {
    mockAuthTombstone();
    const res = await request(app)
      .patch('/api/user/me')
      .set(authHeader())
      .send({ currentTier: 0 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/currentTier/);
  });

  test('400 — rejects attempt to update phoneVerified', async () => {
    mockAuthTombstone();
    const res = await request(app)
      .patch('/api/user/me')
      .set(authHeader())
      .send({ phoneVerified: true });

    expect(res.status).toBe(400);
  });

  test('400 — rejects attempt to update oauthProvider', async () => {
    mockAuthTombstone();
    const res = await request(app)
      .patch('/api/user/me')
      .set(authHeader())
      .send({ oauthProvider: 'google' });

    expect(res.status).toBe(400);
  });

  test('400 — rejects walletAddress update', async () => {
    mockAuthTombstone();
    const res = await request(app)
      .patch('/api/user/me')
      .set(authHeader())
      .send({ walletAddress: '0xabc' });

    expect(res.status).toBe(400);
  });

  test('401 — requires authentication', async () => {
    const res = await request(app)
      .patch('/api/user/me')
      .send({});
    expect(res.status).toBe(401);
  });
});
