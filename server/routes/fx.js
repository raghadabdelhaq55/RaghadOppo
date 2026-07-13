const fx = require("../services/fx");

function register(router) {
  // Current FX rate (multiply an amount in `from` to get `to`). Used by the
  // add-expense wizard to preview the base-currency equivalent.
  router.get("/api/fx", async ({ query, json, error }) => {
    const from = (query.from || "USD").toUpperCase();
    const to = (query.to || "USD").toUpperCase();
    try {
      const rate = await fx.getRate(from, to);
      return json(200, { from, to, rate });
    } catch (e) {
      return error(400, e.message);
    }
  });

  router.get("/api/currencies", ({ json }) => json(200, { currencies: fx.SUPPORTED }));
}

module.exports = { register };
