// Exactly one phone adapter is active per environment, selected by
// PHONE_LISTENER_PROVIDER=telnyx|android|stub. Both adapters emit the identical
// {code, senderHandle} contract to challenge.service.js. Switching providers is
// a config change only.
function mount(app) {
  const provider = process.env.PHONE_LISTENER_PROVIDER;

  if (provider === 'android') {
    require('./phone.android.adapter').mount(app);
  } else if (provider === 'telnyx') {
    require('./phone.telnyx.adapter').mount(app);
  }
  // 'stub' (or unset) — no routes mounted, nothing to receive.
}

module.exports = { mount };
