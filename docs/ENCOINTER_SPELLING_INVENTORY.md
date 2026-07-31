# Encointer Spelling Inventory

> Read-only inventory. **No code, schema, flags, or routes were changed to produce this document.**
> Produced by `grep -rni "ecoin\|encoin\|coint"` across `backend/prisma/schema.prisma`, all
> migrations, `backend/src`, `frontend/src`, `primid-social-listener`, `.env.example` files,
> `render.yaml`, all `package.json` scripts, and `.md` docs inside this repo
> (`/home/chuck62/primID_local/dev`). Renaming any of this is a **deferred decision requiring a
> migration plan** — see "Recommendation" at the bottom.

## Ground truth

The **live database schema** and `backend/prisma/schema.prisma` are the ground truth for the
column name, and they agree with each other:

```
$ psql ... SELECT column_name FROM information_schema.columns
           WHERE table_name = 'users' AND column_name ILIKE '%coin%';
 ecointer_verified
 ecointer_verified_at
```

This matches `schema.prisma`'s `@map("ecointer_verified")` / `@map("ecointer_verified_at")`
exactly. The columns were originally created as `ecoinmter_verified` / `ecoinmter_verified_at` in
the very first migration (`20260326001119_init`) and renamed to `ecointer_*` by a later migration
(`20260627000000_rename_ecointer_typo`), which has been applied to this database. **`ecointer`
(missing the second "n" relative to the real protocol name "Encointer") is therefore the spelling
in effect everywhere in the live system today** — the `ecoinmter` typo is fully historical and
exists only inside old, already-applied migration files.

Note the naming gap this leaves open, expanded on below: **the code's spelling (`ecointer`) does
not match the real-world protocol's name (`Encointer`, with an "n" after "E")** — see variant 3.

## Inventory

| Exact string | File:Line | Kind | Spelling variant |
|---|---|---|---|
| `ecoinmter_verified` | `backend/prisma/migrations/20260326001119_init/migration.sql:17` | schema column (historical, superseded) | 1 — `ecoinmter` (typo, pre-rename) |
| `ecoinmter_verified_at` | `backend/prisma/migrations/20260326001119_init/migration.sql:18` | schema column (historical, superseded) | 1 — `ecoinmter` (typo, pre-rename) |
| `ecoinmter_verified` (comment + `RENAME COLUMN` source) | `backend/prisma/migrations/20260627000000_rename_ecointer_typo/migration.sql:1-2` | migration (rename source side) | 1 — `ecoinmter` (typo, referenced only as the thing being renamed away from) |
| `ecoinmter_verified_at` (`RENAME COLUMN` source) | `backend/prisma/migrations/20260627000000_rename_ecointer_typo/migration.sql:3` | migration (rename source side) | 1 — `ecoinmter` (typo, referenced only as the thing being renamed away from) |
| `ecointer_verified` (`RENAME COLUMN` target) | `backend/prisma/migrations/20260627000000_rename_ecointer_typo/migration.sql:2` | migration (rename target side) | 2 — `ecointer` (current) |
| `ecointer_verified_at` (`RENAME COLUMN` target) | `backend/prisma/migrations/20260627000000_rename_ecointer_typo/migration.sql:3` | migration (rename target side) | 2 — `ecointer` (current) |
| `ecointerVerified` / `@map("ecointer_verified")` | `backend/prisma/schema.prisma:28` | schema column (**live, ground truth**) | 2 — `ecointer` (current) |
| `ecointerVerifiedAt` / `@map("ecointer_verified_at")` | `backend/prisma/schema.prisma:29` | schema column (**live, ground truth**) | 2 — `ecointer` (current) |
| `ECOINTER: false` | `backend/src/shared/flags/features.js:5` | feature flag | 2 — `ecointer` (current; all-caps, still missing the "n") |
| `features.ECOINTER` | `backend/src/modules/verify/verify.controller.js:366` | flag reference | 2 — `ecointer` (current) |
| `ecointerStub` (function name) | `backend/src/modules/verify/verify.controller.js:365` | route handler name | 2 — `ecointer` (current) |
| `'Ecointer verification not available in Sprint 1.'` | `backend/src/modules/verify/verify.controller.js:367` | user-facing message string | 2 — `Ecointer` (current, sentence case) |
| `ecointerStub` (export) | `backend/src/modules/verify/verify.routes.js:13` | route handler import | 2 — `ecointer` (current) |
| `router.post('/qv/ecointer', ecointerStub)` | `backend/src/modules/verify/verify.routes.js:67` | route path | 2 — `ecointer` (current) |
| `ecointerVerified`, `ecointerVerifiedAt` | `backend/src/modules/user/user.controller.js:26-27` | API response field | 2 — `ecointer` (current) |
| `'ecointerVerified', 'ecointerVerifiedAt'` | `backend/src/modules/user/user.controller.js:46` | allowed-fields list | 2 — `ecointer` (current) |
| `user.ecointerVerified` | `backend/src/shared/utils/computeTier.js:12` | tier computation input | 2 — `ecointer` (current) |
| `user.ecointerVerified` | `backend/src/modules/public/public.controller.js:18` | public profile field | 2 — `ecointer` (current) |
| `ecointerVerifiedAt` / `event: 'ecointer_verified'` | `backend/src/modules/public/public.controller.js:27` | public profile field + event name | 2 — `ecointer` (current) |
| `ecointerVerified` | `backend/tests/unit/computeTier.test.js:10,65,94` | test fixture | 2 — `ecointer` (current) |
| `(ecointer)` | `backend/tests/unit/computeTier.test.js:44` | test description | 2 — `ecointer` (current) |
| `poh + ecointer` | `backend/tests/unit/computeTier.test.js:93` | test description | 2 — `ecointer` (current) |
| `ecointerVerified`, `ecointerVerifiedAt` | `backend/tests/integration/user.test.js:26-27` | test fixture | 2 — `ecointer` (current) |
| `ecointerVerified` | `backend/tests/integration/verify.test.js:19` | test fixture | 2 — `ecointer` (current) |
| `/api/verify/qv/ecointer → 501` | `backend/tests/integration/verify.test.js:357-358` | test description + route call | 2 — `ecointer` (current) |
| `ecointer_verified: 'Ecointer in-person verified'` | `frontend/src/pages/LookupResult.jsx:15` | UI label map (key + display string) | 2 — `ecointer` (current) |
| `user.ecointerVerified`, `user.ecointerVerifiedAt` | `frontend/src/pages/Profile.jsx:205-206` | UI field read | 2 — `ecointer` (current) |
| `ecointerVerified: false` | `frontend/src/pages/__tests__/Profile.test.jsx:33` | test fixture | 2 — `ecointer` (current) |

