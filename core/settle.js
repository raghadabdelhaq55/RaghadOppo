// Pure settle-up logic: turn a set of expenses (with pre-resolved shares) and
// confirmed settlements into net balances, then into the fewest payments that
// bring everyone to zero (SPEC §7). Integer cents throughout. No I/O.

/**
 * Net balance per user, in cents.
 *   positive -> they are owed money
 *   negative -> they owe money
 *
 * @param {Array<{payerId, shares: Array<{userId, shareCents}>}>} expenses
 * @param {Array<{fromUser, toUser, amountCents}>} settlements  confirmed only
 * @param {Array<string|number>} [members]  seed ids so everyone appears at 0
 */
function computeBalances(expenses, settlements = [], members = []) {
  const bal = {};
  const bump = (id, cents) => {
    bal[id] = (bal[id] || 0) + cents;
  };
  for (const id of members) bump(id, 0);

  for (const e of expenses) {
    let total = 0;
    for (const s of e.shares) {
      bump(s.userId, -Math.round(s.shareCents));
      total += Math.round(s.shareCents);
    }
    bump(e.payerId, total);
  }

  // A confirmed payment from debtor -> creditor cancels that much debt:
  // the debtor's (negative) balance rises toward zero, the creditor's falls.
  for (const p of settlements) {
    bump(p.fromUser, Math.round(p.amountCents));
    bump(p.toUser, -Math.round(p.amountCents));
  }
  return bal;
}

/**
 * Fewest payments to zero out balances (greedy largest-debtor/largest-creditor
 * matching — the standard "minimal payment plan"). Produces at most n-1
 * transactions. Input is a { id: cents } map (should net to ~0); ignores users
 * already settled.
 *
 * @returns {Array<{from, to, amountCents}>}
 */
function minimalTransactions(balances) {
  const debtors = []; // owe money (negative)
  const creditors = []; // are owed money (positive)
  for (const [id, cents] of Object.entries(balances)) {
    const c = Math.round(cents);
    if (c < 0) debtors.push({ id, amount: -c });
    else if (c > 0) creditors.push({ id, amount: c });
  }
  // Largest first so we clear big balances in as few hops as possible.
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const plan = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    if (pay > 0) {
      plan.push({ from: debtors[i].id, to: creditors[j].id, amountCents: pay });
    }
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }
  return plan;
}

module.exports = { computeBalances, minimalTransactions };
