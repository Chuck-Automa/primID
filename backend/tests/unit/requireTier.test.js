const { requireTier } = require('../../src/shared/middleware/requireTier');
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

describe('requireTier middleware', () => {
  const next = jest.fn();

  test('calls next() when user tier satisfies minimum (exact match)', async () => {
    prisma.user.findUnique.mockResolvedValue({ currentTier: 2 });
    const mw = requireTier(2);
    await mw(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('calls next() when user has higher trust (lower tier number) than required', async () => {
    prisma.user.findUnique.mockResolvedValue({ currentTier: 0 });
    const mw = requireTier(2);
    await mw(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('returns 403 when user tier is insufficient', async () => {
    const res = mockRes();
    prisma.user.findUnique.mockResolvedValue({ currentTier: 3 });
    const mw = requireTier(2);
    await mw(mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 for Ghost user (null tier)', async () => {
    const res = mockRes();
    prisma.user.findUnique.mockResolvedValue({ currentTier: null });
    const mw = requireTier(3);
    await mw(mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when user record does not exist', async () => {
    const res = mockRes();
    prisma.user.findUnique.mockResolvedValue(null);
    const mw = requireTier(2);
    await mw(mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('always reads tier from DB — does not accept tier from request', async () => {
    // Even if req had a fake tier, the middleware must query the DB
    prisma.user.findUnique.mockResolvedValue({ currentTier: 3 });
    const req = { userId: 'user-123', fakeField: 0 }; // attacker-provided tier
    const res = mockRes();
    const mw = requireTier(2);
    await mw(req, res, next);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      select: { currentTier: true },
    });
    expect(res.status).toHaveBeenCalledWith(403); // tier 3 < minTier 2 fails
  });

  test('calls next(err) when DB throws', async () => {
    const err = new Error('DB error');
    prisma.user.findUnique.mockRejectedValue(err);
    const mw = requireTier(2);
    await mw(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
