const SYMBOL = { USD: "$", EUR: "€", GBP: "£", CAD: "C$", AUD: "A$", JPY: "¥" };

export function symbolFor(currency) {
  return SYMBOL[currency] || `${currency} `;
}

// Format integer cents as a currency string, e.g. money(6400) -> "$64.00".
export function money(cents, currency = "USD") {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents)) / 100;
  return `${sign}${symbolFor(currency)}${abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Signed version for balances, e.g. "+$24.50" / "-$42.50".
export function signedMoney(cents, currency = "USD") {
  const s = cents > 0 ? "+" : cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents)) / 100;
  return `${s}${symbolFor(currency)}${abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
