const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/shared/db/prisma');
const { generateAccessToken } = require('../../src/shared/utils/jwt.util');

// Must be valid RFC 4122 UUIDs — express-validator's isUUID() rejects non-UUIDs.
const ISSUER_ID  = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const SUBJECT_ID = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
const THIRD_ID   = 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
const ATTEST_ID  = 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';

function authHeader(userId = ISSUER_ID, tier = 2) {
  return { Authorization: `Bearer ${generateAccessToken(userId, tier)}` };
}

function makeAttestation(overrides = {}) {
  return {
    id: ATTEST_ID,
    issuerId: ISSUER_ID,
    subjectId: SUBJECT_ID,
    attestationType: 'vouches_for',
    consentGivenAt: null,
    publicAt: null,
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// resetAllMocks clears mockResolvedValueOnce queues (clearMocks:true only clears call history).
beforeEach(() => jest.resetAllMocks());

// Mocks authenticate's tombstone check (findUnique for gdprErasedAt).
function mockAuthTombstone() {
  prisma.user.findUnique.mockResolvedValueOnce({ gdprErasedAt: null });
}

// requireTier reads from DB; mock it to return the specified tier.
// Prepends the tombstone mock so authenticate's findUnique is satisfied first.
function mockTierCheck(tier) {
  mockAuthTombstone();
  prisma.user.findUnique.mockResolvedValueOnce({ currentTier: tier });
}

describe('POST /api/attestations', () => {
  test('201 — creates attestation via subjectUserId (direct UUID path)', async () => {
    mockTierCheck(2);
    prisma.attestation.count.mockResolvedValue(0);
    prisma.user.findUnique.mockResolvedValueOnce({ id: SUBJECT_ID }); // subject existence
    prisma.attestation.create.mockResolvedValue(makeAttestation());

    const res = await request(app)
      .post('/api/attestations')
      .set(authHeader(ISSUER_ID, 2))
      .send({ subjectUserId: SUBJECT_ID, attestationType: 'vouches_for' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.attestation.issuerId).toBe(ISSUER_ID);
    expect(res.body.attestation.consentGivenAt).toBeNull();
    expect(res.body.attestation.revokedAt).toBeNull();
  });

  test('201 — creates attestation via platform + handle lookup', async () => {
    mockTierCheck(2);
    prisma.attestation.count.mockResolvedValue(0);
    prisma.socialAccount.findFirst.mockResolvedValueOnce({
      userId: SUBJECT_ID,
      platform: 'github',
      handle: 'chuck-automa',
      conflictFlagged: false,
    });
    prisma.attestation.create.mockResolvedValue(makeAttestation());

    const res = await request(app)
      .post('/api/attestations')
      .set(authHeader(ISSUER_ID, 2))
      .send({ platform: 'github', handle: 'chuck-automa', attestationType: 'vouches_for' });

    expect(res.status).toBe(201);
    expect(res.body.attestation.subjectId).toBe(SUBJECT_ID);
  });

  test('404 — platform+handle not found in social accounts', async () => {
    mockTierCheck(2);
    prisma.attestation.count.mockResolvedValue(0);
    prisma.socialAccount.findFirst.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/attestations')
      .set(authHeader(ISSUER_ID, 2))
      .send({ platform: 'github', handle: 'nobody', attestationType: 'vouches_for' });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/no primid user found/i);
  });

  test('409 — conflict_flagged handle cannot be used for attestation', async () => {
    mockTierCheck(2);
    prisma.attestation.count.mockResolvedValue(0);
    prisma.socialAccount.findFirst.mockResolvedValueOnce({
      userId: SUBJECT_ID,
      platform: 'github',
      handle: 'disputed',
      conflictFlagged: true,
    });

    const res = await request(app)
      .post('/api/attestations')
      .set(authHeader(ISSUER_ID, 2))
      .send({ platform: 'github', handle: 'disputed', attestationType: 'vouches_for' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/conflict/i);
  });

  test('400 — neither subjectUserId nor platform+handle provided', async () => {
    mockTierCheck(2);
    prisma.attestation.count.mockResolvedValue(0);

    const res = await request(app)
      .post('/api/attestations')
      .set(authHeader(ISSUER_ID, 2))
      .send({ attestationType: 'vouches_for' });

    expect(res.status).toBe(400);
  });

  test('403 — Tier 3 (phone only) cannot issue attestations', async () => {
    mockTierCheck(3);

    const res = await request(app)
      .post('/api/attestations')
      .set(authHeader(ISSUER_ID, 3))
      .send({ subjectUserId: SUBJECT_ID, attestationType: 'vouches_for' });

    expect(res.status).toBe(403);
  });

  test('403 — Ghost user (null tier) cannot issue attestations', async () => {
    mockAuthTombstone();
    prisma.user.findUnique.mockResolvedValueOnce({ currentTier: null });

    const res = await request(app)
      .post('/api/attestations')
      .set(authHeader(ISSUER_ID, null))
      .send({ subjectUserId: SUBJECT_ID, attestationType: 'vouches_for' });

    expect(res.status).toBe(403);
  });

  test('400 — cannot attest to yourself', async () => {
    mockTierCheck(2);
    prisma.attestation.count.mockResolvedValue(0);

    const res = await request(app)
      .post('/api/attestations')
      .set(authHeader(ISSUER_ID, 2))
      .send({ subjectUserId: ISSUER_ID, attestationType: 'vouches_for' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/yourself/i);
  });

  test('404 — subject user does not exist', async () => {
    mockTierCheck(2);
    prisma.attestation.count.mockResolvedValue(0);
    prisma.user.findUnique.mockResolvedValueOnce(null); // subject not found

    const res = await request(app)
      .post('/api/attestations')
      .set(authHeader(ISSUER_ID, 2))
      .send({ subjectUserId: 'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', attestationType: 'vouches_for' });

    expect(res.status).toBe(404);
  });

  test('400 — missing attestationType', async () => {
    mockTierCheck(2);
    prisma.attestation.count.mockResolvedValue(0);

    const res = await request(app)
      .post('/api/attestations')
      .set(authHeader(ISSUER_ID, 2))
      .send({ subjectUserId: SUBJECT_ID });

    expect(res.status).toBe(400);
  });

  test('400 — subjectUserId must be a valid UUID', async () => {
    mockTierCheck(2);
    prisma.attestation.count.mockResolvedValue(0);

    const res = await request(app)
      .post('/api/attestations')
      .set(authHeader(ISSUER_ID, 2))
      .send({ subjectUserId: 'not-a-uuid', attestationType: 'vouches_for' });

    expect(res.status).toBe(400);
  });

  test('401 — no auth token', async () => {
    const res = await request(app)
      .post('/api/attestations')
      .send({ subjectUserId: SUBJECT_ID, attestationType: 'vouches_for' });

    expect(res.status).toBe(401);
  });

  test('429 — 13-day rate limit exceeded', async () => {
    mockTierCheck(2);
    prisma.attestation.count
      .mockResolvedValueOnce(13) // 13-day limit hit
      .mockResolvedValueOnce(13);

    const res = await request(app)
      .post('/api/attestations')
      .set(authHeader(ISSUER_ID, 2))
      .send({ subjectUserId: SUBJECT_ID, attestationType: 'vouches_for' });

    expect(res.status).toBe(429);
  });

  test('429 — 30-day rate limit exceeded', async () => {
    mockTierCheck(2);
    prisma.attestation.count
      .mockResolvedValueOnce(12) // 13-day OK
      .mockResolvedValueOnce(30); // 30-day limit hit

    const res = await request(app)
      .post('/api/attestations')
      .set(authHeader(ISSUER_ID, 2))
      .send({ subjectUserId: SUBJECT_ID, attestationType: 'vouches_for' });

    expect(res.status).toBe(429);
  });
});

describe('GET /api/attestations', () => {
  test('200 — returns attestations for authenticated user', async () => {
    mockAuthTombstone();
    prisma.attestation.findMany.mockResolvedValue([makeAttestation()]);

    const res = await request(app)
      .get('/api/attestations')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.attestations)).toBe(true);
    expect(res.body.attestations).toHaveLength(1);
  });

  test('401 — no auth token', async () => {
    const res = await request(app).get('/api/attestations');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/attestations/:id', () => {
  test('200 — issuer can view the attestation', async () => {
    mockAuthTombstone();
    prisma.attestation.findUnique.mockResolvedValue(makeAttestation());

    const res = await request(app)
      .get(`/api/attestations/${ATTEST_ID}`)
      .set(authHeader(ISSUER_ID));

    expect(res.status).toBe(200);
    expect(res.body.attestation.id).toBe(ATTEST_ID);
  });

  test('200 — subject can view the attestation', async () => {
    mockAuthTombstone();
    prisma.attestation.findUnique.mockResolvedValue(makeAttestation());

    const res = await request(app)
      .get(`/api/attestations/${ATTEST_ID}`)
      .set(authHeader(SUBJECT_ID));

    expect(res.status).toBe(200);
  });

  test('403 — unrelated user cannot view', async () => {
    mockAuthTombstone();
    prisma.attestation.findUnique.mockResolvedValue(makeAttestation());

    const res = await request(app)
      .get(`/api/attestations/${ATTEST_ID}`)
      .set(authHeader(THIRD_ID));

    expect(res.status).toBe(403);
  });

  test('404 — attestation does not exist', async () => {
    mockAuthTombstone();
    prisma.attestation.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/attestations/${ATTEST_ID}`)
      .set(authHeader(ISSUER_ID));

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/attestations/:id/consent', () => {
  test('200 — subject grants consent; sets consentGivenAt and publicAt', async () => {
    mockAuthTombstone();
    const now = new Date();
    prisma.attestation.findUnique.mockResolvedValue(makeAttestation()); // no consent yet
    prisma.attestation.update.mockResolvedValue(
      makeAttestation({ consentGivenAt: now, publicAt: now })
    );

    const res = await request(app)
      .patch(`/api/attestations/${ATTEST_ID}/consent`)
      .set(authHeader(SUBJECT_ID));

    expect(res.status).toBe(200);
    expect(res.body.attestation.consentGivenAt).not.toBeNull();
    expect(res.body.attestation.publicAt).not.toBeNull();
  });

  test('403 — issuer cannot grant consent (only subject can)', async () => {
    mockAuthTombstone();
    prisma.attestation.findUnique.mockResolvedValue(makeAttestation());

    const res = await request(app)
      .patch(`/api/attestations/${ATTEST_ID}/consent`)
      .set(authHeader(ISSUER_ID));

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/subject/i);
  });

  test('400 — consent already given', async () => {
    mockAuthTombstone();
    prisma.attestation.findUnique.mockResolvedValue(
      makeAttestation({ consentGivenAt: new Date() })
    );

    const res = await request(app)
      .patch(`/api/attestations/${ATTEST_ID}/consent`)
      .set(authHeader(SUBJECT_ID));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already/i);
  });

  test('404 — attestation not found', async () => {
    mockAuthTombstone();
    prisma.attestation.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .patch(`/api/attestations/${ATTEST_ID}/consent`)
      .set(authHeader(SUBJECT_ID));

    expect(res.status).toBe(404);
  });
});

describe('POST /api/attestations/:id/revoke', () => {
  test('200 — issuer can revoke (sets revokedAt)', async () => {
    mockAuthTombstone();
    const now = new Date();
    prisma.attestation.findUnique.mockResolvedValue(makeAttestation());
    prisma.attestation.update.mockResolvedValue(makeAttestation({ revokedAt: now }));

    const res = await request(app)
      .post(`/api/attestations/${ATTEST_ID}/revoke`)
      .set(authHeader(ISSUER_ID));

    expect(res.status).toBe(200);
    expect(res.body.attestation.revokedAt).not.toBeNull();
  });

  test('200 — subject can also revoke', async () => {
    mockAuthTombstone();
    const now = new Date();
    prisma.attestation.findUnique.mockResolvedValue(makeAttestation());
    prisma.attestation.update.mockResolvedValue(makeAttestation({ revokedAt: now }));

    const res = await request(app)
      .post(`/api/attestations/${ATTEST_ID}/revoke`)
      .set(authHeader(SUBJECT_ID));

    expect(res.status).toBe(200);
  });

  test('403 — unrelated user cannot revoke', async () => {
    mockAuthTombstone();
    prisma.attestation.findUnique.mockResolvedValue(makeAttestation());

    const res = await request(app)
      .post(`/api/attestations/${ATTEST_ID}/revoke`)
      .set(authHeader(THIRD_ID));

    expect(res.status).toBe(403);
  });

  test('400 — already revoked attestation returns error', async () => {
    mockAuthTombstone();
    prisma.attestation.findUnique.mockResolvedValue(
      makeAttestation({ revokedAt: new Date() })
    );

    const res = await request(app)
      .post(`/api/attestations/${ATTEST_ID}/revoke`)
      .set(authHeader(ISSUER_ID));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already revoked/i);
  });

  test('404 — attestation not found', async () => {
    mockAuthTombstone();
    prisma.attestation.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/attestations/${ATTEST_ID}/revoke`)
      .set(authHeader(ISSUER_ID));

    expect(res.status).toBe(404);
  });

  test('attestation records are never hard-deleted — revokedAt is set instead', async () => {
    mockAuthTombstone();
    prisma.attestation.findUnique.mockResolvedValue(makeAttestation());
    const updateSpy = prisma.attestation.update.mockResolvedValue(
      makeAttestation({ revokedAt: new Date() })
    );

    await request(app)
      .post(`/api/attestations/${ATTEST_ID}/revoke`)
      .set(authHeader(ISSUER_ID));

    // Must call update (soft-revoke), never delete
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ revokedAt: expect.any(Date) }) })
    );
    // Prisma delete must NOT have been called
    expect(prisma.attestation.delete).toBeUndefined();
  });
});
