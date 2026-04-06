const { scrubForLog } = require('../../src/shared/middleware/loggerScrub');

describe('scrubForLog', () => {
  test('redacts phoneNumber', () => {
    expect(scrubForLog({ phoneNumber: '+15555551234', other: 'ok' })).toEqual({
      phoneNumber: '[REDACTED]',
      other: 'ok',
    });
  });

  test('redacts oauthSub', () => {
    expect(scrubForLog({ oauthSub: 'google|abc', email: 'x@x.com' })).toEqual({
      oauthSub: '[REDACTED]',
      email: 'x@x.com',
    });
  });

  test('redacts token', () => {
    expect(scrubForLog({ token: 'eyJ...', method: 'oauth' })).toEqual({
      token: '[REDACTED]',
      method: 'oauth',
    });
  });

  test('redacts walletAddress', () => {
    expect(scrubForLog({ walletAddress: '0xabc', tier: 2 })).toEqual({
      walletAddress: '[REDACTED]',
      tier: 2,
    });
  });

  test('leaves non-PII fields untouched', () => {
    const input = { method: 'otp', subjectUserId: 'uuid-1', attestationType: 'vouches_for' };
    expect(scrubForLog(input)).toEqual(input);
  });

  test('does not mutate the original object', () => {
    const input = { phoneNumber: '+1555', tier: 3 };
    scrubForLog(input);
    expect(input.phoneNumber).toBe('+1555');
  });

  test('returns non-object values unchanged', () => {
    expect(scrubForLog(null)).toBeNull();
    expect(scrubForLog('string')).toBe('string');
    expect(scrubForLog(42)).toBe(42);
  });
});
