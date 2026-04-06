/**
 * Invite code seeder.
 * Generates system invite codes for staging demos and manual distribution.
 *
 * Usage: npm run db:seed
 *
 * By default generates 10 single-use codes with no expiry.
 * Pass --count=N to generate a different number.
 */
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const countArg = process.argv.find((a) => a.startsWith('--count='));
const COUNT = countArg ? parseInt(countArg.split('=')[1], 10) : 10;

function generateCode() {
  // 8 random bytes → 16-char hex string, easy to copy-paste
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

async function main() {
  const codes = [];

  for (let i = 0; i < COUNT; i++) {
    let code;
    // Retry on the rare collision (hex codes are effectively unique at this scale).
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateCode();
      const exists = await prisma.inviteCode.findUnique({ where: { code } });
      if (!exists) break;
    }

    const record = await prisma.inviteCode.create({
      data: {
        code,
        // createdById: null — system-generated
        // expiresAt:   null — no expiry
      },
    });

    codes.push(record.code);
  }

  console.log(`\nGenerated ${codes.length} invite codes:\n`);
  codes.forEach((c) => console.log(` ${c}`));
  console.log('\nDistribute manually. Each code is single-use.\n');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
