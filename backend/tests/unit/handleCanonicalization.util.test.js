const {
  canonicalizeHandle,
  hasCanonicalizationRule,
} = require('../../src/shared/utils/handleCanonicalization.util');

describe('handleCanonicalization registry', () => {
  test('hasCanonicalizationRule is true for every VALID_PLATFORMS entry', () => {
    // Mirrors VALID_PLATFORMS in social.controller.js exactly — kept as a
    // literal list (not an import) so a drift between the two shows up as a
    // failing test rather than a silently-passing tautology.
    const VALID_PLATFORMS = [
      'facebook', 'x', 'signal', 'telegram', 'linkedin', 'instagram',
      'farcaster', 'nostr', 'bluesky', 'github', 'bitchat',
    ];
    for (const platform of VALID_PLATFORMS) {
      expect(hasCanonicalizationRule(platform)).toBe(true);
    }
  });

  test('hasCanonicalizationRule is false for reddit (not in VALID_PLATFORMS)', () => {
    expect(hasCanonicalizationRule('reddit')).toBe(false);
  });

  test('canonicalizeHandle throws UNSUPPORTED_PLATFORM for an unregistered platform', () => {
    expect(() => canonicalizeHandle('reddit', 'someuser')).toThrow('UNSUPPORTED_PLATFORM');
    expect(() => canonicalizeHandle('myspace', 'someuser')).toThrow('UNSUPPORTED_PLATFORM');
  });
});

describe('github (byte-for-byte preserved)', () => {
  test('lowercases a valid handle', () => {
    expect(canonicalizeHandle('github', 'Chuck-Dev')).toBe('chuck-dev');
  });

  test('rejects a handle over 39 chars', () => {
    expect(() => canonicalizeHandle('github', 'a'.repeat(40))).toThrow('INVALID_GITHUB_HANDLE');
  });

  test('rejects leading/trailing/consecutive hyphens', () => {
    expect(() => canonicalizeHandle('github', '-abc')).toThrow('INVALID_GITHUB_HANDLE');
    expect(() => canonicalizeHandle('github', 'abc-')).toThrow('INVALID_GITHUB_HANDLE');
    expect(() => canonicalizeHandle('github', 'ab--c')).toThrow('INVALID_GITHUB_HANDLE');
  });

  test('does NOT strip @ or a github.com/ URL prefix (existing behavior preserved)', () => {
    expect(() => canonicalizeHandle('github', '@chuck-dev')).toThrow('INVALID_GITHUB_HANDLE');
    expect(() => canonicalizeHandle('github', 'github.com/chuck-dev')).toThrow('INVALID_GITHUB_HANDLE');
  });
});

describe('telegram (byte-for-byte preserved)', () => {
  test('strips @ and t.me/ prefix, lowercases', () => {
    expect(canonicalizeHandle('telegram', '@ChuckDev')).toBe('chuckdev');
    expect(canonicalizeHandle('telegram', 'https://t.me/ChuckDev')).toBe('chuckdev');
    expect(canonicalizeHandle('telegram', 't.me/chuckdev')).toBe('chuckdev');
  });

  test('rejects handles outside 5-32 chars or bad leading char', () => {
    expect(() => canonicalizeHandle('telegram', 'abcd')).toThrow('INVALID_TELEGRAM_HANDLE');
    expect(() => canonicalizeHandle('telegram', '1abcde')).toThrow('INVALID_TELEGRAM_HANDLE');
    expect(() => canonicalizeHandle('telegram', 'a'.repeat(33))).toThrow('INVALID_TELEGRAM_HANDLE');
  });
});

describe('x (twitter)', () => {
  test('strips @, twitter.com/, x.com/ prefixes and lowercases', () => {
    expect(canonicalizeHandle('x', '@ChuckDev')).toBe('chuckdev');
    expect(canonicalizeHandle('x', 'https://twitter.com/ChuckDev')).toBe('chuckdev');
    expect(canonicalizeHandle('x', 'https://x.com/ChuckDev')).toBe('chuckdev');
  });

  test('rejects handles over 15 chars', () => {
    expect(() => canonicalizeHandle('x', 'a'.repeat(16))).toThrow('INVALID_X_HANDLE');
  });
});

describe('instagram', () => {
  test('strips @ and URL prefix, lowercases', () => {
    expect(canonicalizeHandle('instagram', '@Chuck.Dev')).toBe('chuck.dev');
    expect(canonicalizeHandle('instagram', 'https://instagram.com/Chuck.Dev')).toBe('chuck.dev');
  });

  test('rejects leading/trailing/consecutive dots', () => {
    expect(() => canonicalizeHandle('instagram', '.chuck')).toThrow('INVALID_INSTAGRAM_HANDLE');
    expect(() => canonicalizeHandle('instagram', 'chuck.')).toThrow('INVALID_INSTAGRAM_HANDLE');
    expect(() => canonicalizeHandle('instagram', 'chu..ck')).toThrow('INVALID_INSTAGRAM_HANDLE');
  });
});

