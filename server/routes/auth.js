const { hashPassword, verifyPassword, setSessionCookie, clearSessionCookie, parseCookies, COOKIE } = require("../auth");
const { publicUser } = require("../present");

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function register(router) {
  router.post(
    "/api/auth/signup",
    ({ body, repo, res, json, error }) => {
      const name = (body.name || "").trim();
      const email = (body.email || "").toLowerCase().trim();
      const password = body.password || "";
      if (!name) return error(400, "name is required");
      if (!EMAIL_RE.test(email)) return error(400, "a valid email is required");
      if (password.length < 6) return error(400, "password must be at least 6 characters");

      const existing = repo.getUserByEmail(email);
      let user;
      if (existing && existing.password_hash) {
        return error(409, "an account with that email already exists");
      } else if (existing) {
        // Claim a shadow account (imported/invited person setting a password).
        repo.setPassword(existing.id, hashPassword(password));
        if (name) existing.name = name;
        user = repo.getUserById(existing.id);
      } else {
        user = repo.createUser({ name, email, passwordHash: hashPassword(password) });
      }
      setSessionCookie(res, repo.createSession(user.id));
      return json(201, { user: publicUser(user) });
    },
    { auth: false }
  );

  router.post(
    "/api/auth/login",
    ({ body, repo, res, json, error }) => {
      const email = (body.email || "").toLowerCase().trim();
      const user = repo.getUserByEmail(email);
      if (!user || !verifyPassword(body.password || "", user.password_hash)) {
        return error(401, "invalid email or password");
      }
      setSessionCookie(res, repo.createSession(user.id));
      return json(200, { user: publicUser(user) });
    },
    { auth: false }
  );

  router.post("/api/auth/logout", ({ req, repo, res, json }) => {
    const token = parseCookies(req)[COOKIE];
    if (token) repo.deleteSession(token);
    clearSessionCookie(res);
    return json(200, { ok: true });
  });

  router.get("/api/auth/me", ({ user, json }) => json(200, { user: publicUser(user) }));
}

module.exports = { register };
