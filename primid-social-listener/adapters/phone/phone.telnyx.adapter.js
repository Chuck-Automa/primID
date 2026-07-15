// Sprint 2 — Telnyx Ed25519 webhook verification; not implemented.
// mount() intentionally a no-op so PHONE_LISTENER_PROVIDER=telnyx doesn't crash
// ahead of real implementation.
function mount(_app) {
  console.log('[phone.telnyx.adapter] Sprint 2 stub — no routes mounted.');
}

module.exports = { mount };
