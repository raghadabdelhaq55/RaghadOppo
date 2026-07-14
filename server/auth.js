// Auth helpers: password hashing (bcryptjs), session-cookie plumbing, and
// role-based authorization guards used by the route handlers.

const bcrypt = require("bcryptjs");

const COOKIE = "bs_session";

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}
function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compareSync(password, hash);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setSessionCookie(res, token) {
  const attrs = [`${COOKIE}=${token}`, "HttpOnly", "Path=/", "SameSite=Lax", `Max-Age=${30 * 86400}`];
  res.setHeader("Set-Cookie", attrs.join("; "));
}
function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; Path=/; Max-Age=0`);
}

// Resolve the signed-in user (or null) from the session cookie.
function currentUser(req, repo) {
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;
  return repo.getSessionUser(token) || null;
}

// Authorization guards — return the membership row or throw an HttpError.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requireMember(repo, groupId, user) {
  const m = repo.getMembership(groupId, user.id);
  if (!m) throw new HttpError(403, "not a member of this group");
  return m;
}
function requireAdmin(repo, groupId, user) {
  const m = requireMember(repo, groupId, user);
  if (m.role !== "admin" && m.role !== "owner") throw new HttpError(403, "admin only");
  return m;
}
function requireOwner(repo, groupId, user) {
  const m = requireMember(repo, groupId, user);
  if (m.role !== "owner") throw new HttpError(403, "owner only");
  return m;
}

module.exports = {
  COOKIE,
  parseCookies,
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
  currentUser,
  requireMember,
  requireAdmin,
  requireOwner,
  HttpError,
};
