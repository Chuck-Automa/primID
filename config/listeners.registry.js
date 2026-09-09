// config/listeners.registry.js
// SINGLE SOURCE OF TRUTH. Adding a listener or background service to primID means adding an
// entry here in the same commit. /health and /health/last enumerate this array and nothing else.
// Full spec: CLAUDE_HEALTH.md.

module.exports = [
  {
    key: 'phone_android',                      // stable public identifier; never renamed once shipped
    statusProvider: 'android',                 // listener_status.provider PK value
    heartbeatKind: 'device_ping',              // see CLAUDE_HEALTH.md §3
    staleAfterEnv: 'ANDROID_HEARTBEAT_STALE_AFTER_S',
    staleAfterDefault: 600,
    environments: ['dev', 'staging'],          // prohibited in prod — CLAUDE_ANDROID_LISTENER.md
    enabledFlag: null,                         // null = enabled whenever the environment matches
  },
  {
    key: 'phone_telnyx',
    statusProvider: 'telnyx',
    heartbeatKind: 'process_ping',
    staleAfterEnv: 'TELNYX_HEARTBEAT_STALE_AFTER_S',
    staleAfterDefault: 600,
    environments: ['staging', 'prod'],
    enabledFlag: 'FEATURE_PHONE_VERIFICATION_LIVE',
  },
  {
    key: 'telegram',
    statusProvider: 'telegram',
    heartbeatKind: 'process_ping',
    staleAfterEnv: 'TELEGRAM_HEARTBEAT_STALE_AFTER_S',
    staleAfterDefault: 600,
    environments: ['dev', 'staging', 'prod'],
    enabledFlag: 'TELEGRAM_SOCIAL_LISTENER',    // matches the adapter's own gate, boolean 'true'
  },
  {
    key: 'github',
    statusProvider: 'github',
    heartbeatKind: 'poll_cycle',
    staleAfterEnv: 'GITHUB_CRAWL_STALE_AFTER_S',
    staleAfterDefault: 1800,
    environments: ['dev', 'staging', 'prod'],
    enabledFlag: 'CATEGORY_B_PROVIDER',         // exception: enum ('stub'|'live'), not boolean —
                                                 // truthy check is === 'live', not === 'true'.
  },
];
