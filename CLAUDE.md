# Bill Splitter v2 — project conventions for Claude

## What this is
A full-stack household expense splitter (the "Calm" design direction from `phase-1-planning/`).
v2 supports per-user accounts, multiple groups, split types, settle-up with confirmation, recurring
expenses, and multi-currency — per `SPEC.md`. Parts:

- `core/` — pure, framework-agnostic calculation logic (`split.js`, `settle.js`). No I/O, no DOM.
  Covered by the tests in `test/`. Used by **both** the server (`require`) and the client (bundled by
  Vite) so split math has exactly one source of truth.
- `server/` — a zero-framework Node HTTP JSON API on top of SQLite. `index.js` (http + router +
  static serving), `db.js` + `schema.sql` (persistence), `auth.js` (sessions), `routes/*`, and
  `services/*` (pluggable email + FX adapters). Also serves the built client.
- `client/` — a React + Vite single-page app implementing the five Calm screens.
- `data/` — SQLite database (`app.db`, gitignored) and the dev email outbox (`outbox.log`).

## Dependency policy (changed in v2)
v1 was zero-dependency; **v2 intentionally drops that** (see `SPEC.md` §3). Approved deps:
`better-sqlite3` (DB), `bcryptjs` (password hashing), `react`/`react-dom`/`react-router-dom` +
`vite` (frontend). Keep the set small and justified — prefer the standard library and `core/` logic
over adding a package. Email/FX are behind adapter interfaces (`server/services/`) so real providers
drop in via env vars without new code paths in dev.

## Git conventions
- Branch naming: `feat/short-description`, `fix/issue-number-description`
- Commits: Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`)
- Never commit directly to `main`; always use a feature branch
- Run `npm test`, `npm run lint`, `npm run format:check` before every commit; don't commit failing tests

## How we add a feature here
1. Put pure logic in `core/` and cover it with a test in `test/`.
2. Wire it into the API in `server/` (a route + repo query) with authorization checks.
3. Wire it into the UI in `client/` (a page/component using `src/api.js`).
4. Update the README if user-facing behavior changes.

## Run / test
- `npm run dev` → Vite dev server (client) + API on :3000 with `/api` proxied. Use this for development.
- `npm run seed` → (re)create `data/app.db` and seed the "Maple St. Apartment" group.
- `npm run build` → build the client into `client/dist`.
- `npm start` → run the API server serving the built client at http://localhost:3000.
- `npm test` → unit + integration tests (Node's built-in runner).
