// Dev/staging only — never touches the network. Auto-resolves found:true for
// whitelisted handles (CATEGORY_B_STUB_HANDLES), found:false otherwise.
// Hard gate: refuses to load if misconfigured for production, mirroring the
// phone-verification stub's convention.
if (process.env.NODE_ENV === 'production' && process.env.CATEGORY_B_PROVIDER === 'stub') {
  throw new Error('CATEGORY_B_PROVIDER=stub is not permitted when NODE_ENV=production.');
}

function getWhitelist() {
  return (process.env.CATEGORY_B_STUB_HANDLES || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

async function crawl(challenge, expectedHandle) {
  const whitelist = getWhitelist();
  const handle = (expectedHandle || '').toLowerCase();

  if (whitelist.includes(handle)) {
    return { found: true, matchedHandle: handle, artifactRef: 'stub://whitelisted', error: null };
  }

  return { found: false, matchedHandle: null, artifactRef: null, error: null };
}

module.exports = { crawl };
