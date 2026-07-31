const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/shared/db/prisma');
const { generateAccessToken } = require('../../src/shared/utils/jwt.util');

const USER_ID = 'social-user-uuid-111';
const OTHER_USER_ID = 'social-other-uuid-222';
const ACCOUNT_ID = 'social-acct-uuid-333';

function authHeader(userId = USER_ID, tier = 3) {
  return { Authorization: `Bearer ${generateAccessToken(userId, tier)}` };
}

function makeAccount(overrides = {}) {
  return {
    id: ACCOUNT_ID,
    userId: USER_ID,
    platform: 'github',
    handle: 'chuck-dev',
    isPublic: true,
    conflictFlagged: false,
    attestedAt: null,
    createdAt: new Date(),
    removedAt: null,
    ...overrides,
  };
}

// Mocks authenticate's tombstone check (findUnique for gdprErasedAt).
function mockAuthTombstone() {
  prisma.user.findUnique.mockResolvedValueOnce({ gdprErasedAt: null });
}

describe('GET /api/social-accounts', () => {
  test('200 — returns active accounts for authenticated user', async () => {
    mockAuthTombstone();
    prisma.socialAccount.findMany.mockResolvedValue([makeAccount()]);

    const res = await request(app)
      .get('/api/social-accounts')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.accounts).toHaveLength(1);
    expect(res.body.accounts[0].platform).toBe('github');
  });

  test('200 — returns empty array when user has no accounts', async () => {
    mockAuthTombstone();
    prisma.socialAccount.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/social-accounts')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.accounts).toHaveLength(0);
  });

  test('401 — requires authentication', async () => {
    const res = await request(app).get('/api/social-accounts');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/social-accounts', () => {
  test('201 — adds a valid GitHub account (no conflicts)', async () => {
    mockAuthTombstone();
    prisma.socialAccount.create.mockResolvedValue(makeAccount());
    prisma.socialAccount.findMany.mockResolvedValue([]); // no conflicts

    const res = await request(app)
      .post('/api/social-accounts')
      .set(authHeader())
      .send({ platform: 'github', handle: 'chuck-dev', isPublic: true });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.account.platform).toBe('github');
  });

  test('201 — platform is lowercased before storage', async () => {
    mockAuthTombstone();
    prisma.socialAccount.create.mockResolvedValue(makeAccount({ platform: 'farcaster' }));
    prisma.socialAccount.findMany.mockResolvedValue([]);

    await request(app)
      .post('/api/social-accounts')
      .set(authHeader())
      .send({ platform: 'Farcaster', handle: 'chuck.eth', isPublic: true });

    expect(prisma.socialAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ platform: 'farcaster' }),
      })
    );
  });

  test('201 — adds account and flags conflict when duplicate handle found', async () => {
    mockAuthTombstone();
    const newAccount = makeAccount({ id: 'new-acct-id' });
    const conflictAccount = makeAccount({ id: 'conflict-acct-id', userId: OTHER_USER_ID });

    prisma.socialAccount.create.mockResolvedValue(newAccount);
    prisma.socialAccount.findMany.mockResolvedValue([conflictAccount]); // conflict found
    prisma.$transaction.mockResolvedValue([]);
    const flaggedAccount = { ...newAccount, conflictFlagged: true };
    prisma.socialAccount.findUnique.mockResolvedValue(flaggedAccount);

    const res = await request(app)
      .post('/api/social-accounts')
      .set(authHeader())
      .send({ platform: 'github', handle: 'chuck-dev', isPublic: true });

    expect(res.status).toBe(201);
    expect(res.body.conflictDetected).toBe(true);
    expect(res.body.account.conflictFlagged).toBe(true);
  });

  test('400 — invalid platform is rejected', async () => {
    mockAuthTombstone();
    const res = await request(app)
      .post('/api/social-accounts')
      .set(authHeader())
      .send({ platform: 'snapchat', handle: 'chuck', isPublic: false });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid platform/i);
  });

  test('400 — missing platform', async () => {
    mockAuthTombstone();
    const res = await request(app)
      .post('/api/social-accounts')
      .set(authHeader())
      .send({ handle: 'chuck-dev' });

    expect(res.status).toBe(400);
  });

  test('400 — missing handle', async () => {
    mockAuthTombstone();
    const res = await request(app)
      .post('/api/social-accounts')
      .set(authHeader())
      .send({ platform: 'github' });

    expect(res.status).toBe(400);
  });

  test('all 11 supported platforms are accepted', async () => {
    // A single generic handle can't satisfy every platform's canonicalization
    // rule (added by the registry hardening pass) — signal needs a numeric
    // discriminator, bluesky needs a DNS-style hostname, nostr needs a valid
    // npub/hex pubkey. Use a realistic valid handle per platform instead.
    const platformHandles = {
      facebook:  'testhandle',
      x:         'testhandle',
      signal:    'testhandle.42',
      telegram:  'testhandle',
      linkedin:  'testhandle',
      instagram: 'testhandle',
      farcaster: 'testhandle',
      nostr:     'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
      bluesky:   'testhandle.bsky.social',
      github:    'testhandle',
      bitchat:   'testhandle',
    };

    for (const [platform, handle] of Object.entries(platformHandles)) {
      mockAuthTombstone();
      prisma.socialAccount.create.mockResolvedValue(makeAccount({ platform }));
      prisma.socialAccount.findMany.mockResolvedValue([]); // no conflicts

      const res = await request(app)
        .post('/api/social-accounts')
        .set(authHeader())
        .send({ platform, handle, isPublic: false });

      expect(res.status).toBe(201);
    }
  });

  test('401 — requires authentication', async () => {
    const res = await request(app)
      .post('/api/social-accounts')
      .send({ platform: 'github', handle: 'chuck' });

    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/social-accounts/:id/remove', () => {
  test('200 — owner can soft-remove their account (sets removedAt)', async () => {
    mockAuthTombstone();
    prisma.socialAccount.findUnique.mockResolvedValue(makeAccount());
    prisma.socialAccount.update.mockResolvedValue(
      makeAccount({ removedAt: new Date() })
    );

    const res = await request(app)
      .patch(`/api/social-accounts/${ACCOUNT_ID}/remove`)
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.account.removedAt).not.toBeNull();
  });

  test('403 — cannot remove another user\'s account', async () => {
    mockAuthTombstone();
    prisma.socialAccount.findUnique.mockResolvedValue(
      makeAccount({ userId: OTHER_USER_ID })
    );

    const res = await request(app)
      .patch(`/api/social-accounts/${ACCOUNT_ID}/remove`)
      .set(authHeader(USER_ID));

    expect(res.status).toBe(403);
  });

  test('404 — account does not exist', async () => {
    mockAuthTombstone();
    prisma.socialAccount.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .patch(`/api/social-accounts/${ACCOUNT_ID}/remove`)
      .set(authHeader());

    expect(res.status).toBe(404);
  });

  test('400 — already removed account returns error', async () => {
    mockAuthTombstone();
    prisma.socialAccount.findUnique.mockResolvedValue(
      makeAccount({ removedAt: new Date() })
    );

    const res = await request(app)
      .patch(`/api/social-accounts/${ACCOUNT_ID}/remove`)
      .set(authHeader());

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already removed/i);
  });

  test('401 — requires authentication', async () => {
    const res = await request(app).patch(`/api/social-accounts/${ACCOUNT_ID}/remove`);
    expect(res.status).toBe(401);
  });

  test('records are soft-removed (removedAt set), never hard-deleted', async () => {
    mockAuthTombstone();
    prisma.socialAccount.findUnique.mockResolvedValue(makeAccount());
    const updateSpy = prisma.socialAccount.update.mockResolvedValue(
      makeAccount({ removedAt: new Date() })
    );

    await request(app)
      .patch(`/api/social-accounts/${ACCOUNT_ID}/remove`)
      .set(authHeader());

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ removedAt: expect.any(Date) }),
      })
    );
    // Hard delete must never be called on social accounts
    expect(prisma.socialAccount.delete).not.toHaveBeenCalled();
  });
});
