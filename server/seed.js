// Seed / migration: build a fresh app.db and import the v1 data/expenses.json
// into a first group, "Maple St. Apartment" (SPEC §10 Q4 — migrate).
//
// Creates the owner account (Raghad) with a known dev password, promotes the
// imported people to members (Jordan as admin to exercise roles), migrates the
// v1 expense, seeds a pending invite, and adds a recurring Rent template so the
// Members screen has something to approve. Run with `npm run seed`.

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { createDb, DEFAULT_FILE } = require("./db");
const { makeRepo } = require("./repo");
const { toCents } = require("../core/split");

const V1_DATA = path.join(__dirname, "..", "data", "expenses.json");
const DEV_PASSWORD = "password";

function loadV1() {
  try {
    return JSON.parse(fs.readFileSync(V1_DATA, "utf8"));
  } catch {
    return { people: [], expenses: [] };
  }
}

function seed(file = process.env.DB_FILE || DEFAULT_FILE) {
  // Start clean so re-seeding is deterministic.
  if (file !== ":memory:") {
    for (const suffix of ["", "-wal", "-shm"]) {
      const f = file + suffix;
      if (fs.existsSync(f)) fs.rmSync(f);
    }
  }
  const db = createDb(file);
  const repo = makeRepo(db);
  const v1 = loadV1();

  const hash = bcrypt.hashSync(DEV_PASSWORD, 10);
  const owner = repo.createUser({ name: "Raghad Abdelhaq", email: "raghad@maple.st", passwordHash: hash });
  const group = repo.createGroup({ name: "Maple St. Apartment", baseCurrency: "USD", ownerId: owner.id });

  // Turn each v1 person name into a passwordless "shadow" member.
  const roles = { Jordan: "admin" }; // exercise multiple admins (SPEC §5)
  const byName = { Raghad: owner };
  for (const name of v1.people) {
    const email = `${name.toLowerCase()}@maple.st`;
    const user = repo.getUserByEmail(email) || repo.createUser({ name, email });
    repo.addMember(group.id, user.id, roles[name] || "member");
    byName[name] = user;
  }

  // Migrate v1 expenses (all equal-split) into the group.
  for (const e of v1.expenses) {
    const payer = byName[e.payer];
    const participants = e.participants.map((n) => byName[n].id).filter(Boolean);
    if (!payer || participants.length === 0) continue;
    repo.createExpense({
      groupId: group.id,
      description: e.description || "(imported)",
      payerId: payer.id,
      amountCents: toCents(e.amount),
      currency: "USD",
      rateToBase: 1,
      splitType: "equal",
      participants,
      date: "2026-07-01",
      createdBy: owner.id,
    });
  }

  // A pending invite (matches the Members mockup).
  repo.createInvite(group.id, "casey@example.com", owner.id);

  // A recurring Rent template -> seeds one pending instance to approve (SPEC §8).
  const everyone = repo.listMembers(group.id).map((m) => m.id);
  repo.createRecurring({
    groupId: group.id,
    description: "Rent",
    amountCents: toCents(2000),
    currency: "USD",
    cadence: "monthly",
    splitType: "equal",
    config: { participants: everyone },
    payerId: byName.Jordan ? byName.Jordan.id : owner.id,
    nextDue: "2026-08-01",
  });

  db.close();
  return { ownerEmail: owner.email, groupId: group.id, members: everyone.length };
}

if (require.main === module) {
  const result = seed();
  console.log(`Seeded "${"Maple St. Apartment"}" (group ${result.groupId}, ${result.members} members).`);
  console.log(`Sign in as ${result.ownerEmail} / ${DEV_PASSWORD}`);
}

module.exports = { seed, DEV_PASSWORD };
