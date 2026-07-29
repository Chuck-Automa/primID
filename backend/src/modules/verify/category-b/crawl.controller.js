const prisma = require('../../../shared/db/prisma');
const { validateAndMarkSocial } = require('../../../shared/services/challenge.service');
const { resolveCrawler } = require('./crawler.registry');

const MAX_CRAWL_ATTEMPTS = 10;

function errorToReason(error) {
  if (error === 'rate_limited') return 'platform_rate_limited';
  if (error === 'server_error') return 'platform_error';
  if (error === 'handle_not_found') return 'handle_not_found';
  return null;
}

// Platform-side failures never consume the user's attempt cap — everything
// else does (including handle_not_found, since the fix there is correcting
// the registered handle, not retrying, but it's still a "genuine" outcome
// rather than a primID/GitHub infrastructure failure).
function isPlatformFailure(error) {
  return error === 'rate_limited' || error === 'server_error';
}

// POST /api/verify/social/:socialAccountId/crawl
const crawlSocialAccount = async (req, res, next) => {
  try {
    const account = await prisma.socialAccount.findUnique({
      where: { id: req.params.socialAccountId },
    });

    // 404, not 403 — never confirm another user's row exists.
    if (!account || account.userId !== req.userId || account.removedAt) {
      return res.status(404).json({ success: false, message: 'Social account not found.' });
    }

    const challenge = await prisma.challenge.findFirst({
      where: { socialAccountId: account.id, channel: 'social', usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      return res.status(409).json({ success: false, code: 'no_active_challenge' });
    }
    if (challenge.expiresAt <= new Date()) {
      return res.status(409).json({ success: false, code: 'challenge_expired' });
    }
    if (challenge.crawlAttempts >= MAX_CRAWL_ATTEMPTS) {
      return res.status(429).json({ success: false, attempts_exhausted: true });
    }

    const expectedHandle = challenge.expectedHandle || account.handleSearch;
    const crawler = resolveCrawler(account.platform, expectedHandle);

    if (!crawler) {
      return res.status(400).json({
        success: false,
        message: 'This platform does not support crawl-based verification.',
      });
    }

    const result = await crawler.crawl(challenge, expectedHandle);

    // Exactly one crawl attempt per request. Increment unless this was a
    // platform-side failure — that's the one exemption from the cap.
    if (!isPlatformFailure(result.error)) {
      await prisma.challenge.update({
        where: { id: challenge.id },
        data:  { crawlAttempts: { increment: 1 } },
      });
    }
    const attemptsUsed = isPlatformFailure(result.error) ? challenge.crawlAttempts : challenge.crawlAttempts + 1;
    const attemptsRemaining = Math.max(0, MAX_CRAWL_ATTEMPTS - attemptsUsed);

    const handleMatches = result.found
      && result.matchedHandle
      && result.matchedHandle.toLowerCase() === (expectedHandle || '').toLowerCase();

    if (result.found && handleMatches) {
      const verified = await validateAndMarkSocial({
        code:         challenge.code,
        senderHandle: result.matchedHandle,
        platform:     account.platform,
      });

      if (verified) {
        const updatedAccount = await prisma.socialAccount.findUnique({ where: { id: account.id } });
        return res.status(200).json({
          success:    true,
          verified:   true,
          platform:   account.platform,
          handle:     account.handleSearch,
          verifiedAt: updatedAccount.verifiedAt,
        });
      }
      // Challenge was consumed/expired between the crawl and this call — treat
      // as a normal miss rather than a 500.
      return res.status(200).json({
        success: true, verified: false, reason: 'code_not_found', attemptsRemaining, expiresAt: challenge.expiresAt,
      });
    }

    // found but wrong account — never reveal whose account it actually was.
    if (result.found && !handleMatches) {
      return res.status(200).json({
        success: true, verified: false, reason: 'handle_mismatch', attemptsRemaining, expiresAt: challenge.expiresAt,
      });
    }

    return res.status(200).json({
      success:           true,
      verified:          false,
      reason:            errorToReason(result.error) || 'code_not_found',
      attemptsRemaining,
      expiresAt:         challenge.expiresAt,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { crawlSocialAccount };
