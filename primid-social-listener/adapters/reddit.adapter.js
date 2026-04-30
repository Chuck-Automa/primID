const challengeService = require('../services/challenge.service');

const POLL_INTERVAL_MS = 30_000;
const REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const REDDIT_INBOX_URL = 'https://oauth.reddit.com/message/inbox?limit=25&mark=false';
const USER_AGENT      = 'primid-social-listener/1.0 by u/primid';

let accessToken    = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (Date.now() < tokenExpiresAt - 60_000) return accessToken;

  const credentials = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
  ).toString('base64');

  const res = await globalThis.fetch(REDDIT_TOKEN_URL, {
    method:  'POST',
    headers: {
      Authorization:  `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent':   USER_AGENT,
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(process.env.REDDIT_REFRESH_TOKEN)}`,
  });

  if (!res.ok) {
    throw new Error(`Reddit token refresh failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  accessToken    = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  console.log(`[reddit-adapter] token refreshed, expires in ${data.expires_in}s`);
  return accessToken;
}

async function pollRedditInbox() {
  try {
    const token = await getAccessToken();

    const res = await globalThis.fetch(REDDIT_INBOX_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent':  USER_AGENT,
      },
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10);
      console.log(`[reddit-adapter] rate limited, backing off ${retryAfter}s`);
      setTimeout(pollRedditInbox, retryAfter * 1000);
      return;
    }

    if (!res.ok) {
      console.log(`[reddit-adapter] inbox fetch error: HTTP ${res.status}`);
      setTimeout(pollRedditInbox, POLL_INTERVAL_MS);
      return;
    }

    const json     = await res.json();
    const messages = (json?.data?.children || []).filter((c) => c.kind === 't4');

    const validations = messages.map((item) => {
      const senderHandle = item.data.author;
      const code         = (item.data.body || '').trim();
      return challengeService.validateAndMark({ code, senderHandle, platform: 'reddit' });
    });

    await Promise.allSettled(validations).then((results) => {
      results.forEach((r) => {
        if (r.status === 'rejected') {
          console.log(`[reddit-adapter] validation error: ${r.reason?.message}`);
        }
      });
    });
  } catch (err) {
    console.log(`[reddit-adapter] poll error: ${err.message}`);
  }

  setTimeout(pollRedditInbox, POLL_INTERVAL_MS);
}

function start() {
  setTimeout(pollRedditInbox, 0);
}

module.exports = { start };