describe('facebook', () => {
  test('strips URL prefix and lowercases', () => {
    expect(canonicalizeHandle('facebook', 'https://facebook.com/Chuck.Dev')).toBe('chuck.dev');
  });

  test('rejects handles under 5 chars', () => {
    expect(() => canonicalizeHandle('facebook', 'ab.c')).toThrow('INVALID_FACEBOOK_HANDLE');
  });
});

describe('bluesky', () => {
  test('strips @ and https:// prefix, lowercases', () => {
    expect(canonicalizeHandle('bluesky', '@Chuck.bsky.social')).toBe('chuck.bsky.social');
    expect(canonicalizeHandle('bluesky', 'https://chuck.bsky.social')).toBe('chuck.bsky.social');
  });

  test('rejects a non-DNS-hostname handle', () => {
    expect(() => canonicalizeHandle('bluesky', 'not_a_hostname')).toThrow('INVALID_BLUESKY_HANDLE');
  });
});

describe('farcaster', () => {
  test('accepts an fname, strips @ and warpcast.com/ prefix', () => {
    expect(canonicalizeHandle('farcaster', '@ChuckDev')).toBe('chuckdev');
    expect(canonicalizeHandle('farcaster', 'https://warpcast.com/ChuckDev')).toBe('chuckdev');
  });

  test('accepts an ENS-style name', () => {
    expect(canonicalizeHandle('farcaster', 'Chuck.eth')).toBe('chuck.eth');
  });

  test('rejects an invalid name', () => {
    expect(() => canonicalizeHandle('farcaster', '-badstart')).toThrow('INVALID_FARCASTER_HANDLE');
  });
});

describe('linkedin', () => {
  test('strips URL prefix and trailing slash, lowercases', () => {
    expect(canonicalizeHandle('linkedin', 'https://www.linkedin.com/in/Chuck-Dev/')).toBe('chuck-dev');
  });

  test('rejects handles under 3 chars', () => {
    expect(() => canonicalizeHandle('linkedin', 'ab')).toThrow('INVALID_LINKEDIN_HANDLE');
  });
});

describe('signal', () => {
  test('accepts name.NN format, strips @, lowercases', () => {
    expect(canonicalizeHandle('signal', '@Chuck.42')).toBe('chuck.42');
  });

  test('rejects a handle with no numeric discriminator', () => {
    expect(() => canonicalizeHandle('signal', 'chuckdev')).toThrow('INVALID_SIGNAL_HANDLE');
  });
});

describe('bitchat', () => {
  test('lowercases and accepts alnum/underscore/hyphen', () => {
    expect(canonicalizeHandle('bitchat', 'Chuck_Dev-1')).toBe('chuck_dev-1');
  });

  test('rejects handles over 32 chars', () => {
    expect(() => canonicalizeHandle('bitchat', 'a'.repeat(33))).toThrow('INVALID_BITCHAT_HANDLE');
  });
});

describe('nostr', () => {
  // Official NIP-19 test vectors:
  // https://github.com/nostr-protocol/nips/blob/master/19.md ("## Examples")
  const NPUB_1 = 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6';
  const HEX_1 = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
  const NPUB_2 = 'npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg';
  const HEX_2 = '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e';
  const NSEC_EXAMPLE = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

  test('decodes official NIP-19 npub test vector 1 to hex', () => {
    expect(canonicalizeHandle('nostr', NPUB_1)).toBe(HEX_1);
  });

  test('decodes official NIP-19 npub test vector 2 to hex', () => {
    expect(canonicalizeHandle('nostr', NPUB_2)).toBe(HEX_2);
  });

  test('strips a nostr: URI prefix before decoding', () => {
    expect(canonicalizeHandle('nostr', `nostr:${NPUB_1}`)).toBe(HEX_1);
  });

  test('accepts an already-hex pubkey and lowercases it', () => {
    expect(canonicalizeHandle('nostr', HEX_1.toUpperCase())).toBe(HEX_1);
  });

  test('is idempotent (canonicalizing the canonical hex returns itself)', () => {
    const once = canonicalizeHandle('nostr', NPUB_1);
    expect(canonicalizeHandle('nostr', once)).toBe(once);
  });

  test('rejects an invalid checksum (single flipped character)', () => {
    const tampered = NPUB_1.slice(0, -1) + (NPUB_1.at(-1) === '6' ? '7' : '6');
    expect(() => canonicalizeHandle('nostr', tampered)).toThrow('INVALID_NOSTR_HANDLE');
  });

  test('rejects a well-formed bech32 string with the wrong HRP (nsec, not npub)', () => {
    expect(() => canonicalizeHandle('nostr', NSEC_EXAMPLE)).toThrow('INVALID_NOSTR_HANDLE');
  });

  test('rejects garbage input', () => {
    expect(() => canonicalizeHandle('nostr', 'not-a-key')).toThrow('INVALID_NOSTR_HANDLE');
    expect(() => canonicalizeHandle('nostr', '')).toThrow('INVALID_NOSTR_HANDLE');
  });
});
