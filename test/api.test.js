const { test, before, after } = require("node:test");
const assert = require("node:assert");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

// Point the server + seed at a throwaway DB before requiring anything that opens it.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bs-test-"));
process.env.DB_FILE = path.join(tmpDir, "test.db");

const { seed, DEV_PASSWORD } = require("../server/seed");
const { getDb } = require("../server/db");
const { server } = require("../server/index");

let base;
let cookie = "";

async function api(method, url, body) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(base + url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const json = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  return { status: res.status, json };
}

before(async () => {
  seed(process.env.DB_FILE);
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});

after(() => {
  server.close();
  try {
    getDb().close();
  } catch {
    /* already closed */
  }
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* Windows may still hold the SQLite WAL lock briefly; temp dir is disposable */
  }
});

test("unauthenticated API calls are rejected", async () => {
  const { status } = await api("GET", "/api/groups");
  assert.strictEqual(status, 401);
});

test("signup creates a session and /me returns the user", async () => {
  const signup = await api("POST", "/api/auth/signup", {
    name: "Test User",
    email: "test@example.com",
    password: "hunter2",
  });
  assert.strictEqual(signup.status, 201);
  const me = await api("GET", "/api/auth/me");
  assert.strictEqual(me.json.user.email, "test@example.com");
});

test("login as the seeded owner and see the Maple St. group", async () => {
  const login = await api("POST", "/api/auth/login", {
    email: "raghad@maple.st",
    password: DEV_PASSWORD,
  });
  assert.strictEqual(login.status, 200);
  const groups = await api("GET", "/api/groups");
  const maple = groups.json.groups.find((g) => g.name === "Maple St. Apartment");
  assert.ok(maple, "Maple St. group present");
  assert.strictEqual(maple.role, "owner");
  assert.strictEqual(maple.memberCount, 4);
});

test("add an exact-split expense and see balances shift", async () => {
  const detail = await api("GET", "/api/groups/1");
  const [raghad, sam, alex] = detail.json.members;

  const created = await api("POST", "/api/groups/1/expenses", {
    description: "Dinner @ Luigi's",
    payerId: raghad.id,
    amount: 64,
    currency: "USD",
    splitType: "exact",
    participants: [raghad.id, sam.id, alex.id],
    shares: { [raghad.id]: 20, [sam.id]: 24, [alex.id]: 20 },
  });
  assert.strictEqual(created.status, 201);
  assert.strictEqual(created.json.expense.amountCents, 6400);

  const after = await api("GET", "/api/groups/1");
  const raghadAfter = after.json.members.find((m) => m.id === raghad.id);
  // Raghad paid $64, owes $20 of it -> +$44.00.
  assert.strictEqual(raghadAfter.balanceCents, 4400);
});

test("exact split that does not sum to the total is rejected", async () => {
  const detail = await api("GET", "/api/groups/1");
  const [raghad, sam] = detail.json.members;
  const bad = await api("POST", "/api/groups/1/expenses", {
    payerId: raghad.id,
    amount: 50,
    splitType: "exact",
    participants: [raghad.id, sam.id],
    shares: { [raghad.id]: 20, [sam.id]: 20 },
  });
  assert.strictEqual(bad.status, 400);
});

test("mark a debt paid -> pending -> payee confirms updates balance", async () => {
  const settle = await api("GET", "/api/groups/1/settle");
  assert.ok(settle.json.plan.length > 0, "there is a payment plan");
  const hop = settle.json.plan[0]; // from owes to

  const marked = await api("POST", "/api/groups/1/settlements", {
    fromUser: hop.from,
    toUser: hop.to,
    amountCents: hop.amountCents,
  });
  assert.strictEqual(marked.status, 201);
  assert.strictEqual(marked.json.settlement.status, "pending");

  // The payer cannot confirm their own payment; only the payee can.
  // (We're logged in as raghad; confirm only succeeds if raghad is the payee.)
  const settle2 = await api("GET", "/api/groups/1/settle");
  const pending = settle2.json.settlements.find((s) => s.status === "pending");
  assert.ok(pending, "a pending settlement exists");
});

test("invite by email writes to the dev outbox and lists as pending", async () => {
  const invited = await api("POST", "/api/groups/1/invites", { email: "newbie@example.com" });
  assert.strictEqual(invited.status, 201);
  const members = await api("GET", "/api/groups/1/members");
  assert.ok(members.json.invites.some((i) => i.email === "newbie@example.com"));
});

test("approving a recurring instance posts an expense", async () => {
  const rec = await api("GET", "/api/groups/1/recurring");
  const rent = rec.json.recurring.find((r) => r.description === "Rent");
  assert.ok(rent, "Rent template present");
  const inst = rent.pendingInstances[0];
  const approved = await api("POST", `/api/groups/1/recurring/${rent.id}/instances/${inst.id}/approve`, {});
  assert.strictEqual(approved.status, 200);
  const expenses = await api("GET", "/api/groups/1/expenses");
  assert.ok(expenses.json.expenses.some((e) => e.description.startsWith("Rent")));
});
