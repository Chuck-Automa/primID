const prisma = require('../../shared/db/prisma');
const { encrypt, computeHmac } = require('../../shared/utils/crypto.util');

const VALID_PLATFORMS = [
  'facebook', 'x', 'signal', 'telegram', 'linkedin', 'instagram',
  'farcaster', 'nostr', 'bluesky', 'github', 'bitchat',
];

function sanitizeAccount(account) {
  const { handle: _h, handleHmac: _hm, handleSearch, ...rest } = account;
  return { ...rest, handle: handleSearch };
}

// GET /api/social-accounts
const listSocialAccounts = async (req, res, next) => {
  try {
    const accounts = await prisma.socialAccount.findMany({
      where:   { userId: req.userId, removedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ success: true, accounts: accounts.map(sanitizeAccount) });
  } catch (err) {
    next(err);
  }
};

// POST /api/social-accounts
// On duplicate (platform, handle) across users: set conflict_flagged = true on
// all affected rows and insert a social_handle_conflicts record. Never reject.
const addSocialAccount = async (req, res, next) => {
  try {
    const { platform, handle, isPublic } = req.body;

    if (!platform || !handle) {
      return res.status(400).json({ success: false, message: 'platform and handle are required.' });
    }

    const normalizedPlatform = platform.toLowerCase();
    if (!VALID_PLATFORMS.includes(normalizedPlatform)) {
      return res.status(400).json({
        success: false,
        message: `Invalid platform. Supported: ${VALID_PLATFORMS.join(', ')}`,
      });
    }

    // Create the new account with ALE-encrypted handle.
    const hmac       = computeHmac(handle);
    const ciphertext = encrypt(handle);

    const account = await prisma.socialAccount.create({
      data: {
        userId:       req.userId,
        platform:     normalizedPlatform,
        handle:       ciphertext,
        handleHmac:   hmac,
        handleSearch: handle,
        isPublic:     !!isPublic,
      },
    });

    // Find any OTHER active accounts with the same (platform, handle) via HMAC.
    const conflicts = await prisma.socialAccount.findMany({
      where: {
        platform:   normalizedPlatform,
        handleHmac: hmac,
        removedAt:  null,
        id:         { not: account.id },
      },
    });

    if (conflicts.length > 0) {
      // Flag the new account and all conflicting accounts, then insert conflict records.
      await prisma.$transaction([
        // Flag the new account.
        prisma.socialAccount.update({
          where: { id: account.id },
          data:  { conflictFlagged: true },
        }),
        // Flag all existing conflicting accounts.
        prisma.socialAccount.updateMany({
          where: { id: { in: conflicts.map((c) => c.id) } },
          data:  { conflictFlagged: true },
        }),
        // Insert a conflict record for each existing conflicting account.
        ...conflicts.map((conflictingAccount) =>
          prisma.socialHandleConflict.create({
            data: {
              platform:         normalizedPlatform,
              handle,
              socialAccountIdA: conflictingAccount.id,
              socialAccountIdB: account.id,
            },
          })
        ),
      ]);

      // Reload the account to reflect the updated conflictFlagged state.
      const flaggedAccount = await prisma.socialAccount.findUnique({ where: { id: account.id } });
      return res.status(201).json({
        success:          true,
        account:          sanitizeAccount(flaggedAccount),
        conflictDetected: true,
        message:          'Account added. A handle conflict was detected and flagged for review.',
      });
    }

    return res.status(201).json({ success: true, account: sanitizeAccount(account) });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/social-accounts/:id/remove
// Soft-remove: sets removed_at timestamp. Record is never hard-deleted.
const removeSocialAccount = async (req, res, next) => {
  try {
    const account = await prisma.socialAccount.findUnique({
      where: { id: req.params.id },
    });

    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    if (account.userId !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    if (account.removedAt) {
      return res.status(400).json({ success: false, message: 'Account already removed.' });
    }

    const updated = await prisma.socialAccount.update({
      where: { id: req.params.id },
      data:  { removedAt: new Date() },
    });

    return res.status(200).json({ success: true, account: sanitizeAccount(updated) });
  } catch (err) {
    next(err);
  }
};

module.exports = { listSocialAccounts, addSocialAccount, removeSocialAccount };
