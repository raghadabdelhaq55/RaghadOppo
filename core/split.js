// Pure calculation logic for Bill Splitter.
// No I/O, no DOM — this is what the tests in /test cover.

/**
 * Split a total amount into `n` shares (in dollars) that always sum back to
 * the original total. When the amount doesn't divide evenly, the leftover
 * cents are handed out one per share (largest-remainder method), so e.g.
 * splitAmount(10, 3) returns [3.34, 3.33, 3.33] which sums to exactly 10.00.
 */
function splitAmount(total, n) {
  if (n <= 0) throw new Error("n must be a positive number");

  // Work in whole cents so we never lose a fraction of a penny to
  // floating-point rounding. `base` is the floor share each person gets;
  // `remainder` is the leftover cents that don't divide evenly (0..n-1).
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;

  // Every share gets `base` cents; the first `remainder` shares each get one
  // extra cent. That hands out exactly `remainder` leftover cents, so the
  // shares sum back to `totalCents` (and therefore to the original total).
  const shares = [];
  for (let i = 0; i < n; i++) {
    const cents = base + (i < remainder ? 1 : 0);
    shares.push(cents / 100);
  }

  return shares;
}

/**
 * Given a list of people and expenses, return each person's net balance
 * (what they paid minus what they owe), in dollars.
 *   positive  -> they are owed money
 *   negative  -> they owe money
 *
 * Each expense is: { payer, amount, participants: [names] } and is split
 * equally among its participants.
 */
function settleUp(people, expenses) {
  const balance = {};
  for (const p of people) balance[p] = 0;

  for (const e of expenses) {
    const shares = splitAmount(e.amount, e.participants.length);
    e.participants.forEach((name, i) => {
      if (!(name in balance)) balance[name] = 0;
      balance[name] -= shares[i];
    });
    if (!(e.payer in balance)) balance[e.payer] = 0;
    balance[e.payer] += e.amount;
  }

  for (const name of Object.keys(balance)) {
    balance[name] = Math.round(balance[name] * 100) / 100;
  }
  return balance;
}

module.exports = { splitAmount, settleUp };
