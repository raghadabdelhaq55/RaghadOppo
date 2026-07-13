const { requireMember, requireAdmin } = require("../auth");
const { recurringView } = require("../present");
const { toCents } = require("../../core/split");
const fx = require("../services/fx");

function nameResolver(repo, groupId) {
  const map = new Map(repo.listMembers(groupId).map((m) => [m.id, m.name]));
  return (id) => map.get(id) || "Unknown";
}

// Advance a due date by the template's cadence (monthly by default).
function nextDueDate(dueDate, cadence) {
  const d = new Date(dueDate + "T00:00:00Z");
  if (cadence === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (cadence === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function register(router) {
  router.get("/api/groups/:id/recurring", ({ params, user, repo, json }) => {
    const groupId = Number(params.id);
    requireMember(repo, groupId, user);
    const nameOf = nameResolver(repo, groupId);
    const instances = repo.listInstances(groupId);
    const recurring = repo.listRecurring(groupId).map((r) => recurringView(r, instances, nameOf));
    return json(200, { recurring });
  });

  router.post("/api/groups/:id/recurring", ({ params, user, body, repo, json, error }) => {
    const groupId = Number(params.id);
    requireAdmin(repo, groupId, user);
    const description = (body.description || "").trim();
    if (!description) return error(400, "description is required");
    const amountCents = body.amountCents != null ? Math.round(body.amountCents) : toCents(body.amount);
    if (!Number.isFinite(amountCents) || amountCents <= 0) return error(400, "amount must be positive");
    const rec = repo.createRecurring({
      groupId,
      description,
      amountCents,
      currency: (body.currency || "USD").toUpperCase(),
      cadence: body.cadence || "monthly",
      splitType: body.splitType || "equal",
      config: {
        participants: (body.participants || repo.listMembers(groupId).map((m) => m.id)).map(Number),
        shares: body.shares || {},
        percents: body.percents || {},
      },
      payerId: Number(body.payerId) || user.id,
      nextDue: body.nextDue || new Date().toISOString().slice(0, 10),
    });
    return json(201, { id: rec.id });
  });

  // Approve a pending instance -> post it as a real expense, then schedule next.
  router.post(
    "/api/groups/:id/recurring/:rid/instances/:iid/approve",
    async ({ params, user, body, repo, json, error }) => {
      const groupId = Number(params.id);
      requireAdmin(repo, groupId, user);
      const rec = repo.getRecurring(Number(params.rid));
      const inst = repo.getInstance(Number(params.iid));
      if (!rec || rec.group_id !== groupId) return error(404, "recurring template not found");
      if (!inst || inst.recurring_id !== rec.id) return error(404, "instance not found");
      if (inst.status !== "pending") return error(400, "instance already handled");

      const group = repo.getGroup(groupId);
      // Admins may edit the amount before approving (SPEC §10 Q1).
      const amountCents = body.amountCents != null ? Math.round(body.amountCents) : rec.amount_cents;
      const config = JSON.parse(rec.split_config_json || "{}");
      let rateToBase;
      try {
        rateToBase = await fx.getRate(rec.currency, group.base_currency);
      } catch (e) {
        return error(400, e.message);
      }

      try {
        const expenseId = repo.createExpense({
          groupId,
          description: `${rec.description} — ${inst.due_date}`,
          payerId: rec.payer_id,
          amountCents,
          currency: rec.currency,
          rateToBase,
          splitType: rec.split_type,
          participants: config.participants,
          config,
          date: inst.due_date,
          createdBy: user.id,
        });
        repo.approveInstance(inst.id, user.id, expenseId);
        const next = nextDueDate(rec.next_due, rec.cadence);
        repo.setNextDue(rec.id, next);
        repo.addInstance(rec.id, groupId, next);
        return json(200, { expenseId, nextDue: next });
      } catch (e) {
        return error(400, e.message);
      }
    }
  );

  router.post("/api/groups/:id/recurring/:rid/instances/:iid/skip", ({ params, user, repo, json, error }) => {
    const groupId = Number(params.id);
    requireAdmin(repo, groupId, user);
    const rec = repo.getRecurring(Number(params.rid));
    const inst = repo.getInstance(Number(params.iid));
    if (!rec || rec.group_id !== groupId) return error(404, "recurring template not found");
    if (!inst || inst.recurring_id !== rec.id) return error(404, "instance not found");
    if (inst.status !== "pending") return error(400, "instance already handled");
    repo.skipInstance(inst.id, user.id);
    const next = nextDueDate(rec.next_due, rec.cadence);
    repo.setNextDue(rec.id, next);
    repo.addInstance(rec.id, groupId, next);
    return json(200, { nextDue: next });
  });
}

module.exports = { register };
