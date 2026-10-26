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

### jsonwebtoken runtime dependencies — `vendor/jsonwebtoken/node_modules/`

Committed alongside jsonwebtoken so it resolves without npm. Previously these were supplied only
implicitly, hoisted into `backend/node_modules` by an unrelated, unused dependency (since removed);
without it a clean `npm ci` fails with `Cannot find module 'jws'`. `jws`/`jwa`/`ecdsa-sig-formatter`
perform the actual JWT signature work and get the same review bar as jsonwebtoken itself.

| Field | Value |
|---|---|
| **Pinned date** | 2026-10-26 |
| **Source** | `npm pack <name>@<version>`; each tarball integrity verified equal to the backend `package-lock.json` entry before extraction; no install scripts or native bindings in any package |
| **Reason for last update** | Initial vendoring — closes a transitive-dependency gap that left jsonwebtoken resolving its dependencies from npm |

| Package | Version | npm integrity |
|---|---|---|
| `jws` | 4.0.1 | `sha512-EKI/M/yqPncGUUh44xz0PxSidXFr/+r0pA70+gIYhjv+et7yxM+s29Y+VGDkovRofQem0fs7Uvf4+YmAdyRduA==` |
| `jwa` | 2.0.1 | `sha512-hRF04fqJIP8Abbkq5NKGN0Bbr3JxlQ+qhZufXVr0DvujKy93ZCbXZMHDL4EOtodSbCWxOqR8MS1tXA5hwqCXDg==` |
| `ecdsa-sig-formatter` | 1.0.11 | `sha512-nagl3RYrbNv6kQkeJIpt6NJZy8twLB/2vtz6yN9Z4vRKHN4/QZJIEbqohALSgwKdnksuY3k5Addp5lg8sVoVcQ==` |
| `buffer-equal-constant-time` | 1.0.1 | `sha512-zRpUiDwd/xk6ADqPMATG8vc9VPrkck7T07OIx0gnjmJAnHnTVXNQG3vfvWNuiZIkwu9KrKdA1iJKfsfTVxE6NA==` |
| `safe-buffer` | 5.2.1 | `sha512-rp3So07KcdmmKbGvgaNxQSJr7bGVSVk5S9Eq1F+ppbRo70+YeaDxkw5Dd8NPN+GD6bjnYm2VuPuCXmpuYvmCXQ==` |
| `lodash.includes` | 4.3.0 | `sha512-W3Bx6mdkRTGtlJISOvVD/lbqjTlPPUDTMnlXZFnVwi9NKJ6tiAk6LVdlhZMm17VZisqhKcgzpO5Wz91PCt5b0w==` |
| `lodash.isboolean` | 3.0.3 | `sha512-Bz5mupy2SVbPHURB98VAcw+aHh4vRV5IPNhILUCsOzRmsTmSQ17jIuqopAentWoehktxGd9e/hbIXq980/1QJg==` |
| `lodash.isinteger` | 4.0.4 | `sha512-DBwtEWN2caHQ9/imiNeEA5ys1JoRtRfY3d7V9wkqtbycnAmTvRRmbHKDV4a0EYc678/dia0jrte4tjYwVBaZUA==` |
| `lodash.isnumber` | 3.0.3 | `sha512-QYqzpfwO3/CWf3XP+Z+tkQsfaLL/EnUlXWVkIk5FUPc4sBdTehEqZONuyRt2P67PXAk+NXmTBcc97zw9t1FQrw==` |
| `lodash.isplainobject` | 4.0.6 | `sha512-oSXzaWypCMHkPC3NvBEaPHf0KsA5mvPrOPgQWDsbg8n7orZ290M0BmC/jgRZ4vcJ6DTAhjrsSYgdsW/F+MFOBA==` |
| `lodash.isstring` | 4.0.1 | `sha512-0wJxfxH1wgO3GrbuP+dTTk7op+6L41QCXbGINEmD+ny/G/eCqGzxyCsh7159S+mgDDcoarnBw6PC1PS5+wUGgw==` |
| `lodash.once` | 4.1.1 | `sha512-Sb487aTOCr9drQVL8pIxOzVhafOjZN9UU54hiN8PU3uAiSV7lx1yYNpbNmex2PK6dSJoNTSJUUswT651yww3Mg==` |
| `ms` | 2.1.3 | `sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==` |
| `semver` | 7.7.4 | `sha512-vFKC2IEtQnVhpT78h1Yp8wzwrf8CM+MzKMHGJZfBtzhZNycRFnXsHk6E5TxIkkMsgNS7mdX3AGB7x2QM2di4lA==` |

## @cyclonedx/cyclonedx-npm

| Field | Value |
|---|---|
| **Version** | 4.2.1 |
| **npm integrity** | `sha512-SOA/96sf0wsgUYCRtFkLFm6WoFhG+q1BxdC84hPSn9J3xWlH1e7OnTPJT+WNUzTqzX1nSm5JhjRX4krozu2X+g==` |
| **Pinned date** | 2026-04-12 |
| **Note** | SBOM generator — devDependency, not vendored to vendor/; pinned in package.json as exact version |

## Node.js runtime

| Field | Value |
|---|---|
| **Version** | 24.22.1 (LTS) |
| **Pinned date** | 2026-10-26 |
| **Reason for last update** | Node.js October 21, 2026 security releases — https://nodejs.org/en/blog/vulnerability/october-2026-security-releases (moved off EOL 20.x) |
| **Source of truth** | `/.nvmrc` |
| **Must match** | `engines.node` in backend, frontend, primid-social-listener `package.json`; `node-version-file: .nvmrc` in `.github/workflows/ci.yml`; `NODE_VERSION` in `render.yaml` and in each Render service dashboard (the dashboard value wins on Render) |

## Socket.dev CLI

| Field | Value |
|---|---|
| **Version** | `@socketsecurity/cli@1.1.82` |
| **Pinned date** | 2026-10-26 (first recorded here; version already in use in CI) |
| **Used in** | `.github/workflows/ci.yml` — Socket.dev supply chain scan step in the backend, frontend, and social-listener jobs, invoked as `npx --yes @socketsecurity/cli@1.1.82 scan create --defaultBranch --pendingHead` |
| **Note** | Not a dependency of any package; fetched by exact version at CI time. Do not use `SocketDev/action@v1` (broken in `mode: cli`) |

## GitHub Actions

Pinned to full commit SHAs in `.github/workflows/ci.yml` (tags are mutable; SHAs are not). Each
SHA is the commit behind the exact release tag, which was also the target of the floating `v4`
tag at pin time — pinning changed no behavior. Update by resolving the new release tag with
`git ls-remote --tags https://github.com/actions/<name>`, reviewing the diff between SHAs, and
recording it here.

| Action | Release | Commit SHA | Pinned date |
|---|---|---|---|
| `actions/checkout` | v4.4.0 | `11d5960a326750d5838078e36cf38b85af677262` | 2026-10-26 |
| `actions/setup-node` | v4.4.0 | `49933ea5288caeca8642d1e84afbd3f7d6820020` | 2026-10-26 |
| `actions/upload-artifact` | v4.6.2 | `ea165f8d65b6e75b540449e92b4886f43607fa02` | 2026-10-26 |

## bcrypt

Not vendored — removed from the codebase. `bcrypt` was listed in `package.json`
but was unused in Sprint 1 source. Sprint 1 has no password auth. If bcrypt
becomes necessary in a future sprint, vendor it at that time following the
procedure above (native `node-pre-gyp` bindings require extra scrutiny of the
prebuilt binary provenance).
