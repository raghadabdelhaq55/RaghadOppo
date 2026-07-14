const http = require("http");
const fs = require("fs");
const path = require("path");
const { getDb } = require("./db");
const { makeRepo } = require("./repo");
const { Router } = require("./router");
const { currentUser, HttpError } = require("./auth");

const PORT = process.env.PORT || 3000;
const CLIENT_DIR = path.join(__dirname, "..", "client", "dist");

// --- assemble the API router ------------------------------------------------
const router = new Router();
for (const mod of [
  "./routes/auth",
  "./routes/groups",
  "./routes/members",
  "./routes/expenses",
  "./routes/settlements",
  "./routes/recurring",
  "./routes/fx",
]) {
  require(mod).register(router);
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 1e6) reject(new Error("payload too large"));
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

// Serve the built client, falling back to index.html for client-side routes.
function serveClient(req, res, pathname) {
  const clean = pathname.replace(/^\/+/, "");
  let filePath = path.join(CLIENT_DIR, clean);
  if (!filePath.startsWith(CLIENT_DIR)) return sendJSON(res, 403, { error: "forbidden" });
  if (!clean || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(CLIENT_DIR, "index.html");
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      return sendJSON(res, 404, {
        error: "client not built — run `npm run build`, or use `npm run dev`",
      });
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "text/plain" });
    res.end(content);
  });
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (!pathname.startsWith("/api/")) return serveClient(req, res, pathname);

  const repo = makeRepo(getDb());
  const matched = router.match(req.method, pathname);
  if (!matched) return sendJSON(res, 404, { error: "unknown endpoint" });

  const { route, params } = matched;
  const authRequired = route.opts.auth !== false;
  const user = currentUser(req, repo);
  if (authRequired && !user) return sendJSON(res, 401, { error: "authentication required" });

  let body = {};
  if (req.method === "POST" || req.method === "PATCH" || req.method === "PUT") {
    try {
      body = await readBody(req);
    } catch {
      return sendJSON(res, 400, { error: "invalid JSON body" });
    }
  }

  const query = Object.fromEntries(url.searchParams.entries());
  const ctx = {
    req,
    res,
    params,
    query,
    body,
    user,
    repo,
    json: (status, obj) => sendJSON(res, status, obj),
    error: (status, message) => sendJSON(res, status, { error: message }),
  };

  try {
    await route.handler(ctx);
  } catch (err) {
    if (err instanceof HttpError) return sendJSON(res, err.status, { error: err.message });
    console.error(`[api] ${req.method} ${pathname}:`, err);
    return sendJSON(res, 500, { error: err.message || "internal error" });
  }
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) sendJSON(res, 500, { error: "internal error" });
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Bill Splitter v2 API on http://localhost:${PORT}`);
  });
}

module.exports = { server, handle };
