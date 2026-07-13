# Bill Splitter v2 — Spec

Status: draft, based on stakeholder interview 2026-07-13. Supersedes the single-shared-group model described in the current README/CLAUDE.md.

## 1. Audience & framing

Primary user: **roommates / households** — a small, stable group of people who share recurring costs (rent, utilities, groceries) over months, not a one-off trip splitter. But unlike the current app (one global shared instance, no login), this version supports **many independent households**, each with its own members and data, accessed through **per-user accounts**.

## 2. Core entities

- **User** — an account with email + password, can belong to multiple groups.
- **Group** — a household. Has a name, a set of members, and its own expenses/balances. Isolated from other groups.
- **Membership** — a user's relationship to a group: role (`owner`/`admin` or `member`), join date.
- **Expense** — an amount, currency, payer, description, date, and a split across some subset of members.
- **Settlement** — a record of a debt being paid off between two members.
- **Recurring expense** — a template that generates expenses on a schedule.

## 3. Accounts & auth

- Standard email/password signup and login.
- Session-based auth (server-issued session token/cookie).
- **Architecture note:** this requires dropping the project's current zero-dependency constraint (see `CLAUDE.md`). Plan to introduce:
  - A real password-hashing library (e.g. bcrypt) rather than hand-rolled hashing.
  - A proper database (SQLite to start is reasonable, Postgres if it needs to scale) instead of `data/expenses.json`.
  - `CLAUDE.md` should be updated once implementation starts to reflect the new dependency policy.

## 4. Groups & invites

- A user creates a group and becomes its `owner`.
- Inviting a new member: **owner/admin enters the invitee's email**, the system sends a **real invite email** (via a transactional email provider — e.g. Resend/SendGrid/SMTP; provider TBD at implementation time).
  - If the email belongs to an existing user, they get added directly (or see a pending invite to accept).
  - If not, the email contains a signup link that, on completion, joins them to the group.
- A user can belong to multiple groups and switches between them in the UI (e.g. a group switcher).

## 5. Roles & permissions

Two roles per group: `owner/admin` and `member`.

| Action | Member | Admin/Owner |
|---|---|---|
| Add own expenses | ✅ | ✅ |
| Edit/delete own expenses | ✅ | ✅ |
| Edit/delete others' expenses | ❌ | ✅ (implied by admin override — confirm at implementation) |
| Invite / remove members | ❌ | ✅ |
| Approve recurring expenses before posting | ❌ | ✅ |
| Approve settlements | N/A — see §7 | ✅ |
| Rename/delete group | ❌ | Not yet decided — see open questions |

A group can have more than one admin (not just a single owner) — confirm at implementation.

## 6. Splitting expenses

Supported split types when logging an expense:

1. **Equal split** (existing behavior) — divide evenly among selected members.
2. **Exact amounts per person** — enter each person's share directly; must sum to the total.
3. **Percentages** — assign a % to each person; must sum to 100%.

All three reuse the existing pattern of pure calculation logic in `core/` with matching tests, per the project's add-a-feature checklist.

## 7. Settling up

Two complementary mechanisms:

- **Minimal payment plan**: given current balances, compute the fewest transactions needed to zero everyone out (the "settle-up plan" already noted as a future idea in the README).
- **Mark as paid, with confirmation**: the payer marks a debt as paid; it becomes **pending** until the payee confirms receipt. Only on confirmation does the balance actually update. (Self-reported-only was explicitly rejected in favor of this two-step flow.)

## 8. Recurring expenses

- An admin defines a recurring expense (e.g. "Rent — $2000/month, split equally").
- On each cycle, the recurring expense does **not** post automatically — it requires **admin approval** before it's added to the group's expense list.
- Open question: is the schedule fixed (monthly, fixed amount) or configurable (custom frequency, editable amount per cycle)? See §10.

## 9. Multi-currency

- Expenses can be logged in different currencies.
- Cross-currency balances are converted using **live exchange rates** fetched from an external API at calculation time.
- Implementation should cache/snapshot the rate used per expense (so historical balances don't silently change if rates move later) — confirm at implementation.

## 10. Open questions (not yet resolved — need your input before implementation)

1. **Recurring cadence**: fixed monthly/fixed amount, or configurable frequency + editable amount per cycle?
2. **Notifications**: is email limited to invites only, or also used for balance reminders, pending-approval alerts, and settlement confirmations?
3. **Frontend stack**: keep growing the vanilla JS frontend to cover login/group-switching/admin views, or open the door to a framework (e.g. React) given the expanded UI surface?
4. **Existing data**: this repo currently has `data/expenses.json` from the single-shared-group model. Discard it and start fresh, or migrate it into the new model as a first group?
5. **Admin scope details**: can a group have multiple admins (not just one owner)? Can admins edit/delete other members' expenses, or only approve recurring items/settlements? Can non-owner admins rename or delete the group?
6. **Exchange rate provider & rate-snapshotting**: which API, and do we freeze the rate at expense-creation time?

## 11. Explicitly out of scope (for this version)

- Itemized/line-item receipt splitting (rejected in favor of equal/exact/percentage only).
- Anything beyond household-style groups (e.g. one-off trip mode) — not excluded long-term, but not the target for this spec.

## 12. Summary of decisions

| Question | Decision |
|---|---|
| Audience | Roommates / households |
| Multi-group | Yes, with per-user accounts |
| Split types | Equal, exact amounts, percentages |
| Settle up | Minimal payment plan + mark-as-paid |
| Zero-dependency constraint | Dropped |
| Invite mechanism | Email invite |
| Permissions | Owner/admin vs member roles |
| Recurring expenses | Yes, admin-approved per cycle |
| Multi-currency | Yes, live exchange rates |
| Email delivery | Real provider (TBD) |
| Admin powers | Add/remove members; approve recurring expenses & settlements |
| Settlement confirmation | Requires payee confirmation |
