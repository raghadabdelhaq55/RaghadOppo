// FX provider (SPEC §9). Interface: getRate(from, to) -> number, where the rate
// multiplies an amount in `from` to yield `to`. The rate is snapshotted onto the
// expense at creation time (SPEC §10 Q6) so historical balances never drift.
//
// Dev default: a bundled snapshot (USD per 1 unit of currency), runs offline.
// Prod: set FX_API_KEY to fetch live rates (stubbed hook below).

// Approximate mid-market snapshot. EUR->USD = 1.08 matches the mockup's "@1.080".
const USD_PER = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.73,
  AUD: 0.66,
  JPY: 0.0067,
};

function snapshotRate(from, to) {
  const f = USD_PER[from];
  const t = USD_PER[to];
  if (!f || !t) throw new Error(`unsupported currency: ${from} or ${to}`);
  return f / t;
}

async function getRate(from, to) {
  from = String(from).toUpperCase();
  to = String(to).toUpperCase();
  if (from === to) return 1;
  if (process.env.FX_API_KEY) {
    // Live provider drop-in point. Falls back to the snapshot on any failure.
    try {
      return await fetchLiveRate(from, to);
    } catch {
      return snapshotRate(from, to);
    }
  }
  return snapshotRate(from, to);
}

// eslint-disable-next-line no-unused-vars
async function fetchLiveRate(from, to) {
  // Example shape for a real integration (not exercised in dev):
  //   const res = await fetch(`https://api.example-fx.com/v1/rate?base=${from}&symbols=${to}&api_key=${process.env.FX_API_KEY}`);
  //   const json = await res.json();
  //   return json.rates[to];
  throw new Error("live FX not configured");
}

module.exports = { getRate, snapshotRate, SUPPORTED: Object.keys(USD_PER) };
