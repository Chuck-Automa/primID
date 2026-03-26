const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const VALID_PLATFORMS = [
  'facebook', 'x', 'signal', 'telegram', 'linkedin', 'instagram',
  'farcaster', 'nostr', 'bluesky', 'github', 'bitchat',
];

// GET /api/social-accounts
const listSocialAccounts = async (req, res, next) => {
  try {
    const accounts = await prisma.socialAccount.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ success: true, accounts });
  } catch (err) {
    next(err);
  }
};

// POST /api/social-accounts
const addSocialAccount = async (req, res, next) => {
  try {
    const { platform, handle, isPublic } = req.body;

    if (!platform || !handle) {
      return res.status(400).json({ success: false, message: 'platform and handle are required.' });
    }

    if (!VALID_PLATFORMS.includes(platform.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid platform. Supported: ${VALID_PLATFORMS.join(', ')}`,
      });
    }

    const account = await prisma.socialAccount.create({
      data: {
        userId: req.userId,
        platform: platform.toLowerCase(),
        handle,
        isPublic: !!isPublic,
      },
    });

    return res.status(201).json({ success: true, account });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/social-accounts/:id — hard delete allowed (self-reported only)
const deleteSocialAccount = async (req, res, next) => {
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

    await prisma.socialAccount.delete({ where: { id: req.params.id } });

    return res.status(200).json({ success: true, message: 'Social account removed.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { listSocialAccounts, addSocialAccount, deleteSocialAccount };
