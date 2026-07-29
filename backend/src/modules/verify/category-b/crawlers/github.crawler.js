// GitHub Category B crawler. Zero npm dependencies — Node >=18 global fetch and
// built-ins only. Do not add @octokit/* or any GitHub SDK (CLAUDE_CATEGORY_B_VERIFICATION.md).
//
// Returns {found, matchedHandle, artifactRef, error} to crawl.controller.js:
//   found        — an artifact containing the code was located (regardless of whose account)
//   matchedHandle — the (lowercased) account login that owned the artifact, or null
//   artifactRef  — a URL to the artifact, or null
//   error        — null | 'rate_limited' | 'server_error' | 'handle_not_found'
// The controller — not this crawler — decides whether matchedHandle equals the
// expected handle (a pass) or not (handle_mismatch). This crawler never touches
// challenges or social_accounts rows; no DB logic here.

const GITHUB_API = 'https://api.github.com';

function githubHeaders() {
  return {
    Authorization:         `Bearer ${process.env.GITHUB_PAT}`,
    Accept:                'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent':          'primid-verification',
  };
}

function isWithinChallengeWindow(artifactCreatedAt, challenge) {
  const t = new Date(artifactCreatedAt).getTime();
  return t >= new Date(challenge.createdAt).getTime() && t <= new Date(challenge.expiresAt).getTime();
}

// GET /users/{handle}/gists — never the search API (search indexing lags too
// far behind for a 15-minute real-time verification window).
async function checkGist(handle, challenge) {
  const res = await globalThis.fetch(
    `${GITHUB_API}/users/${encodeURIComponent(handle)}/gists?per_page=10`,
    { headers: githubHeaders() }
  );

  if (res.status === 404) {
    return { found: false, matchedHandle: null, artifactRef: null, error: 'handle_not_found' };
  }
  if (res.status === 403 || res.status === 429) {
    return { found: false, matchedHandle: null, artifactRef: null, error: 'rate_limited' };
  }
  if (!res.ok) {
    return { found: false, matchedHandle: null, artifactRef: null, error: 'server_error' };
  }

  const gists = await res.json();

  for (const gist of gists) {
    if (!isWithinChallengeWindow(gist.created_at, challenge)) continue;

    // Case-sensitive match on the code itself — never lowercase the gist content.
    const inDescription = (gist.description || '').includes(challenge.code);
    const inFilename = Object.keys(gist.files || {}).some((name) => name.includes(challenge.code));
    if (!inDescription && !inFilename) continue;

    return {
      found:         true,
      matchedHandle: (gist.owner?.login || '').toLowerCase(),
      artifactRef:   gist.html_url,
      error:         null,
    };
  }

  return { found: false, matchedHandle: null, artifactRef: null, error: null };
}

// GET /users/{handle} — bio fallback, checked only if the gist path found nothing.
async function checkBio(handle, challenge) {
  const res = await globalThis.fetch(`${GITHUB_API}/users/${encodeURIComponent(handle)}`, {
    headers: githubHeaders(),
  });

  if (res.status === 404) {
    return { found: false, matchedHandle: null, artifactRef: null, error: 'handle_not_found' };
  }
  if (res.status === 403 || res.status === 429) {
    return { found: false, matchedHandle: null, artifactRef: null, error: 'rate_limited' };
  }
  if (!res.ok) {
    return { found: false, matchedHandle: null, artifactRef: null, error: 'server_error' };
  }

  const user = await res.json();
  const bio = user.bio || '';

  if (!bio.includes(challenge.code)) {
    return { found: false, matchedHandle: null, artifactRef: null, error: null };
  }

  return {
    found:         true,
    matchedHandle: (user.login || '').toLowerCase(),
    artifactRef:   `https://github.com/${user.login}`,
    error:         null,
  };
}

// One user click = one logical crawl = at most 2 GitHub requests (gist, then
// bio only if the gist check found nothing and wasn't itself an error).
async function crawl(challenge, expectedHandle) {
  const gistResult = await checkGist(expectedHandle, challenge);

  if (gistResult.found || gistResult.error) {
    return gistResult;
  }

  return checkBio(expectedHandle, challenge);
}

module.exports = { crawl };
