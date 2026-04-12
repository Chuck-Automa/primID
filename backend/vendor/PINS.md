# Vendored Package Pins

Packages in this directory are NOT managed by npm. They are imported directly
from `vendor/` paths and updated only via explicit code review and re-pin.

Do NOT:
- Add these packages back to `package.json`
- Upgrade via `npm update`, Dependabot, Renovate, or any automated tool
- Modify files inside these directories without recording the change below

To update a vendored package:
1. Copy the new version from a clean `npm pack` or `node_modules/` after isolated install
2. Update the version, date, and integrity hash in this file
3. Review the diff — treat it like a code review, not a dependency bump
4. Record a CHANGELOG entry explaining why the update was necessary

---

## libphonenumber-js

| Field | Value |
|---|---|
| **Version** | 1.12.41 |
| **npm integrity** | `sha512-lsmMmGXBxXIK/VMLEj0kL6MtUs1kBGj1nTCzi6zgQoG1DEwqwt2DQyHxcLykceIxAnfE3hya7NuIh6PpC6S3fA==` |
| **Pinned date** | 2026-04-12 |
| **Risk reason** | Single maintainer; sits at the front of every phone auth code path |
| **Import site** | `backend/src/shared/utils/crypto.util.js` |

## jsonwebtoken

| Field | Value |
|---|---|
| **Version** | 9.0.3 |
| **npm integrity** | `sha512-MT/xP0CrubFRNLNKvxJ2BYfy53Zkm++5bX9dtuPbqAeQpTVe0MQTFhao8+Cp//EmJp244xt6Drw/GVEGCUj40g==` |
| **Pinned date** | 2026-04-12 |
| **Risk reason** | Auth infrastructure; total platform compromise if tampered |
| **Import site** | `backend/src/shared/utils/jwt.util.js` |

## @cyclonedx/cyclonedx-npm

| Field | Value |
|---|---|
| **Version** | 4.2.1 |
| **npm integrity** | `sha512-SOA/96sf0wsgUYCRtFkLFm6WoFhG+q1BxdC84hPSn9J3xWlH1e7OnTPJT+WNUzTqzX1nSm5JhjRX4krozu2X+g==` |
| **Pinned date** | 2026-04-12 |
| **Note** | SBOM generator — devDependency, not vendored to vendor/; pinned in package.json as exact version |

## bcrypt

Not vendored — removed from the codebase. `bcrypt` was listed in `package.json`
but was unused in Sprint 1 source. Sprint 1 has no password auth. If bcrypt
becomes necessary in a future sprint, vendor it at that time following the
procedure above (native `node-pre-gyp` bindings require extra scrutiny of the
prebuilt binary provenance).
