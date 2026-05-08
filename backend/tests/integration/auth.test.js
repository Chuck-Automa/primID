const request = require('supertest');
const crypto = require('crypto');
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

function makeRefreshTokenRow(rawToken, overrides = {}) {
  return {
    id: 'rt-test-1',
    userId: 'uid-auth-test',
    tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    rotatedAt: null,
    revokedAt: null,
    replacedBy: null,
    user: { id: 'uid-auth-test', currentTier: 2 },
    ...overrides,
  };
}

afterEach(() => {
  delete process.env.NODE_ENV;
  delete process.env.STAGING_PHONE_WHITELIST;
  delete process.env.GOOGLE_CLIENT_ID;
  global.fetch = _originalFetch;
});

describe('POST /api/auth/register', () => {
  describe('method=phone', () => {
    test('400 — redirects to /api/verify/phone/initiate', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ method: 'phone', phoneNumber: PHONE });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/verify\/phone\/initiate/i);
    });
  });

  describe('method=oauth', () => {
    test('200 — Google OAuth registers new user, returns accessToken and refresh cookie', async () => {
      process.env.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ sub: 'google-uid-abc', aud: TEST_GOOGLE_CLIENT_ID }),
      });

      prisma.user.findUnique.mockResolvedValueOnce(null);
      const upsertedUser = makeUser({ id: 'uid-oauth-new', oauthVerifiedAt: new Date() });
      prisma.user.upsert.mockResolvedValue(upsertedUser);
      prisma.user.findUniqueOrThrow.mockResolvedValue(upsertedUser);
      prisma.user.update.mockResolvedValue({ ...upsertedUser, currentTier: 2 });
      prisma.refreshToken.create.mockResolvedValueOnce({ id: 'rt-1' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ method: 'oauth', provider: 'google', token: 'valid-google-token' });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.startsWith('primid_rt='))).toBe(true);
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
      .send({ method: 'email', email: 'x@x.com' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  test('400 — method=phone redirects to /api/verify/phone/initiate', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ method: 'phone', phoneNumber: PHONE });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/verify\/phone\/initiate/i);
  });

  test('200 — OAuth login for existing user returns accessToken and cookie', async () => {
    process.env.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sub: 'google-uid-existing', aud: TEST_GOOGLE_CLIENT_ID }),
    });

    const existingUser = makeUser({ id: 'uid-existing', oauthVerifiedAt: new Date() });
    prisma.user.findUnique.mockResolvedValueOnce(existingUser);
    prisma.user.upsert.mockResolvedValue(existingUser);
    prisma.user.findUniqueOrThrow.mockResolvedValue(existingUser);
    prisma.user.update.mockResolvedValue({ ...existingUser, currentTier: 2 });
    prisma.refreshToken.create.mockResolvedValueOnce({ id: 'rt-1' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ method: 'oauth', provider: 'google', token: 'valid-token' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  test('404 — OAuth login returns 404 for unregistered account', async () => {
    process.env.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sub: 'google-uid-unknown', aud: TEST_GOOGLE_CLIENT_ID }),
    });

    prisma.user.findUnique.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ method: 'oauth', provider: 'google', token: 'valid-token' });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/sign up first/i);
  });
});

describe('POST /api/auth/logout', () => {
  test('204 — Tier 3 logout (no cookie) succeeds silently', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(204);
  });

  test('204 — Tier 2+ logout revokes refresh token and clears cookie', async () => {
    const rawToken = 'a'.repeat(80);
    prisma.refreshToken.findUnique.mockResolvedValueOnce(
      makeRefreshTokenRow(rawToken)
    );
    prisma.refreshToken.update.mockResolvedValueOnce({});

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `primid_rt=${rawToken}`);

    expect(res.status).toBe(204);
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ revokedAt: expect.any(Date) }) })
    );
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some(c => c.includes('primid_rt=;'))).toBe(true);
  });

  test('204 — logout with already-revoked token still returns 204', async () => {
    const rawToken = 'b'.repeat(80);
    prisma.refreshToken.findUnique.mockResolvedValueOnce(
      makeRefreshTokenRow(rawToken, { revokedAt: new Date() })
    );

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `primid_rt=${rawToken}`);

    expect(res.status).toBe(204);
    expect(prisma.refreshToken.update).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/refresh', () => {
  test('200 — valid refresh token returns new accessToken and rotates cookie', async () => {
    const rawToken = 'c'.repeat(80);
    prisma.refreshToken.findUnique.mockResolvedValueOnce(
      makeRefreshTokenRow(rawToken)
    );
    prisma.refreshToken.create.mockResolvedValueOnce({ id: 'rt-new' });
    prisma.refreshToken.update.mockResolvedValueOnce({});

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `primid_rt=${rawToken}`);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some(c => c.startsWith('primid_rt='))).toBe(true);
  });

  test('401 — no cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  test('401 — token not found in DB', async () => {
    prisma.refreshToken.findUnique.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `primid_rt=${'d'.repeat(80)}`);

    expect(res.status).toBe(401);
  });

  test('401 REPLAY_DETECTED — already-rotated token triggers full chain revocation', async () => {
    const rawToken = 'e'.repeat(80);
    prisma.refreshToken.findUnique.mockResolvedValueOnce(
      makeRefreshTokenRow(rawToken, { rotatedAt: new Date(Date.now() - 1000) })
    );
    prisma.refreshToken.updateMany.mockResolvedValueOnce({});

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `primid_rt=${rawToken}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('REPLAY_DETECTED');
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ revokedAt: expect.any(Date) }) })
    );
  });

  test('401 — revoked token', async () => {
    const rawToken = 'f'.repeat(80);
    prisma.refreshToken.findUnique.mockResolvedValueOnce(
      makeRefreshTokenRow(rawToken, { revokedAt: new Date(Date.now() - 1000) })
    );

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `primid_rt=${rawToken}`);

    expect(res.status).toBe(401);
  });

  test('401 — expired token', async () => {
    const rawToken = 'g'.repeat(80);
    prisma.refreshToken.findUnique.mockResolvedValueOnce(
      makeRefreshTokenRow(rawToken, { expiresAt: new Date(Date.now() - 1000) })
    );

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `primid_rt=${rawToken}`);

    expect(res.status).toBe(401);
  });
});
