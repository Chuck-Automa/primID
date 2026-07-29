// Maps a platform string to its Category B crawler module. Adding a platform
// means adding one crawler file and one entry here — no controller changes.
const githubCrawler = require('./crawlers/github.crawler');
const stubCrawler = require('./crawlers/stub.crawler');

const CRAWLERS = {
  github: githubCrawler,
  // farcaster, nostr, linkedin — Sprint 3+, do not add until specified.
};

function getStubWhitelist() {
  return (process.env.CATEGORY_B_STUB_HANDLES || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Resolve which crawler implementation should handle this platform/handle.
 * The whitelist check happens here, before dispatch, so a whitelisted handle
 * always resolves via the stub even when CATEGORY_B_PROVIDER=live (hybrid
 * staging demo mode) — the live crawler never sees whitelist logic.
 * Returns null if the platform has no Category B crawler at all.
 */
function resolveCrawler(platform, expectedHandle) {
  if (!CRAWLERS[platform]) return null;

  const whitelist = getStubWhitelist();
  if (whitelist.includes((expectedHandle || '').toLowerCase())) {
    return stubCrawler;
  }

  if (process.env.CATEGORY_B_PROVIDER === 'stub') {
    return stubCrawler;
  }

  return CRAWLERS[platform];
}

module.exports = { resolveCrawler };
