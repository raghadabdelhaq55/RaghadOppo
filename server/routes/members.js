const { requireMember, requireAdmin, requireOwner, HttpError } = require("../auth");
const { memberView, inviteView, publicUser } = require("../present");
const email = require("../services/email");

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function register(router) {
  // Members + pending invites for a group (any member can view).
  router.get("/api/groups/:id/members", ({ params, user, repo, json }) => {
    const groupId = Number(params.id);
    requireMember(repo, groupId, user);
    const balances = repo.groupBalances(groupId);
    return json(200, {
      members: repo.listMembers(groupId).map((m) => memberView(m, balances[m.id] || 0)),
      invites: repo.listInvites(groupId).map(inviteView),
    });
  });

  // Invite by email (admin/owner). Sends a real invite via the email adapter.
  router.post("/api/groups/:id/invites", async ({ params, user, body, repo, json, error }) => {
    const groupId = Number(params.id);
    requireAdmin(repo, groupId, user);
    const addr = (body.email || "").toLowerCase().trim();
    if (!EMAIL_RE.test(addr)) return error(400, "a valid email is required");

    const existing = repo.getUserByEmail(addr);
    if (existing && repo.getMembership(groupId, existing.id)) {
      return error(409, "that person is already in this group");
    }

    const group = repo.getGroup(groupId);
    const invite = repo.createInvite(groupId, addr, user.id);
    const link = `${body.origin || ""}/invite/${invite.token}`;
    await email.send({
      to: addr,
      subject: `You're invited to ${group.name} on Bill Splitter`,
      text: `${user.name} invited you to join "${group.name}".\n\nAccept: ${link}\n\nIf you don't have an account yet, signing up with this email will join you automatically.`,
    });
    return json(201, { invite: inviteView(invite) });
  });

  router.delete("/api/groups/:id/invites/:iid", ({ params, user, repo, json, error }) => {
    const groupId = Number(params.id);
    requireAdmin(repo, groupId, user);
    const invite = repo.getInviteById(Number(params.iid));
    if (!invite || invite.group_id !== groupId) return error(404, "invite not found");
    repo.setInviteStatus(invite.id, "revoked");
    return json(200, { ok: true });
  });

  // Accept an invite (signed-in user joins the group the token points at).
  router.post("/api/invites/accept", ({ user, body, repo, json, error }) => {
    const invite = repo.getInviteByToken((body.token || "").trim());
    if (!invite || invite.status !== "pending") return error(404, "invite not found or already used");
    repo.addMember(invite.group_id, user.id, "member");
    repo.setInviteStatus(invite.id, "accepted");
    return json(200, { groupId: invite.group_id });
  });

  // Look up an invite by token (unauthenticated — used by the accept page).
  router.get(
    "/api/invites/:token",
    ({ params, repo, json, error }) => {
      const invite = repo.getInviteByToken(params.token);
      if (!invite || invite.status !== "pending") return error(404, "invite not found");
      const group = repo.getGroup(invite.group_id);
      return json(200, { email: invite.email, groupName: group ? group.name : null });
    },
    { auth: false }
  );

  // Remove a member (admin). The owner cannot be removed.
  router.delete("/api/groups/:id/members/:uid", ({ params, user, repo, json, error }) => {
    const groupId = Number(params.id);
    requireAdmin(repo, groupId, user);
    const targetId = Number(params.uid);
    const target = repo.getMembership(groupId, targetId);
    if (!target) return error(404, "member not found");
    if (target.role === "owner") return error(400, "cannot remove the group owner");
    repo.removeMember(groupId, targetId);
    return json(200, { ok: true });
  });

  // Change a member's role (owner only): member <-> admin.
  router.patch("/api/groups/:id/members/:uid", ({ params, user, body, repo, json, error }) => {
    const groupId = Number(params.id);
    requireOwner(repo, groupId, user);
    const role = body.role;
    if (role !== "admin" && role !== "member") return error(400, "role must be admin or member");
    const targetId = Number(params.uid);
    const target = repo.getMembership(groupId, targetId);
    if (!target) return error(404, "member not found");
    if (target.role === "owner") return error(400, "cannot change the owner's role");
    repo.setRole(groupId, targetId, role);
    const u = repo.getUserById(targetId);
    return json(200, { member: { ...publicUser(u), role } });
  });
}

module.exports = { register, HttpError };
