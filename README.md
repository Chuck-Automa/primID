# primID

A tiered, privacy-preserving proof-of-personhood identity primitive.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![CI](https://github.com/Chuck-Automa/primID/actions/workflows/ci.yml/badge.svg)](https://github.com/Chuck-Automa/primID/actions/workflows/ci.yml)

## What is primID

primID answers one question for the applications that integrate it: *is this account
controlled by a distinct human, and how strongly has that been shown?* It does this
without becoming a store of identity documents. Verification payloads are discarded as
soon as they are confirmed, and only booleans and timestamps are kept. Nothing that
isn't stored can leak.

Trust is layered. A person can start with a single phone number and upgrade to
zero-knowledge proofs from independent protocols. No single protocol is required at any
level, so no single vendor becomes a point of failure or control. Social attestations
between verified people form a public trust graph whose records are never deleted. A
revocation is timestamped and just as visible as the original attestation.

primID is developed and stewarded by the **PrimID Foundation**, a Virginia nonprofit
building open digital-identity infrastructure as a public commons.

## Trust tiers

The numbering is inverted: **Tier 0 is the highest trust level.**

| Tier | Name | How it is reached | Symbol |
|------|------|-------------------|--------|
| **0** | Full personhood | 2 or more verifications from the ZK pool | ● filled circle |
| **1** | Single credential | 1 verification from the ZK pool | ◐ partial circle |
| **2** | Both base methods | Phone **and** OAuth (Google or Apple) | ▲ triangle |
| **3** | Single base method | Phone **or** OAuth, either alone | ■ square |
| **Ghost** | Unverified | No completed verification | ○ empty |

- **Base pool:** phone (inverted SMS flow: the user texts a code *to* primID, and primID
  never sends outbound SMS) and OAuth (`openid` scope only; the only claim retained is `sub`).
- **ZK pool:** zkPassport, zkEmail, Proof of Humanity, Encointer.
- ZK-pool tiers outrank base-pool tiers. A user's tier is the strongest tier they qualify
  for across both pools.
- Users at Tier 0, 1, and 2 can issue attestations for other users, subject to rolling
  rate limits.

## Privacy architecture

- **Application-level encryption.** Sensitive columns are encrypted with AES-256-GCM.
  Lookups use separate HMAC columns, so plaintext is never needed to find a record.
- **Right to erasure.** Account deletion uses cryptographic erasure plus a tombstone row.
  Referential integrity survives, and the personal data does not.
- **Minimal claims.** OAuth requests `openid` only. Name, email, and picture are never
  requested or stored.

## Project status

primID is in active development and is **not yet production-ready**.

| Area | Status |
|------|--------|
| Tier engine, sessions, refresh-token rotation | Implemented |
| OAuth (Google, Apple) | Implemented |
| Phone verification (inverted SMS) | Implemented behind a feature flag; staging only |
| Social account verification (listener + crawler) | Implemented, rolling out per platform |
| Attestations and public profile | Implemented |
| ZK pool (zkPassport, zkEmail, PoH, Encointer) | Endpoints stubbed; live integration planned |
| On-chain attestation anchoring | Planned |

## Repository layout

```
backend/                 Node.js + Express API, Prisma/PostgreSQL
  prisma/                Schema and migrations
  vendor/                Vendored high-risk dependencies (see vendor/PINS.md)
frontend/                React client (mobile-first)
primid-social-listener/  Inbound listener service (SMS gateway, Telegram, Reddit)
config/                  Shared configuration (listener registry)
render.yaml              Deployment blueprint
```

## Getting started

**Requirements:** Node.js 22 LTS and PostgreSQL 15 or newer.

This project treats the npm supply chain as an attack surface. **Always install with
`npm ci --ignore-scripts`, never `npm install`.** Lockfiles are authoritative, dependency
versions are exact pins, and lifecycle scripts are never run.

### Backend

```bash
cd backend
cp .env.example .env              # fill in DATABASE_URL, JWT_SECRET, ALE_ENCRYPTION_KEY, HMAC_SECRET
npm ci --ignore-scripts
npx prisma generate               # explicit, never via postinstall
npx prisma migrate dev
npm run dev                       # http://localhost:3001
```

Generate each key with `openssl rand -hex 32`. `HMAC_SECRET` must differ from
`ALE_ENCRYPTION_KEY`.

### Frontend

```bash
cd frontend
cp .env.example .env
npm ci --ignore-scripts --legacy-peer-deps   # required by react-scripts 5
npm start                                    # http://localhost:3000
```

### Social listener (optional)

```bash
cd backend && npm ci --ignore-scripts && npx prisma generate && cd ..
cd primid-social-listener
npm ci --ignore-scripts
npm run dev
```

All listener adapters are off by default. See `render.yaml` for the flags.

### Tests

```bash
cd backend && npm test
cd frontend && npm test -- --watchAll=false
cd primid-social-listener && node --test "test/**/*.test.js"
```

## Contributing

Contributions are welcome. Every commit must carry a Developer Certificate of Origin
sign-off (`git commit -s`), which certifies that you have the right to submit the work
under this project's license. See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## License

primID is licensed under the GNU Affero General Public License v3.0 only (AGPL-3.0-only).
See [LICENSE](LICENSE) for the full text.

Copyright (C) 2026 PrimID Foundation.

## Security

Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
