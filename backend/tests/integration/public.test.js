const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/shared/db/prisma');

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function makeUser(overrides = {}) {
  return {
    id: USER_ID,
    displayName: 'Chuck',
    currentTier: 2,
    phoneVerifiedAt: null,
    oauthVerifiedAt: null,
    zkPassportVerified: false,
    zkPassportVerifiedAt: null,
    zkEmailVerified: false,
    zkEmailVerifiedAt: null,
    pohVerified: false,
    pohVerifiedAt: null,
    ecointerVerified: false,
    ecointerVerifiedAt: null,
    ...overrides,
  };
}

describe('GET /api/public/lookup/:platform/:handle', () => {
  // handle_hmac is written from the CANONICALIZED handle (addSocialAccount),
  // so the stored row here always reflects the canonical form — lowercase,
  // no leading '@' for telegram.
  const storedAccount = {
    id: 'acc-1',
    userId: USER_ID,
    platform: 'telegram',
    conflictFlagged: false,
    handleHmac: 'hmac::automa_cap',
  };

  test('200 — resolves when the URL handle exactly matches the canonical form', async () => {
    prisma.socialAccount.findFirst.mockResolvedValueOnce(storedAccount);
    prisma.user.findUnique.mockResolvedValueOnce(makeUser());
    prisma.socialHandleConflict.findMany.mockResolvedValueOnce([]);

    const res = await request(app).get('/api/public/lookup/telegram/automa_cap');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.socialAccount.findFirst).toHaveBeenCalledWith({
      where: { platform: 'telegram', handleHmac: 'hmac::automa_cap', removedAt: null },
    });
  });

  // Regression test: the Share button sends handleSearch as-typed/displayed
  // ("@Automa_cap" — leading '@', mixed case), which previously 404'd because
  // lookupHandle hashed the raw param instead of canonicalizing it first.
  test('200 — resolves when the URL handle is the as-typed display form (leading @, mixed case)', async () => {
    prisma.socialAccount.findFirst.mockResolvedValueOnce(storedAccount);
    prisma.user.findUnique.mockResolvedValueOnce(makeUser());
    prisma.socialHandleConflict.findMany.mockResolvedValueOnce([]);

    const res = await request(app).get('/api/public/lookup/telegram/%40Automa_cap');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.socialAccount.findFirst).toHaveBeenCalledWith({
      where: { platform: 'telegram', handleHmac: 'hmac::automa_cap', removedAt: null },
    });
  });

  test('404 — no matching account', async () => {
    prisma.socialAccount.findFirst.mockResolvedValueOnce(null);

    const res = await request(app).get('/api/public/lookup/telegram/nobody_here');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('404 — handle fails canonicalization for the platform (never queries the DB)', async () => {
    const res = await request(app).get('/api/public/lookup/telegram/a'); // too short for TELEGRAM_HANDLE_PATTERN

    expect(res.status).toBe(404);
    expect(prisma.socialAccount.findFirst).not.toHaveBeenCalled();
  });

  test('400 — unknown platform', async () => {
    const res = await request(app).get('/api/public/lookup/myspace/chuck');

    expect(res.status).toBe(400);
    expect(prisma.socialAccount.findFirst).not.toHaveBeenCalled();
  });

  test('409 — conflict_flagged account still resolves with conflict data', async () => {
    prisma.socialAccount.findFirst.mockResolvedValueOnce({ ...storedAccount, conflictFlagged: true });
    prisma.user.findUnique.mockResolvedValueOnce(makeUser());
    prisma.socialHandleConflict.findMany.mockResolvedValueOnce([
      { detectedAt: new Date(), resolvedAt: null },
    ]);

    const res = await request(app).get('/api/public/lookup/telegram/automa_cap');

    expect(res.status).toBe(409);
    expect(res.body.conflictFlagged).toBe(true);
  });
});

describe('GET /api/public/attestations/:platform/:handle', () => {
  test('200 — resolves via canonicalized handle and returns public attestations', async () => {
    prisma.socialAccount.findFirst.mockResolvedValueOnce({
      id: 'acc-1',
      userId: USER_ID,
      handleHmac: 'hmac::chuck-dev',
    });
    prisma.attestation.findMany.mockResolvedValueOnce([]);

    const res = await request(app).get('/api/public/attestations/github/Chuck-Dev');

    expect(res.status).toBe(200);
    expect(prisma.socialAccount.findFirst).toHaveBeenCalledWith({
      where: { platform: 'github', handleHmac: 'hmac::chuck-dev', removedAt: null },
    });
  });

  test('404 — handle not found', async () => {
    prisma.socialAccount.findFirst.mockResolvedValueOnce(null);

    const res = await request(app).get('/api/public/attestations/github/nobody');

    expect(res.status).toBe(404);
  });
});
