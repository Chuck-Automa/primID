const { rateLimitAttestations } = require('../../src/shared/middleware/rateLimitAttestations');
const prisma = require('../../src/shared/db/prisma');

function mockReq(userId = 'user-id-123') {
  return { userId };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('rateLimitAttestations', () => {
  const next = jest.fn();

  test('calls next() when both windows are under limit', async () => {
    prisma.attestation.count
      .mockResolvedValueOnce(5)   // 13-day count
      .mockResolvedValueOnce(10); // 30-day count
    await rateLimitAttestations(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('returns 429 when 13-day window is at limit (13)', async () => {
    const res = mockRes();
    prisma.attestation.count
      .mockResolvedValueOnce(13)  // 13-day limit hit
      .mockResolvedValueOnce(13); // 30-day still OK
    await rateLimitAttestations(mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 429 when 30-day window is at limit (30)', async () => {
    const res = mockRes();
    prisma.attestation.count
      .mockResolvedValueOnce(12)  // 13-day still OK
      .mockResolvedValueOnce(30); // 30-day limit hit
    await rateLimitAttestations(mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  test('13-day check runs before 30-day check (short-circuits on 13-day hit)', async () => {
    const res = mockRes();
    // Both over limit — 13-day fires first
    prisma.attestation.count
      .mockResolvedValueOnce(13)
      .mockResolvedValueOnce(30);
    await rateLimitAttestations(mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toMatch(/13-day/);
  });

  test('calls next(err) when DB throws', async () => {
    const err = new Error('DB error');
    prisma.attestation.count.mockRejectedValue(err);
    await rateLimitAttestations(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalledWith(err);
  });

  test('passes at exactly 12 attestations in 13-day window', async () => {
    prisma.attestation.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(29);
    await rateLimitAttestations(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
