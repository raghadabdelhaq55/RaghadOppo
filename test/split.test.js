const { test } = require("node:test");
const assert = require("node:assert");
const {
  splitAmount,
  settleUp,
  toCents,
  fromCents,
  splitEqualCents,
  splitPercentCents,
  validateExactCents,
  validatePercents,
  resolveShares,
} = require("../core/split");

test("splitAmount divides evenly when it can", () => {
  assert.deepStrictEqual(splitAmount(10, 2), [5, 5]);
});

// ⚠️ This test currently FAILS on purpose — it is the bug described in issue #1.
// The capstone demo fixes splitAmount so the shares always sum to the total.
test("splitAmount shares always sum back to the original total", () => {
  const shares = splitAmount(10, 3);
  const total = shares.reduce((a, b) => a + b, 0);
  assert.strictEqual(Math.round(total * 100) / 100, 10);
});

test("settleUp: the payer is owed by the others (even split)", () => {
  const balances = settleUp(
    ["Sam", "Alex"],
    [{ id: 1, description: "Lunch", payer: "Sam", amount: 20, participants: ["Sam", "Alex"] }]
  );
  assert.strictEqual(balances.Sam, 10);
  assert.strictEqual(balances.Alex, -10);
});

test("settleUp: balances net to zero with even splits", () => {
  const balances = settleUp(
    ["Sam", "Alex", "Jordan"],
    [{ id: 1, description: "Pizza", payer: "Sam", amount: 30, participants: ["Sam", "Alex", "Jordan"] }]
  );
  const sum = Object.values(balances).reduce((a, b) => a + b, 0);
  assert.strictEqual(Math.round(sum * 100) / 100, 0);
});

// --- v2: cents helpers ------------------------------------------------------

test("toCents/fromCents round-trip without float drift", () => {
  assert.strictEqual(toCents(64), 6400);
  assert.strictEqual(toCents(45.1), 4510);
  assert.strictEqual(fromCents(6400), 64);
  assert.strictEqual(fromCents(333), 3.33);
});

// --- v2: equal split (cents) ------------------------------------------------

test("splitEqualCents hands out leftover cents largest-remainder", () => {
  assert.deepStrictEqual(splitEqualCents(1000, 3), [334, 333, 333]);
  assert.deepStrictEqual(splitEqualCents(1000, 2), [500, 500]);
  assert.deepStrictEqual(splitEqualCents(6400, 3), [2134, 2133, 2133]);
});

test("splitEqualCents shares always sum to the total", () => {
  for (const [total, n] of [
    [1000, 3],
    [6400, 3],
    [99, 7],
    [1, 4],
  ]) {
    const sum = splitEqualCents(total, n).reduce((a, b) => a + b, 0);
    assert.strictEqual(sum, total, `${total}/${n}`);
  }
});

test("splitEqualCents rejects non-positive n", () => {
  assert.throws(() => splitEqualCents(1000, 0));
  assert.throws(() => splitEqualCents(1000, -2));
});

// --- v2: percentage split ---------------------------------------------------

test("splitPercentCents distributes by percent and sums to total", () => {
  const shares = splitPercentCents(10000, [50, 25, 25]);
  assert.deepStrictEqual(shares, [5000, 2500, 2500]);
  assert.strictEqual(
    shares.reduce((a, b) => a + b, 0),
    10000
  );
});

test("splitPercentCents handles thirds with largest-remainder rounding", () => {
  const shares = splitPercentCents(10000, [33.34, 33.33, 33.33]);
  assert.strictEqual(
    shares.reduce((a, b) => a + b, 0),
    10000
  );
  assert.strictEqual(shares[0], 3334);
});

// --- v2: validity helpers (used by the wizard's live line) ------------------

test("validateExactCents flags shares that miss the total", () => {
  assert.deepStrictEqual(validateExactCents(6400, [2000, 2400, 2000]), {
    ok: true,
    sumCents: 6400,
    diffCents: 0,
  });
  const off = validateExactCents(6400, [2000, 2400, 1900]);
  assert.strictEqual(off.ok, false);
  assert.strictEqual(off.diffCents, -100);
});

test("validatePercents requires ~100%", () => {
  assert.strictEqual(validatePercents([50, 25, 25]).ok, true);
  assert.strictEqual(validatePercents([50, 25, 20]).ok, false);
  assert.strictEqual(validatePercents([33.34, 33.33, 33.33]).ok, true);
});

// --- v2: resolveShares (what the API calls) ---------------------------------

test("resolveShares equal aligns cents to participants", () => {
  const { shares } = resolveShares(6400, "equal", ["a", "b", "c"]);
  assert.deepStrictEqual(shares, [
    { userId: "a", shareCents: 2134 },
    { userId: "b", shareCents: 2133 },
    { userId: "c", shareCents: 2133 },
  ]);
});

test("resolveShares exact accepts summing shares, rejects otherwise", () => {
  const { shares } = resolveShares(6400, "exact", ["a", "b", "c"], {
    shares: { a: 20, b: 24, c: 20 },
  });
  assert.deepStrictEqual(shares, [
    { userId: "a", shareCents: 2000 },
    { userId: "b", shareCents: 2400 },
    { userId: "c", shareCents: 2000 },
  ]);
  assert.throws(() => resolveShares(6400, "exact", ["a", "b"], { shares: { a: 20, b: 20 } }));
});

test("resolveShares percent resolves to summing cents, rejects != 100", () => {
  const { shares } = resolveShares(10000, "percent", ["a", "b"], {
    percents: { a: 60, b: 40 },
  });
  assert.deepStrictEqual(shares, [
    { userId: "a", shareCents: 6000 },
    { userId: "b", shareCents: 4000 },
  ]);
  assert.throws(() => resolveShares(10000, "percent", ["a", "b"], { percents: { a: 60, b: 30 } }));
});

test("resolveShares rejects unknown split type", () => {
  assert.throws(() => resolveShares(100, "weighted", ["a"]));
});
