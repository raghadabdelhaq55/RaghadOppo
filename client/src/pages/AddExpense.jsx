import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useGroups } from "../context/GroupContext";
import TopBar from "../components/TopBar";
import { Check, Warn } from "../components/icons";
import { money, initials, symbolFor } from "../lib/format";
import { toCents, splitEqualCents, validateExactCents, validatePercents } from "../lib/calc";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];
const STEPS = ["Amount", "Who paid", "Split", "Review"];
const today = () => new Date().toISOString().slice(0, 10);

export default function AddExpense() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { group, currentId, refresh } = useGroups();
  const members = group?.members || [];
  const baseCurrency = group?.baseCurrency || "USD";

  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(baseCurrency);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today());
  const [payerId, setPayerId] = useState(user.id);
  const [chosen, setChosen] = useState(() => new Set());
  const [splitType, setSplitType] = useState("equal");
  const [exact, setExact] = useState({});
  const [percent, setPercent] = useState({});
  const [rate, setRate] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Default: split among everyone once members load.
  useEffect(() => {
    if (members.length) setChosen(new Set(members.map((m) => m.id)));
  }, [group]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preview FX rate when the expense currency differs from base.
  useEffect(() => {
    if (currency === baseCurrency) return setRate(1);
    api
      .get(`/api/fx?from=${currency}&to=${baseCurrency}`)
      .then((d) => setRate(d.rate))
      .catch(() => setRate(1));
  }, [currency, baseCurrency]);

  const participants = useMemo(
    () => members.filter((m) => chosen.has(m.id)),
    [members, chosen]
  );
  const totalCents = toCents(amount || 0);

  // Live validity for the split step.
  const validity = useMemo(() => {
    if (participants.length === 0) return { ok: false, msg: "Pick at least one person" };
    if (splitType === "equal") {
      const each = splitEqualCents(totalCents, participants.length);
      return { ok: true, msg: `Split equally · ${money(each[0], currency)} each` };
    }
    if (splitType === "exact") {
      const cents = participants.map((m) => toCents(exact[m.id] || 0));
      const { ok, sumCents } = validateExactCents(totalCents, cents);
      return ok
        ? { ok, msg: `Shares sum to ${money(totalCents, currency)}` }
        : { ok, msg: `Shares sum to ${money(sumCents, currency)} — must equal ${money(totalCents, currency)}` };
    }
    const pcts = participants.map((m) => Number(percent[m.id] || 0));
    const { ok, sumPct } = validatePercents(pcts);
    return ok
      ? { ok, msg: "Percentages add up to 100%" }
      : { ok, msg: `Percentages add up to ${sumPct}% — must equal 100%` };
  }, [participants, splitType, exact, percent, totalCents, currency]);

  const canContinue =
    (step === 1 && totalCents > 0 && description.trim()) ||
    (step === 2 && participants.length > 0) ||
    (step === 3 && validity.ok) ||
    step === 4;

  const toggle = (id) =>
    setChosen((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const post = async () => {
    setBusy(true);
    setError("");
    try {
      const body = {
        description: description.trim(),
        payerId,
        amount: Number(amount),
        currency,
        date,
        splitType,
        participants: participants.map((m) => m.id),
      };
      if (splitType === "exact") {
        body.shares = Object.fromEntries(participants.map((m) => [m.id, Number(exact[m.id] || 0)]));
      } else if (splitType === "percent") {
        body.percents = Object.fromEntries(participants.map((m) => [m.id, Number(percent[m.id] || 0)]));
      }
      await api.post(`/api/groups/${currentId}/expenses`, body);
      await refresh();
      navigate("/");
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const go = (d) => {
    setError("");
    if (d > 0 && step === 4) return post();
    setStep((s) => Math.max(1, Math.min(4, s + d)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const sym = symbolFor(currency);
  const payerName = members.find((m) => m.id === payerId)?.name || "";

  return (
    <>
      <div className="wrap narrow">
        <TopBar back={{ to: "/", label: group?.name }} />

        {/* step indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0 26px" }}>
          {STEPS.map((label, i) => {
            const n = i + 1;
            const state = n < step ? "done" : n === step ? "active" : "";
            return (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    fontSize: ".78rem",
                    fontWeight: 700,
                    flex: "none",
                    background: state === "active" ? "var(--accent)" : state === "done" ? "var(--accent-soft)" : "var(--surface-2)",
                    color: state === "active" ? "#fff" : state === "done" ? "var(--accent-ink)" : "var(--ink-faint)",
                    border: state ? "none" : "1px solid var(--hair)",
                  }}
                >
                  {n < step ? "✓" : n}
                </span>
                {i < STEPS.length - 1 && (
                  <span style={{ height: 3, flex: 1, borderRadius: 999, background: n < step ? "var(--accent)" : "var(--hair)" }} />
                )}
              </div>
            );
          })}
        </div>

        {error && <div className="error-banner">{error}</div>}

        {step === 1 && (
          <section>
            <h1>How much was it?</h1>
            <p className="sub">Enter the total and pick the currency. One thing at a time.</p>
            <div className="field">
              <label htmlFor="amt">Amount</label>
              <div className="two">
                <input
                  id="amt"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  style={{ fontSize: "1.6rem", fontWeight: 700 }}
                />
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ maxWidth: 110 }}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {symbolFor(c)} {c}
                    </option>
                  ))}
                </select>
              </div>
              {currency !== baseCurrency && totalCents > 0 && (
                <p className="sub" style={{ marginTop: 8 }}>
                  ≈ {money(Math.round(totalCents * rate), baseCurrency)} in {baseCurrency} (@{rate.toFixed(3)})
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="desc">What was it for?</label>
              <input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Dinner @ Luigi's" />
            </div>
            <div className="field">
              <label htmlFor="date">Date</label>
              <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1>Who paid?</h1>
            <p className="sub">Choose who covered the bill, then who splits it.</p>
            <div className="field">
              <label htmlFor="payer">Paid by</label>
              <select id="payer" value={payerId} onChange={(e) => setPayerId(Number(e.target.value))}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id === user.id ? `${m.name} (You)` : m.name}
                  </option>
                ))}
              </select>
            </div>
            <label>Split between</label>
            <div style={{ display: "grid", gap: 8 }}>
              {members.map((m) => {
                const on = chosen.has(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggle(m.id)}
                    className="card"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "11px 14px",
                      cursor: "pointer",
                      border: on ? "1px solid var(--accent)" : "1px solid var(--glass-border)",
                      background: on ? "var(--accent-soft)" : "var(--surface)",
                      font: "inherit",
                      color: "var(--ink)",
                      textAlign: "left",
                    }}
                  >
                    <span className={`mini${m.id === user.id ? " you" : ""}`}>{initials(m.name)}</span>
                    <span style={{ fontWeight: 600 }}>{m.id === user.id ? `${m.name} (You)` : m.name}</span>
                    <span style={{ marginLeft: "auto", color: on ? "var(--accent)" : "var(--ink-faint)" }}>
                      {on ? <Check width="20" height="20" /> : "○"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <h1>How should it split?</h1>
            <p className="sub">
              {description || "This expense"} · {money(totalCents, currency)} · paid by{" "}
              {payerId === user.id ? "You" : payerName}
            </p>

            <div style={{ display: "flex", gap: 4, background: "var(--surface-2)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-sm)", padding: 4, marginBottom: 20 }}>
              {[
                ["equal", "Equal"],
                ["exact", "Exact amounts"],
                ["percent", "Percentages"],
              ].map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  aria-pressed={splitType === val}
                  onClick={() => setSplitType(val)}
                  style={{
                    flex: 1,
                    border: splitType === val ? "1px solid var(--accent)" : "1px solid transparent",
                    background: splitType === val ? "var(--accent-soft)" : "transparent",
                    color: splitType === val ? "var(--accent-ink)" : "var(--ink-soft)",
                    fontWeight: 600,
                    padding: 10,
                    borderRadius: 10,
                    cursor: "pointer",
                    font: "inherit",
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>

            <div className="card">
              {participants.map((m, i) => {
                const equalEach = splitType === "equal" ? splitEqualCents(totalCents, participants.length)[i] : null;
                return (
                  <div className="row-line" key={m.id}>
                    <span className={`mini${m.id === user.id ? " you" : ""}`}>{initials(m.name)}</span>
                    <span style={{ fontWeight: 600 }}>{m.id === user.id ? `${m.name} (You)` : m.name}</span>
                    <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                      {splitType === "equal" && <b>{money(equalEach, currency)}</b>}
                      {splitType === "exact" && (
                        <>
                          <span style={{ color: "var(--ink-faint)" }}>{sym}</span>
                          <input
                            style={{ width: 90, textAlign: "right", padding: "8px 10px", boxShadow: "none" }}
                            inputMode="decimal"
                            value={exact[m.id] || ""}
                            onChange={(e) => setExact((x) => ({ ...x, [m.id]: e.target.value }))}
                            aria-label={`${m.name} amount`}
                          />
                        </>
                      )}
                      {splitType === "percent" && (
                        <>
                          <input
                            style={{ width: 74, textAlign: "right", padding: "8px 10px", boxShadow: "none" }}
                            inputMode="decimal"
                            value={percent[m.id] || ""}
                            onChange={(e) => setPercent((x) => ({ ...x, [m.id]: e.target.value }))}
                            aria-label={`${m.name} percent`}
                          />
                          <span style={{ color: "var(--ink-faint)" }}>%</span>
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            <p
              className="card pad"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 14,
                fontWeight: 600,
                color: validity.ok ? "var(--pos)" : "var(--neg)",
              }}
            >
              <span style={{ width: 16, height: 16, display: "inline-flex" }}>
                {validity.ok ? <Check /> : <Warn />}
              </span>
              {validity.msg}
            </p>
          </section>
        )}

        {step === 4 && (
          <section>
            <h1>Look right?</h1>
            <p className="sub">A quick check before you post it.</p>
            <div className="card">
              <div style={{ textAlign: "center", padding: "22px 0 18px", borderBottom: "1px solid var(--hair)" }}>
                <p className="amount" style={{ fontSize: "2.4rem", margin: 0 }}>
                  {money(totalCents, currency)}
                </p>
                <p className="sub" style={{ margin: "2px 0 0" }}>
                  {description}
                </p>
              </div>
              {[
                ["Date", date],
                ["Paid by", payerId === user.id ? `${payerName} (You)` : payerName],
                ["Split type", splitType],
                ["Split between", participants.map((m) => m.name.split(" ")[0]).join(", ")],
                ["Currency", currency],
              ].map(([k, v]) => (
                <div className="row-line" key={k}>
                  <span className="sub" style={{ margin: 0 }}>
                    {k}
                  </span>
                  <span style={{ marginLeft: "auto", fontWeight: 600, textTransform: k === "Split type" ? "capitalize" : "none" }}>
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="actions">
        <div className="actions-inner">
          <button className="btn ghost" onClick={() => (step === 1 ? navigate("/") : go(-1))} style={{ flex: "0 0 auto", minWidth: 96 }}>
            {step === 1 ? "Cancel" : "Back"}
          </button>
          <button className="btn primary" onClick={() => go(1)} disabled={!canContinue || busy}>
            {step === 4 ? (busy ? "Posting…" : "Post expense") : step === 3 ? "Continue to review" : "Continue"}
          </button>
        </div>
      </div>
    </>
  );
}
