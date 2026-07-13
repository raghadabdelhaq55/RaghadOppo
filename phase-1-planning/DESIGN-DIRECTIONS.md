# Bill Splitter v2 — Design Directions (Phase 1)

> **Decision:** the **Calm** direction was chosen. The other three explored directions (Ledger, Stream, Dashboard) have
> been removed from `phase-1-planning/designs/`; only `d-calm/` remains. The comparison below is kept as a decision
> record explaining what was weighed.

Four design directions were explored from `SPEC.md`. Each was a set of static HTML mockups under
`phase-1-planning/designs/<dir>/`, showing the **same five screens** with the **same household data** so they could be
compared on design rather than content.

Open the chosen direction: **`phase-1-planning/designs/index.html`** → `d-calm/`.

## The five screens (same in every direction)

| Screen | What it exercises from the spec |
|---|---|
| **Auth** | §3 accounts / email + password login (new in v2) |
| **Dashboard** | §4 multi-group switcher, balances "who owes whom", activity |
| **Add expense** | §6 equal / exact / percentage splits + §9 multi-currency |
| **Settle up** | §7 minimal payment plan **and** mark-as-paid → pending → payee confirmation |
| **Members** | §4 invite-by-email, §5 roles/permissions, §8 recurring expense awaiting admin approval |

Shared scenario: the "Maple St. Apartment" group — Raghad (you, owner), Sam, Jordan, Alex — with a net-zero balance set
(You +$24.50, Sam −$42.50, Jordan +$48.00, Alex −$30.00) and a clean 3-transaction minimal settle-up plan.

## The four directions at a glance

| | A · Ledger | B · Stream | C · Dashboard | D · Calm |
|---|---|---|---|---|
| **Metaphor** | Accounting ledger | Social activity feed | Fintech control panel | Calm, guided assistant |
| **Primary device** | Desktop | Mobile (phone frame) | Desktop | Mobile + desktop |
| **Layout** | Fixed sidebar + ruled tables | Bottom tabs + card stream + FAB | Top bar + card/KPI grid | Single centered column |
| **Type** | Tight grotesque + monospace figures | Rounded humanist sans | Clean modern sans | Quiet serif + neutral sans |
| **Accent** | Ink-blue on warm paper | Coral (+ teal for confirms) | Fintech green (+ indigo) | Muted sage |
| **Optimizes for** | Density, precision | Approachability, speed | At-a-glance clarity, polish | Low anxiety, clarity |
| **Trades away** | Warmth, mobile fit | Overview, big-screen density | Simplicity, build cost | Power-user density |
| **Best if the real users are…** | Long-term roommates reconciling months of costs | Housemates logging small things constantly | People who want a financial snapshot | People who find money apps stressful |

## How each direction handles the two hardest UI problems

**Split types (§6 — equal / exact / percentage).** All four show a mode selector with a live "shares sum to $64.00 ✓ /
must equal 100%" validity line (this also honors the existing rounding rule from `core/split.js` and the cents-distribution
fix in commit `ad0e9ad`). Ledger and Dashboard show it as an inline per-person table; Calm turns it into a dedicated wizard
step; Stream keeps it compact for a phone.

**Settle up (§7 — two mechanisms).** Every direction separates (a) the computed **minimal payment plan** from (b) the
**mark-as-paid → pending → payee-confirms** flow, because the spec makes confirmation load-bearing (self-report was
rejected). Stream expresses the confirmation as chat bubbles; the others use explicit pending pills with Confirm/Dispute.

## Bearing on the spec's open questions (§10)

- **Q3 — Frontend stack.** This is the decision these mockups most directly inform. B (Stream) and C (Dashboard) have
  enough stateful UI (group switching, live split validation, pending/confirm flows, KPI/sparkline) that a framework like
  React starts to pay off. A (Ledger) and D (Calm) are more static and could stretch the vanilla-JS frontend further.
- **Q1 — Recurring cadence.** All four render the "Rent — August awaiting admin approval" card; the Members screen is where
  an editable-per-cycle amount vs. fixed-monthly choice would live. C and A have the most room to show a schedule/history.
- **Q2 — Notifications.** The pending settlement and pending invite states imply notification surfaces; Stream's feed is the
  most natural home for balance reminders and approval alerts if notifications expand beyond invites.
- **Q5 — Admin scope.** The Members screen encodes Owner/Admin/Member roles and gates invite/remove/approve to admins;
  choosing a direction doesn't resolve the policy questions but gives them a concrete place to appear.

## Architecture notes carried over from the spec (§3)

Independent of visual direction, v2 drops the zero-dependency constraint: real password hashing (bcrypt), a database
(SQLite → Postgres) instead of `data/expenses.json`, session auth, an email provider for invites, and a live FX-rate
source with per-expense rate snapshotting. `CLAUDE.md` should be updated once implementation starts. The mockups assume
these exist but don't prescribe the providers (still TBD per §10 Q6).

## Decision: D · Calm

**Calm** was chosen and the other three directions removed. It commits to a quiet, low-anxiety experience — a single
centered column, restrained sage accent, and a one-thing-at-a-time wizard for adding expenses, which directly de-risks the
split-type step (the most error-prone moment in the app). Its remaining mockups live in `phase-1-planning/designs/d-calm/`.

Worth carrying into implementation: because Calm's screens are relatively static (no KPI grid or live charts), the spec's
§10 Q3 question leans toward stretching the existing vanilla-JS frontend further rather than immediately adopting a
framework — the main stateful surfaces are the add-expense wizard and the settle-up confirm flow.
