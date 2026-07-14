const { requireMember, requireOwner } = require("../auth");
const { memberView, paymentView } = require("../present");
const { SUPPORTED } = require("../services/fx");

// Build an id -> name resolver from a group's members.
function nameResolver(repo, groupId) {
  const map = new Map(repo.listMembers(groupId).map((m) => [m.id, m.name]));
  return (id) => map.get(id) || "Unknown";
}

function register(router) {
  // Groups the signed-in user belongs to, each with their net position.
  router.get("/api/groups", ({ user, repo, json }) => {
    const groups = repo.listUserGroups(user.id).map((g) => {
      const balances = repo.groupBalances(g.id);
      const members = repo.listMembers(g.id);
      const me = repo.getMembership(g.id, user.id);
      return {
        id: g.id,
        name: g.name,
        baseCurrency: g.base_currency,
        role: me.role,
        memberCount: members.length,
        netCents: balances[user.id] || 0,
      };
    });
    return json(200, { groups });
  });

  router.post("/api/groups", ({ user, body, repo, json, error }) => {
    const name = (body.name || "").trim();
    if (!name) return error(400, "group name is required");
    const baseCurrency = (body.baseCurrency || "USD").toUpperCase();
    if (!SUPPORTED.includes(baseCurrency)) return error(400, "unsupported base currency");
    const group = repo.createGroup({ name, baseCurrency, ownerId: user.id });
    return json(201, { group: { id: group.id, name: group.name, baseCurrency } });
  });

  router.get("/api/groups/:id", ({ params, user, repo, json }) => {
    const groupId = Number(params.id);
    const me = requireMember(repo, groupId, user);
    const group = repo.getGroup(groupId);
    const balances = repo.groupBalances(groupId);
    const nameOf = nameResolver(repo, groupId);
    const members = repo.listMembers(groupId).map((m) => memberView(m, balances[m.id] || 0));
    const plan = repo.settlePlan(groupId).map((p) => paymentView(p, nameOf));
    return json(200, {
      id: group.id,
      name: group.name,
      baseCurrency: group.base_currency,
      role: me.role,
      netCents: balances[user.id] || 0,
      members,
      plan,
    });
  });

  router.patch("/api/groups/:id", ({ params, user, body, repo, json, error }) => {
    const groupId = Number(params.id);
    requireOwner(repo, groupId, user);
    const name = (body.name || "").trim();
    if (!name) return error(400, "group name is required");
    repo.renameGroup(groupId, name);
    return json(200, { id: groupId, name });
  });

  router.delete("/api/groups/:id", ({ params, user, repo, json }) => {
    const groupId = Number(params.id);
    requireOwner(repo, groupId, user);
    repo.deleteGroup(groupId);
    return json(200, { ok: true });
  });
}

module.exports = { register };
