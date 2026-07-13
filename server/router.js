// A tiny method+path router for the raw Node HTTP server. Patterns use :params,
// e.g. "/api/groups/:id/expenses/:eid". Handlers receive a ctx object.

function compile(pattern) {
  const names = [];
  const regex = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, (m) => (m === "*" ? "*" : "\\" + m))
    .replace(/:(\w+)/g, (_, name) => {
      names.push(name);
      return "([^/]+)";
    });
  return { re: new RegExp("^" + regex + "$"), names };
}

class Router {
  constructor() {
    this.routes = [];
  }
  add(method, pattern, handler, opts = {}) {
    this.routes.push({ method, handler, opts, ...compile(pattern) });
    return this;
  }
  get(p, h, o) {
    return this.add("GET", p, h, o);
  }
  post(p, h, o) {
    return this.add("POST", p, h, o);
  }
  patch(p, h, o) {
    return this.add("PATCH", p, h, o);
  }
  delete(p, h, o) {
    return this.add("DELETE", p, h, o);
  }

  match(method, pathname) {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = pathname.match(r.re);
      if (!m) continue;
      const params = {};
      r.names.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1])));
      return { route: r, params };
    }
    return null;
  }
}

module.exports = { Router };
