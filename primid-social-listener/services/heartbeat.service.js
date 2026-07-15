const prisma = require('../../backend/src/shared/db/prisma');

// Sole writer of listener_status — the main API only ever reads it (findUnique).
// Called by the phone adapter's heartbeat handler on system:ping / app:started.
async function recordHeartbeat({ provider, deviceId }) {
  await prisma.listenerStatus.upsert({
    where:  { provider },
    update: { lastSeenAt: new Date(), deviceId: deviceId ?? undefined },
    create: { provider, lastSeenAt: new Date(), deviceId: deviceId ?? null },
  });
}

module.exports = { recordHeartbeat };
