# 💸 Bill Splitter v2 — "Calm"

A full-stack household expense splitter: personal accounts, multiple groups, three
split types (equal / exact / percentage), a fewest-payments settle-up plan with
payee confirmation, admin-approved recurring expenses, and multi-currency with
snapshotted FX rates. Built to the **Calm** design direction from
`phase-1-planning/` and the requirements in `SPEC.md`.

## Quick start

```bash
npm install
npm run seed     # create data/app.db and the "Maple St. Apartment" demo group
npm run dev      # Vite client (http://localhost:5173) + API (http://localhost:3000)
```

Open **http://localhost:5173** and sign in with the seeded owner account:

> **raghad@maple.st** / **password**

The seeded people (Sam, Alex, Jordan) are passwordless until they claim their
account — sign up with their `@maple.st` email to set a password and log in.

### Production-style run

```bash
npm run build    # bundle the client into client/dist
npm start        # API server serves the built client at http://localhost:3000
```

## Architecture

| Part | Location |
|---|---|
| Pure calc logic (tested core, shared by server + client) | `core/split.js`, `core/settle.js` |
| Zero-framework Node HTTP JSON API on SQLite | `server/` |
| DB schema + connection | `server/schema.sql`, `server/db.js` |
| Sessions & password hashing (bcryptjs) | `server/auth.js` |
| Routes | `server/routes/*.js` |
| Pluggable email + FX adapters | `server/services/{email,fx}.js` |
| Seed / v1 migration | `server/seed.js` |
| React + Vite client (the Calm UI) | `client/` |
| SQLite database + dev email outbox (gitignored) | `data/app.db`, `data/outbox.log` |
| Tests (unit + integration) | `test/` |

`core/` is the single source of truth for split math: the server validates
expenses with it and the client's add-expense wizard uses the same functions for
its live "shares sum to $64.00 ✓ / must equal 100%" validation.

## API (all JSON under `/api`, session-cookie auth except the auth routes)

- **Auth** — `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- **Groups** — `GET /groups`, `POST /groups`, `GET/PATCH/DELETE /groups/:id`
- **Members/invites** — `GET /groups/:id/members`, `POST /groups/:id/invites`,
  `POST /invites/accept`, `PATCH|DELETE /groups/:id/members/:uid`
- **Expenses** — `GET|POST /groups/:id/expenses`, `DELETE /groups/:id/expenses/:eid`
- **Settle up** — `GET /groups/:id/settle`, `POST /groups/:id/settlements`,
  `POST …/settlements/:sid/{confirm,dispute}`
- **Recurring** — `GET|POST /groups/:id/recurring`,
  `POST …/recurring/:rid/instances/:iid/{approve,skip}`
- **FX** — `GET /fx?from=EUR&to=USD`

## External services (offline in dev)

Email (invites) and FX rates sit behind adapter interfaces in `server/services/`.
In dev they need no secrets: invites are written to `data/outbox.log`, and FX uses
a bundled rate snapshot. Set `RESEND_API_KEY` (email) or `FX_API_KEY` (live rates)
to switch to real providers.

## Test it

```bash
npm test            # core unit tests + server integration tests
npm run lint
npm run format:check
```

## Requirements

Node.js 18+ (Node 24 recommended). See `CLAUDE.md` for project conventions.
