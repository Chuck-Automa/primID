# Security Policy

## Supported Versions

primID is in active development and has no versioned releases yet. Security fixes are
applied to the `main` branch on a rolling basis, and the deployed service tracks `main`.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, pull
requests, or discussions.**

Report vulnerabilities by email to **contact@primid.org**.

Please include:

- A description of the vulnerability and the component it affects
- Steps to reproduce, or a proof of concept
- The potential impact, including what an attacker could gain
- Any suggested mitigations

You will receive an acknowledgment within 48 hours. We aim to confirm or rule out the issue
and provide a remediation timeline within 7 days of confirmation.

## Scope

primID is a proof-of-personhood system, so its most important security property is that
**one human cannot hold more trust than the protocol grants them.** Reports in these areas
are especially valuable:

- **Tier or sybil bypass.** Reaching a tier without completing its verifications,
  replaying or forging a verification, or registering multiple accounts from one
  verification method.
- **Authentication and session flaws.** Token forgery, refresh-token rotation bypass, or
  session-cap evasion.
- **Privacy failures.** Recovering encrypted fields, linking HMAC lookup values to
  plaintext, data that survives an account erasure, or public endpoints that expose
  non-public fields.
- **Attestation integrity.** Creating, altering, or deleting attestations or revocations
  without authorization, or bypassing issuance rate limits.
- **Webhook and listener authentication.** Signature, secret, or replay-window bypass on
  inbound verification channels.
- **Supply chain.** Tampering paths through vendored code, CI, or the build pipeline.

The following are **out of scope**:

- Volumetric denial of service
- Social engineering of Foundation personnel, and physical attacks
- Vulnerabilities in third-party services (hosting, SMS, OAuth providers) that are not
  caused by primID's integration with them
- Missing security headers or best-practice findings with no demonstrated impact
- Findings that require a compromised user device or a compromised operator account
 - Documented dev/staging stubs and demo paths, including whitelisted demo phone numbers that auto-resolve and the Apple OAuth stub, which are
  intentional and do not run in production
  
Test only against accounts you control. Do not access, modify, or retain other users' data,
and stop and report as soon as you have demonstrated an issue.

## Disclosure Policy

We follow coordinated disclosure. Please allow us a reasonable period to investigate and
remediate before any public disclosure. We will agree on a disclosure date with you, and we
will credit researchers who responsibly disclose valid vulnerabilities, unless they prefer
to stay anonymous.

## Safe Harbor

We will not pursue legal action against anyone who researches and reports a vulnerability
in good faith and in accordance with this policy.
