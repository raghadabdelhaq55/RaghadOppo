// Pure calculation logic for Bill Splitter — splitting a total among people.
// No I/O, no DOM. Shared by the server (require) and the client (bundled by Vite),
// and covered by the tests in /test.
//
// Money is handled in integer **cents** wherever exactness matters, so we never
// lose a fraction of a penny to floating-point rounding. The dollar-facing
// helpers (`splitAmount`, `settleUp`) are kept for backwards compatibility with
// v1 and delegate to the cents-based core.

function toCents(dollars) {
  return Math.round(Number(dollars) * 100);
}

function fromCents(cents) {
  return Math.round(cents) / 100;
}

/**
 * Split `totalCents` into `n` integer-cent shares that always sum back to
 * `totalCents`. Leftover cents are handed out one per share
 * (largest-remainder method): splitEqualCents(1000, 3) -> [334, 333, 333].
 */
function splitEqualCents(totalCents, n) {
  if (!Number.isInteger(n) || n <= 0) throw new Error("n must be a positive integer");
  const total = Math.round(totalCents);
  const base = Math.trunc(total / n);
  let remainder = total - base * n; // can be negative for negative totals
  const step = remainder >= 0 ? 1 : -1;
  remainder = Math.abs(remainder);
  const shares = [];
  for (let i = 0; i < n; i++) {
    shares.push(base + (i < remainder ? step : 0));
  }
  return shares;
}

/**
 * Split `totalCents` across the given `percents` (one per person, summing to
 * ~100). Uses largest-remainder rounding so the integer-cent shares sum back to
 * exactly `totalCents`.
 */
function splitPercentCents(totalCents, percents) {
  if (!Array.isArray(percents) || percents.length === 0) {
    throw new Error("percents must be a non-empty array");
  }
  const total = Math.round(totalCents);
  const raw = percents.map((p) => (total * Number(p)) / 100);
  const floors = raw.map((r) => Math.floor(r));
  const allocated = floors.reduce((a, b) => a + b, 0);
  let leftover = total - allocated;
  // Hand the leftover cents to the largest fractional parts first.
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  const shares = floors.slice();
  for (let k = 0; k < order.length && leftover > 0; k++) {
    shares[order[k].i] += 1;
    leftover -= 1;
  }
  return shares;
}

/**
 * Live validity for a set of exact per-person amounts (in cents) against a
 * total (cents). Returns { ok, sumCents, diffCents }.
 */
function validateExactCents(totalCents, sharesCents) {
  const sumCents = sharesCents.reduce((a, b) => a + Math.round(b), 0);
  const diffCents = sumCents - Math.round(totalCents);
  return { ok: diffCents === 0, sumCents, diffCents };
}

/**
 * Live validity for a set of percentages. Sums must equal 100 (within a small
 * tolerance for user-entered decimals). Returns { ok, sumPct }.
 */
function validatePercents(percents, tolerance = 0.01) {
  const sumPct = percents.reduce((a, b) => a + Number(b || 0), 0);
  return { ok: Math.abs(sumPct - 100) <= tolerance, sumPct };
}

/**
 * Resolve a split request into integer-cent shares aligned to `participants`.
 *
 *   type "equal"   -> { participants: [id, ...] }
 *   type "exact"   -> { shares: { id: dollars } }   (must sum to total)
 *   type "percent" -> { percents: { id: number } }  (must sum to 100)
 *
 * Returns { shares: [{ userId, shareCents }], type }. Throws on invalid input so
 * the API can reject it; the client validates first with the helpers above.
 */
function resolveShares(totalCents, type, participants, config = {}) {
  if (!Array.isArray(participants) || participants.length === 0) {
    throw new Error("participants must be a non-empty array");
  }
  const total = Math.round(totalCents);

  if (type === "equal") {
    const cents = splitEqualCents(total, participants.length);
    return {
      type,
      shares: participants.map((userId, i) => ({ userId, shareCents: cents[i] })),
    };
  }

  if (type === "exact") {
    const amounts = participants.map((id) => toCents(config.shares?.[id] ?? 0));
    const { ok, diffCents } = validateExactCents(total, amounts);
    if (!ok) throw new Error(`exact shares must sum to the total (off by ${diffCents} cents)`);
    return {
      type,
      shares: participants.map((userId, i) => ({ userId, shareCents: amounts[i] })),
    };
  }

  if (type === "percent") {
    const percents = participants.map((id) => Number(config.percents?.[id] ?? 0));
    const { ok, sumPct } = validatePercents(percents);
    if (!ok) throw new Error(`percentages must sum to 100 (got ${sumPct})`);
    const cents = splitPercentCents(total, percents);
    return {
      type,
      shares: participants.map((userId, i) => ({ userId, shareCents: cents[i] })),
    };
  }

  throw new Error(`unknown split type: ${type}`);
}

// ---------------------------------------------------------------------------
// v1 compatibility (dollar-based). Retained so the original tests still pass.
// ---------------------------------------------------------------------------

/**
 * Split a total (dollars) into `n` shares (dollars) that sum back to the total.
 * splitAmount(10, 3) -> [3.34, 3.33, 3.33].
 */
function splitAmount(total, n) {
  return splitEqualCents(toCents(total), n).map(fromCents);
}

/**
 * v1 equal-split balances (dollars). Each expense is
 * { payer, amount, participants: [names] } split equally.
 */
function settleUp(people, expenses) {
  const balance = {};
  for (const p of people) balance[p] = 0;
  for (const e of expenses) {
    const shares = splitEqualCents(toCents(e.amount), e.participants.length);
    e.participants.forEach((name, i) => {
      balance[name] = (balance[name] || 0) - shares[i];
    });
    balance[e.payer] = (balance[e.payer] || 0) + toCents(e.amount);
  }
  for (const name of Object.keys(balance)) balance[name] = fromCents(balance[name]);
  return balance;
}

module.exports = {
  toCents,
  fromCents,
  splitEqualCents,
  splitPercentCents,
  validateExactCents,
  validatePercents,
  resolveShares,
  splitAmount,
  settleUp,
};
