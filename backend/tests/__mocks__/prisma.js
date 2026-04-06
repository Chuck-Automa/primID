// Manual mock for src/shared/db/prisma.js
// All methods are jest.fn() — individual tests configure return values via
// mockResolvedValue / mockResolvedValueOnce.

const prisma = {
  // $transaction: resolve all operations passed as an array.
  $transaction: jest.fn().mockResolvedValue([]),

  user: {
    upsert:             jest.fn(),
    findUnique:         jest.fn(),
    findUniqueOrThrow:  jest.fn(),
    update:             jest.fn(),
    create:             jest.fn(),
  },
  attestation: {
    create:     jest.fn(),
    findUnique: jest.fn(),
    findMany:   jest.fn(),
    update:     jest.fn(),
    count:      jest.fn(),
  },
  socialAccount: {
    create:     jest.fn(),
    findUnique: jest.fn(),
    findFirst:  jest.fn(),
    findMany:   jest.fn(),
    update:     jest.fn(),
    updateMany: jest.fn(),
    delete:     jest.fn(),
  },
  socialHandleConflict: {
    create: jest.fn(),
  },
  inviteCode: {
    findUnique: jest.fn(),
    update:     jest.fn(),
  },
};

module.exports = prisma;