No matches were found in: `.env.example` files (any service), `render.yaml`, any `package.json`
`scripts` block, or any `.md` file inside this repo (`README.md`, `backend/vendor/PINS.md`,
`backend/vendor/*/README.md`, `backend/vendor/*/CHANGELOG.md`). Encointer is Sprint 2+ / research
spike scope (`CLAUDE.md` §14), so no env var, deploy config, or written repo documentation
mentions it yet.

## Spelling variants found

| # | Variant | Where |
|---|---|---|
| 1 | `ecoinmter` (typo — transposed "m"/"n") | Historical only: the original `20260326001119_init` migration, and as the source side of the `20260627000000_rename_ecointer_typo` rename. **Not present in the live schema, Prisma schema, or any application code.** |
| 2 | `ecointer` (missing the "n" after "E" — current, in-effect spelling) | Every live code path: `schema.prisma`, the live DB, `features.js`, all controllers, all routes, all tests, both frontend files. This is the de facto standard spelling across the entire codebase today. |
| 3 | `Encointer` (correct spelling of the real protocol name, per `CLAUDE.md` §10's own terminology table: "Encointer — In-person human verification protocol that produces a CVA") | **Does not appear anywhere in the repository's code, schema, or config** — confirmed via a separate `encoin` (with "n") search returning zero matches outside this document. Every internal identifier is built on variant 2 (`ecointer`), not the real protocol name. |

Variant 3 is worth flagging even though it produced no code hits: the task that originally
"corrected" variant 1 → variant 2 (`58b369b`, per git log: "fix: correct ecointer typo, /qv/ route
namespace, and CORP header") fixed the `ecoinmter`/`ecointer` transposition but did not notice — or
did not choose to fix — that `ecointer` itself still doesn't match the real upstream protocol name
`Encointer`. Both `CLAUDE.md` (root) and this repo's code disagree on which of variant 2 or variant
3 is correct; `CLAUDE.md` uses `Encointer` in prose (§3, §10, §14) while the code uses `ecointer`
everywhere.

## Recommendation (not actioned — deferred)

Renaming is a deferred decision requiring a migration plan, per this task's scope. If a rename to
match the upstream protocol's actual name (`encointer`) is ever decided:

- It touches a live, applied DB column (`users.ecointer_verified`, `users.ecointer_verified_at`) —
  requires a `RENAME COLUMN` migration analogous to `20260627000000_rename_ecointer_typo`, not a
  drop/recreate.
- It touches a public API route path (`POST /api/verify/qv/ecointer`) and a public profile event
  name (`'ecointer_verified'` in `public.controller.js:27`) — both are potentially consumed by
  external integration partners per `CLAUDE.md` §9's public profile endpoint scope, so a route-path
  rename needs a deprecation/alias period, not a silent cutover.
- It touches a feature flag key (`features.ECOINTER`) — any external flag-reading tooling would
  need to move in lockstep.
- No production traffic depends on any of this yet (`ECOINTER: false`, Sprint 2+ scope, feature
  entirely stubbed/501 today) — this is the cheapest point in the project's life to do the rename,
  if it's going to happen at all.

This document does not recommend a specific decision on variant 2 vs. variant 3 — only records
that the two live authorities (`CLAUDE.md` prose vs. shipped code) disagree, so that decision isn't
made accidentally by whichever one a future contributor happens to read first.
