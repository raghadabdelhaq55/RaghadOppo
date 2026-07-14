const { test } = require("node:test");
const assert = require("node:assert");
const { computeBalances, minimalTransactions } = require("../core/settle");

test("computeBalances: payer is owed by the others", () => {
  const bal = computeBalances([
    {
      payerId: "Sam",
      shares: [
        { userId: "Sam", shareCents: 1000 },
        { userId: "Alex", shareCents: 1000 },
      ],
    },
  ]);
  assert.strictEqual(bal.Sam, 1000);
  assert.strictEqual(bal.Alex, -1000);
});

test("computeBalances: seeds members at zero and nets to zero", () => {
  const bal = computeBalances(
    [
      {
        payerId: "Sam",
        shares: [
          { userId: "Sam", shareCents: 1000 },
          { userId: "Alex", shareCents: 1000 },
          { userId: "Jordan", shareCents: 1000 },
        ],
      },
    ],
    [],
    ["Sam", "Alex", "Jordan", "Casey"]
  );
  assert.strictEqual(bal.Casey, 0);
  const sum = Object.values(bal).reduce((a, b) => a + b, 0);
  assert.strictEqual(sum, 0);
});

test("computeBalances: a confirmed settlement pays down debt", () => {
  const expenses = [
    {
      payerId: "Sam",
      shares: [
        { userId: "Sam", shareCents: 1000 },
        { userId: "Alex", shareCents: 1000 },
      ],
    },
  ];
  // Alex owes Sam 1000; after Alex pays Sam 1000 everyone is even.
  const bal = computeBalances(expenses, [{ fromUser: "Alex", toUser: "Sam", amountCents: 1000 }]);
  assert.strictEqual(bal.Sam, 0);
  assert.strictEqual(bal.Alex, 0);
});

test("minimalTransactions reproduces the Maple St. 3-payment plan", () => {
  // Mockup balances (cents): You +2450, Sam -4250, Jordan +4800, Alex -3000.
  const plan = minimalTransactions({ You: 2450, Sam: -4250, Jordan: 4800, Alex: -3000 });
  assert.deepStrictEqual(plan, [
    { from: "Sam", to: "Jordan", amountCents: 4250 },
    { from: "Alex", to: "Jordan", amountCents: 550 },
    { from: "Alex", to: "You", amountCents: 2450 },
  ]);
});

test("minimalTransactions: n people need at most n-1 payments", () => {
  const plan = minimalTransactions({ a: -300, b: -300, c: -300, d: 900 });
  assert.ok(plan.length <= 3);
  const paid = plan.reduce((a, p) => a + p.amountCents, 0);
  assert.strictEqual(paid, 900);
});

test("minimalTransactions: everyone settled -> no payments", () => {
  assert.deepStrictEqual(minimalTransactions({ a: 0, b: 0 }), []);
});
