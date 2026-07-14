const { requireMember, requireAdmin } = require("../auth");
const { expenseView } = require("../present");
const { toCents } = require("../../core/split");
const fx = require("../services/fx");

function nameResolver(repo, groupId) {
  const map = new Map(repo.listMembers(groupId).map((m) => [m.id, m.name]));
  return (id) => map.get(id) || "Unknown";
}

function register(router) {
  // Activity feed: expenses newest-first, with shares + names.
  router.get("/api/groups/:id/expenses", ({ params, user, repo, json }) => {
    const groupId = Number(params.id);
    requireMember(repo, groupId, user);
    const nameOf = nameResolver(repo, groupId);
    const expenses = repo.listExpenses(groupId).map((e) => expenseView(e, repo.listShares(e.id), nameOf));
    return json(200, { expenses });
  });

  router.post("/api/groups/:id/expenses", async ({ params, user, body, repo, json, error }) => {
    const groupId = Number(params.id);
    requireMember(repo, groupId, user);
    const group = repo.getGroup(groupId);

    const memberIds = new Set(repo.listMembers(groupId).map((m) => m.id));
    const payerId = Number(body.payerId);
    if (!memberIds.has(payerId)) return error(400, "payer must be a group member");

    const participants = (body.participants || []).map(Number);
    if (participants.length === 0) return error(400, "select at least one participant");
    if (!participants.every((id) => memberIds.has(id))) {
      return error(400, "all participants must be group members");
    }

    const amountCents = body.amountCents != null ? Math.round(body.amountCents) : toCents(body.amount);
    if (!Number.isFinite(amountCents) || amountCents <= 0) return error(400, "amount must be positive");

    const currency = (body.currency || group.base_currency).toUpperCase();
    let rateToBase;
    try {
      rateToBase = await fx.getRate(currency, group.base_currency);
    } catch (e) {
      return error(400, e.message);
    }

    try {
      const expenseId = repo.createExpense({
        groupId,
        description: (body.description || "").trim(),
        payerId,
        amountCents,
        currency,
        rateToBase,
        splitType: body.splitType || "equal",
        participants,
        config: { shares: body.shares || {}, percents: body.percents || {} },
        date: body.date || new Date().toISOString().slice(0, 10),
        createdBy: user.id,
      });
      const e = repo.getExpense(expenseId);
      return json(201, {
        expense: expenseView(e, repo.listShares(expenseId), nameResolver(repo, groupId)),
      });
    } catch (e) {
      // resolveShares throws on invalid exact/percent input.
      return error(400, e.message);
    }
  });

  router.delete("/api/groups/:id/expenses/:eid", ({ params, user, repo, json, error }) => {
    const groupId = Number(params.id);
    const membership = requireMember(repo, groupId, user);
    const expense = repo.getExpense(Number(params.eid));
    if (!expense || expense.group_id !== groupId) return error(404, "expense not found");
    const isAdmin = membership.role === "admin" || membership.role === "owner";
    if (expense.created_by !== user.id && expense.payer_id !== user.id && !isAdmin) {
      requireAdmin(repo, groupId, user); // throws 403 with a clear message
    }
    repo.deleteExpense(expense.id);
    return json(200, { ok: true });
  });
}

module.exports = { register };
