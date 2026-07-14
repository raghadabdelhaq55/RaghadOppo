// Data-access layer. `makeRepo(db)` returns an object of query helpers over a
// better-sqlite3 handle, so routes stay thin and tests can pass an in-memory DB.
// All money is integer cents; expense_shares are stored in the group's base
// currency (FX snapshotted at creation time, SPEC §9).

const crypto = require("crypto");
const { resolveShares } = require("../core/split");
const { computeBalances, minimalTransactions } = require("../core/settle");

const now = () => new Date().toISOString();
const token = () => crypto.randomBytes(24).toString("hex");
const SESSION_DAYS = 30;

function makeRepo(db) {
  // --- users ---------------------------------------------------------------
  const insertUser = db.prepare("INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)");
  const getUserByEmail = db.prepare("SELECT * FROM users WHERE email = ?");
  const getUserById = db.prepare("SELECT * FROM users WHERE id = ?");
  const setPasswordStmt = db.prepare("UPDATE users SET password_hash = ? WHERE id = ?");

  function createUser({ name, email, passwordHash = null }) {
    const info = insertUser.run(name, email.toLowerCase().trim(), passwordHash, now());
    return getUserById.get(info.lastInsertRowid);
  }

  // --- sessions ------------------------------------------------------------
  const insertSession = db.prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)");
  const getSessionStmt = db.prepare("SELECT * FROM sessions WHERE token = ?");
  const deleteSessionStmt = db.prepare("DELETE FROM sessions WHERE token = ?");

  function createSession(userId) {
    const t = token();
    const created = new Date();
    const expires = new Date(created.getTime() + SESSION_DAYS * 86400_000);
    insertSession.run(t, userId, created.toISOString(), expires.toISOString());
    return t;
  }
  function getSessionUser(t) {
    const s = getSessionStmt.get(t);
    if (!s) return null;
    if (new Date(s.expires_at) < new Date()) {
      deleteSessionStmt.run(t);
      return null;
    }
    return getUserById.get(s.user_id);
  }

  // --- groups & memberships ------------------------------------------------
  const insertGroup = db.prepare("INSERT INTO groups (name, base_currency, owner_id, created_at) VALUES (?, ?, ?, ?)");
  const getGroupStmt = db.prepare("SELECT * FROM groups WHERE id = ?");
  const renameGroupStmt = db.prepare("UPDATE groups SET name = ? WHERE id = ?");
  const deleteGroupStmt = db.prepare("DELETE FROM groups WHERE id = ?");
  const insertMembership = db.prepare(
    "INSERT INTO memberships (group_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)"
  );
  const getMembershipStmt = db.prepare("SELECT * FROM memberships WHERE group_id = ? AND user_id = ?");
  const listMembersStmt = db.prepare(
    `SELECT m.role, m.joined_at, u.id, u.name, u.email, u.password_hash
       FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.group_id = ? ORDER BY m.joined_at`
  );
  const listUserGroupsStmt = db.prepare(
    `SELECT g.* FROM groups g JOIN memberships m ON m.group_id = g.id
      WHERE m.user_id = ? ORDER BY g.created_at`
  );
  const setRoleStmt = db.prepare("UPDATE memberships SET role = ? WHERE group_id = ? AND user_id = ?");
  const removeMemberStmt = db.prepare("DELETE FROM memberships WHERE group_id = ? AND user_id = ?");

  function createGroup({ name, baseCurrency = "USD", ownerId }) {
    const info = insertGroup.run(name, baseCurrency, ownerId, now());
    const groupId = info.lastInsertRowid;
    insertMembership.run(groupId, ownerId, "owner", now());
    return getGroupStmt.get(groupId);
  }
  function addMember(groupId, userId, role = "member") {
    if (getMembershipStmt.get(groupId, userId)) return;
    insertMembership.run(groupId, userId, role, now());
  }

  // --- invites -------------------------------------------------------------
  const insertInvite = db.prepare(
    `INSERT INTO invites (group_id, email, token, invited_by, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`
  );
  const listInvitesStmt = db.prepare(
    "SELECT * FROM invites WHERE group_id = ? AND status = 'pending' ORDER BY created_at"
  );
  const getInviteByTokenStmt = db.prepare("SELECT * FROM invites WHERE token = ?");
  const getInviteByIdStmt = db.prepare("SELECT * FROM invites WHERE id = ?");
  const setInviteStatusStmt = db.prepare("UPDATE invites SET status = ? WHERE id = ?");

  function createInvite(groupId, email, invitedBy) {
    const t = token();
    const info = insertInvite.run(groupId, email.toLowerCase().trim(), t, invitedBy, now());
    return getInviteByIdStmt.get(info.lastInsertRowid);
  }

  // --- expenses ------------------------------------------------------------
  const insertExpense = db.prepare(
    `INSERT INTO expenses
       (group_id, description, payer_id, amount_cents, currency, rate_to_base, split_type, date, created_by, created_at)
     VALUES (@group_id, @description, @payer_id, @amount_cents, @currency, @rate_to_base, @split_type, @date, @created_by, @created_at)`
  );
  const insertShare = db.prepare("INSERT INTO expense_shares (expense_id, user_id, share_cents) VALUES (?, ?, ?)");
  const getExpenseStmt = db.prepare("SELECT * FROM expenses WHERE id = ?");
  const listExpensesStmt = db.prepare("SELECT * FROM expenses WHERE group_id = ? ORDER BY date DESC, id DESC");
  const listSharesStmt = db.prepare("SELECT * FROM expense_shares WHERE expense_id = ?");
  const listGroupSharesStmt = db.prepare(
    `SELECT s.expense_id, s.user_id, s.share_cents, e.payer_id
       FROM expense_shares s JOIN expenses e ON e.id = s.expense_id
      WHERE e.group_id = ?`
  );
  const deleteExpenseStmt = db.prepare("DELETE FROM expenses WHERE id = ?");

  /**
   * Create an expense: resolve per-person shares in the expense currency via
   * core, snapshot the FX rate, convert shares to base-currency cents, and store
   * atomically. `config` carries { shares } (exact) or { percents } (percent).
   */
  const createExpense = db.transaction((input) => {
    const {
      groupId,
      description = "",
      payerId,
      amountCents,
      currency = "USD",
      rateToBase = 1,
      splitType = "equal",
      participants,
      config = {},
      date,
      createdBy,
    } = input;

    const resolved = resolveShares(amountCents, splitType, participants, config);
    const info = insertExpense.run({
      group_id: groupId,
      description,
      payer_id: payerId,
      amount_cents: amountCents,
      currency,
      rate_to_base: rateToBase,
      split_type: splitType,
      date,
      created_by: createdBy,
      created_at: now(),
    });
    const expenseId = info.lastInsertRowid;
    for (const s of resolved.shares) {
      insertShare.run(expenseId, s.userId, Math.round(s.shareCents * rateToBase));
    }
    return expenseId;
  });

  function getExpenseWithShares(id) {
    const e = getExpenseStmt.get(id);
    if (!e) return null;
    e.shares = listSharesStmt.all(id);
    return e;
  }

  // --- settlements ---------------------------------------------------------
  const insertSettlement = db.prepare(
    `INSERT INTO settlements (group_id, from_user, to_user, amount_cents, status, marked_by, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`
  );
  const listSettlementsStmt = db.prepare("SELECT * FROM settlements WHERE group_id = ? ORDER BY created_at DESC");
  const getSettlementStmt = db.prepare("SELECT * FROM settlements WHERE id = ?");
  const confirmSettlementStmt = db.prepare(
    "UPDATE settlements SET status = 'confirmed', confirmed_at = ? WHERE id = ?"
  );
  const disputeSettlementStmt = db.prepare("UPDATE settlements SET status = 'disputed' WHERE id = ?");

  function createSettlement(groupId, fromUser, toUser, amountCents, markedBy) {
    const info = insertSettlement.run(groupId, fromUser, toUser, amountCents, markedBy, now());
    return getSettlementStmt.get(info.lastInsertRowid);
  }

  // --- recurring -----------------------------------------------------------
  const insertRecurring = db.prepare(
    `INSERT INTO recurring_expenses
       (group_id, description, amount_cents, currency, cadence, split_type, split_config_json, payer_id, next_due, active, created_at)
     VALUES (@group_id, @description, @amount_cents, @currency, @cadence, @split_type, @split_config_json, @payer_id, @next_due, 1, @created_at)`
  );
  const listRecurringStmt = db.prepare(
    "SELECT * FROM recurring_expenses WHERE group_id = ? AND active = 1 ORDER BY created_at"
  );
  const getRecurringStmt = db.prepare("SELECT * FROM recurring_expenses WHERE id = ?");
  const insertInstance = db.prepare(
    `INSERT INTO recurring_instances (recurring_id, group_id, due_date, status, created_at)
     VALUES (?, ?, ?, 'pending', ?)`
  );
  const listInstancesStmt = db.prepare(
    "SELECT * FROM recurring_instances WHERE group_id = ? AND status = 'pending' ORDER BY due_date"
  );
  const getInstanceStmt = db.prepare("SELECT * FROM recurring_instances WHERE id = ?");
  const approveInstanceStmt = db.prepare(
    "UPDATE recurring_instances SET status = 'approved', approved_by = ?, expense_id = ? WHERE id = ?"
  );
  const skipInstanceStmt = db.prepare(
    "UPDATE recurring_instances SET status = 'skipped', approved_by = ? WHERE id = ?"
  );
  const setNextDueStmt = db.prepare("UPDATE recurring_expenses SET next_due = ? WHERE id = ?");

  function createRecurring(input) {
    const info = insertRecurring.run({
      group_id: input.groupId,
      description: input.description,
      amount_cents: input.amountCents,
      currency: input.currency || "USD",
      cadence: input.cadence || "monthly",
      split_type: input.splitType || "equal",
      split_config_json: JSON.stringify(input.config || {}),
      payer_id: input.payerId,
      next_due: input.nextDue,
      created_at: now(),
    });
    const rec = getRecurringStmt.get(info.lastInsertRowid);
    // Seed the first pending instance so admins have something to approve.
    insertInstance.run(rec.id, rec.group_id, rec.next_due, now());
    return rec;
  }

  // --- balances (uses core) ------------------------------------------------
  function groupBalances(groupId) {
    const rows = listGroupSharesStmt.all(groupId);
    const byExpense = new Map();
    for (const r of rows) {
      if (!byExpense.has(r.expense_id)) {
        byExpense.set(r.expense_id, { payerId: r.payer_id, shares: [] });
      }
      byExpense.get(r.expense_id).shares.push({ userId: r.user_id, shareCents: r.share_cents });
    }
    const confirmed = listSettlementsStmt
      .all(groupId)
      .filter((s) => s.status === "confirmed")
      .map((s) => ({ fromUser: s.from_user, toUser: s.to_user, amountCents: s.amount_cents }));
    const memberIds = listMembersStmt.all(groupId).map((m) => m.id);
    return computeBalances([...byExpense.values()], confirmed, memberIds);
  }

  function settlePlan(groupId) {
    // computeBalances keys are integer user ids, but Object.entries (inside
    // minimalTransactions) stringifies them. Coerce back so name resolution and
    // the client's numeric `=== user.id` checks work.
    return minimalTransactions(groupBalances(groupId)).map((p) => ({
      ...p,
      from: Number(p.from),
      to: Number(p.to),
    }));
  }

  return {
    db,
    createUser,
    getUserByEmail: (email) => getUserByEmail.get(String(email).toLowerCase().trim()),
    getUserById: (id) => getUserById.get(id),
    setPassword: (id, hash) => setPasswordStmt.run(hash, id),
    createSession,
    getSessionUser,
    deleteSession: (t) => deleteSessionStmt.run(t),
    createGroup,
    getGroup: (id) => getGroupStmt.get(id),
    renameGroup: (id, name) => renameGroupStmt.run(name, id),
    deleteGroup: (id) => deleteGroupStmt.run(id),
    listUserGroups: (userId) => listUserGroupsStmt.all(userId),
    getMembership: (groupId, userId) => getMembershipStmt.get(groupId, userId),
    listMembers: (groupId) => listMembersStmt.all(groupId),
    addMember,
    setRole: (groupId, userId, role) => setRoleStmt.run(role, groupId, userId),
    removeMember: (groupId, userId) => removeMemberStmt.run(groupId, userId),
    createInvite,
    listInvites: (groupId) => listInvitesStmt.all(groupId),
    getInviteByToken: (t) => getInviteByTokenStmt.get(t),
    getInviteById: (id) => getInviteByIdStmt.get(id),
    setInviteStatus: (id, status) => setInviteStatusStmt.run(status, id),
    createExpense,
    getExpense: (id) => getExpenseStmt.get(id),
    getExpenseWithShares,
    listExpenses: (groupId) => listExpensesStmt.all(groupId),
    listShares: (expenseId) => listSharesStmt.all(expenseId),
    deleteExpense: (id) => deleteExpenseStmt.run(id),
    createSettlement,
    listSettlements: (groupId) => listSettlementsStmt.all(groupId),
    getSettlement: (id) => getSettlementStmt.get(id),
    confirmSettlement: (id) => confirmSettlementStmt.run(now(), id),
    disputeSettlement: (id) => disputeSettlementStmt.run(id),
    createRecurring,
    listRecurring: (groupId) => listRecurringStmt.all(groupId),
    getRecurring: (id) => getRecurringStmt.get(id),
    listInstances: (groupId) => listInstancesStmt.all(groupId),
    getInstance: (id) => getInstanceStmt.get(id),
    approveInstance: (id, approvedBy, expenseId) => approveInstanceStmt.run(approvedBy, expenseId, id),
    skipInstance: (id, approvedBy) => skipInstanceStmt.run(approvedBy, id),
    addInstance: (recurringId, groupId, dueDate) => insertInstance.run(recurringId, groupId, dueDate, now()),
    setNextDue: (recurringId, dueDate) => setNextDueStmt.run(dueDate, recurringId),
    groupBalances,
    settlePlan,
  };
}

module.exports = { makeRepo };
