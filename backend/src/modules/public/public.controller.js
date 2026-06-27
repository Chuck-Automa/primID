const prisma = require('../../shared/db/prisma');
const { computeHmac } = require('../../shared/utils/crypto.util');

const VALID_PLATFORMS = [
  'facebook', 'x', 'signal', 'telegram', 'linkedin', 'instagram',
  'farcaster', 'nostr', 'bluesky', 'github', 'bitchat',
];

/**
 * Build a verification history timeline from a user's *_verified_at fields.
 * Returns events sorted most-recent-first, each with the tier reached at that point.
 */
function buildVerificationHistory(user) {
  const zkCount = [
    user.zkPassportVerified,
    user.zkEmailVerified,
    user.pohVerified,
    user.ecointerVerified,
  ].filter(Boolean).length;

  const candidates = [
    { field: 'phoneVerifiedAt',      event: 'phone_verified',       tierAfter: 3 },
    { field: 'oauthVerifiedAt',      event: 'oauth_verified',       tierAfter: 2 },
    { field: 'zkPassportVerifiedAt', event: 'zk_passport_verified', tierAfter: zkCount >= 2 ? 0 : 1 },
    { field: 'zkEmailVerifiedAt',    event: 'zk_email_verified',    tierAfter: zkCount >= 2 ? 0 : 1 },
    { field: 'pohVerifiedAt',        event: 'poh_verified',         tierAfter: zkCount >= 2 ? 0 : 1 },
    { field: 'ecointerVerifiedAt',  event: 'ecointer_verified',   tierAfter: zkCount >= 2 ? 0 : 1 },
  ];

  return candidates
    .filter((c) => user[c.field] !== null)
    .map((c) => ({ event: c.event, tier: c.tierAfter, at: user[c.field] }))
    .sort((a, b) => new Date(b.at) - new Date(a.at));
}

// GET /api/public/lookup/:platform/:handle
const lookupHandle = async (req, res, next) => {
  try {
    const { platform, handle } = req.params;

    if (!VALID_PLATFORMS.includes(platform)) {
      return res.status(400).json({ success: false, message: `Unknown platform: ${platform}` });
    }

    const account = await prisma.socialAccount.findFirst({
      where: { platform, handleHmac: computeHmac(handle), removedAt: null },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: `No primID user found with ${platform} handle "${handle}".`,
      });
    }

    const user = await prisma.user.findUnique({ where: { id: account.userId } });

    const conflicts = await prisma.socialHandleConflict.findMany({
      where: {
        OR: [
          { socialAccountIdA: account.id },
          { socialAccountIdB: account.id },
        ],
      },
      orderBy: { detectedAt: 'desc' },
      select: { detectedAt: true, resolvedAt: true },
    });

    const verificationHistory = buildVerificationHistory(user);

    // Determine verified-since: date of the event that established current tier
    const tierEvent = verificationHistory.find((e) => e.tier === user.currentTier);
    const verifiedSince = tierEvent ? tierEvent.at : null;

    const response = {
      success: true,
      platform,
      handle,
      conflictFlagged: account.conflictFlagged,
      user: {
        displayName: user.displayName,
        currentTier: user.currentTier,
        verifiedSince,
        verificationHistory,
        conflicts,
      },
    };

    // 409 if conflicted but still return data so the frontend can show conflict history
    return res.status(account.conflictFlagged ? 409 : 200).json(response);
  } catch (err) {
    next(err);
  }
};

// GET /api/public/suggestions/:platform?q=prefix
const suggestHandles = async (req, res, next) => {
  try {
    const { platform } = req.params;
    const q = (req.query.q || '').trim();

    if (!VALID_PLATFORMS.includes(platform)) {
      return res.status(400).json({ success: false, message: `Unknown platform: ${platform}` });
    }

    if (q.length < 2) {
      return res.status(200).json({ success: true, suggestions: [] });
    }

    const accounts = await prisma.socialAccount.findMany({
      where: {
        platform,
        handleSearch: { startsWith: q, mode: 'insensitive' },
        removedAt: null,
      },
      select:  { handleSearch: true },
      orderBy: { handleSearch: 'asc' },
      take: 8,
    });

    return res.status(200).json({
      success:     true,
      suggestions: accounts.map((a) => a.handleSearch),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/public/attestations/:platform/:handle
const listPublicAttestations = async (req, res, next) => {
  try {
    const { platform, handle } = req.params;

    if (!VALID_PLATFORMS.includes(platform)) {
      return res.status(400).json({ success: false, message: `Unknown platform: ${platform}` });
    }

    const account = await prisma.socialAccount.findFirst({
      where: { platform, handleHmac: computeHmac(handle), removedAt: null },
    });

    if (!account) {
      return res.status(404).json({ success: false, message: 'Handle not found.' });
    }

    const attestations = await prisma.attestation.findMany({
      where: {
        subjectId: account.userId,
        publicAt:  { not: null },
        // revokedAt intentionally NOT filtered — revoked attestations remain
        // visible per immutability principle: rescinding is as loud as attesting.
      },
      orderBy: { publicAt: 'desc' },
      include: {
        issuer: {
          select: { currentTier: true, displayName: true },
        },
      },
    });

    const safe = attestations.map((a) => ({
      id:              a.id,
      attestationType: a.attestationType,
      publicAt:        a.publicAt,
      revokedAt:       a.revokedAt,
      issuer: {
        currentTier: a.issuer.currentTier,
        displayName: a.issuer.displayName,
      },
    }));

    return res.status(200).json({ success: true, attestations: safe });
  } catch (err) {
    next(err);
  }
};

module.exports = { lookupHandle, suggestHandles, listPublicAttestations };
