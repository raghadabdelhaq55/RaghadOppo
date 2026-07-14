const { requireMember } = require("../auth");
const { paymentView, settlementView } = require("../present");

function nameResolver(repo, groupId) {
  const map = new Map(repo.listMembers(groupId).map((m) => [m.id, m.name]));
  return (id) => map.get(id) || "Unknown";
}

function register(router) {
  // The minimal payment plan (§7a) plus pending/awaiting settlements (§7b).
  router.get("/api/groups/:id/settle", ({ params, user, repo, json }) => {
    const groupId = Number(params.id);
    requireMember(repo, groupId, user);
    const nameOf = nameResolver(repo, groupId);
    const plan = repo.settlePlan(groupId).map((p) => paymentView(p, nameOf));
    const settlements = repo
      .listSettlements(groupId)
      .filter((s) => s.status !== "confirmed")
      .map((s) => settlementView(s, nameOf));
    return json(200, { plan, settlements });
  });

  // Mark a debt as paid -> creates a PENDING settlement (needs payee confirm).
  router.post("/api/groups/:id/settlements", ({ params, user, body, repo, json, error }) => {
    const groupId = Number(params.id);
    requireMember(repo, groupId, user);
    const memberIds = new Set(repo.listMembers(groupId).map((m) => m.id));
    const toUser = Number(body.toUser);
    const fromUser = body.fromUser != null ? Number(body.fromUser) : user.id;
    const amountCents = Math.round(body.amountCents);
    if (!memberIds.has(toUser) || !memberIds.has(fromUser)) {
      return error(400, "payer and payee must be group members");
    }
    if (!Number.isFinite(amountCents) || amountCents <= 0) return error(400, "amount must be positive");
    // Don't let the same debt be marked paid twice while one is still pending.
    const dup = repo
      .listSettlements(groupId)
      .some((s) => s.status === "pending" && s.from_user === fromUser && s.to_user === toUser);
    if (dup) return error(409, "that payment is already awaiting confirmation");
    const s = repo.createSettlement(groupId, fromUser, toUser, amountCents, user.id);
    return json(201, { settlement: settlementView(s, nameResolver(repo, groupId)) });
  });

  // Payee confirms receipt -> balance updates (§7b). Only the payee may confirm.
  router.post("/api/groups/:id/settlements/:sid/confirm", ({ params, user, repo, json, error }) => {
    const groupId = Number(params.id);
    requireMember(repo, groupId, user);
    const s = repo.getSettlement(Number(params.sid));
    if (!s || s.group_id !== groupId) return error(404, "settlement not found");
    if (s.status !== "pending") return error(400, "settlement is not pending");
    if (s.to_user !== user.id) return error(403, "only the payee can confirm receipt");
    repo.confirmSettlement(s.id);
    return json(200, { ok: true });
  });

  router.post("/api/groups/:id/settlements/:sid/dispute", ({ params, user, repo, json, error }) => {
    const groupId = Number(params.id);
    requireMember(repo, groupId, user);
    const s = repo.getSettlement(Number(params.sid));
    if (!s || s.group_id !== groupId) return error(404, "settlement not found");
    if (s.status !== "pending") return error(400, "settlement is not pending");
    if (s.to_user !== user.id && s.from_user !== user.id) {
      return error(403, "only the payer or payee can dispute");
    }
    repo.disputeSettlement(s.id);
    return json(200, { ok: true });
  });
}

module.exports = { register };
