import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useGroups } from "../context/GroupContext";
import TopBar from "../components/TopBar";
import { ArrowRight, Clock } from "../components/icons";
import { money, initials } from "../lib/format";

export default function SettleUp() {
  const { user } = useAuth();
  const { group, currentId, refresh } = useGroups();
  const cur = group?.baseCurrency || "USD";
  const [plan, setPlan] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!currentId) return;
    const d = await api.get(`/api/groups/${currentId}/settle`);
    setPlan(d.plan);
    setSettlements(d.settlements);
  }, [currentId]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  const act = async (key, fn) => {
    setBusyId(key);
    setError("");
    try {
      await fn();
      await load();
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const markPaid = (hop, i) =>
    act(`plan-${i}`, () =>
      api.post(`/api/groups/${currentId}/settlements`, {
        fromUser: hop.from,
        toUser: hop.to,
        amountCents: hop.amountCents,
      })
    );

  const confirm = (s) =>
    act(`s-${s.id}`, () => api.post(`/api/groups/${currentId}/settlements/${s.id}/confirm`));
  const dispute = (s) =>
    act(`s-${s.id}`, () => api.post(`/api/groups/${currentId}/settlements/${s.id}/dispute`));

  const pending = settlements.filter((s) => s.status === "pending");

  return (
    <div className="wrap narrow">
      <TopBar back={{ to: "/", label: group?.name }} />
      <h1>Settle up</h1>
      <p className="lede">
        {plan.length
          ? `Here's the simplest way to settle everyone — just ${plan.length} payment${plan.length > 1 ? "s" : ""}. No back-and-forth, no math.`
          : "Everyone's settled up. Nothing to pay right now."}
      </p>

      {error && <div className="error-banner">{error}</div>}

      {plan.length > 0 && (
        <>
          <h2>The plan</h2>
          <p className="sub">Fewest transactions to bring every balance to zero.</p>
          {plan.map((hop, i) => {
            const toYou = hop.to === user.id;
            const fromYou = hop.from === user.id;
            return (
              <div
                className="card"
                key={i}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", marginBottom: 12, background: toYou ? "var(--pos-soft)" : "var(--surface)" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className={`mini ${fromYou ? "you" : "neg"}`}>{initials(hop.fromName)}</span>
                  <ArrowRight />
                  <span className={`mini ${toYou ? "you" : ""}`}>{initials(hop.toName)}</span>
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {fromYou ? "You" : hop.fromName} pay{fromYou ? "" : "s"} {toYou ? "You" : hop.toName}
                  </div>
                  <div className="amt-strong" style={{ fontSize: "1.15rem" }}>
                    {money(hop.amountCents, cur)}
                  </div>
                </div>
                <button
                  className="btn primary sm"
                  style={{ marginLeft: "auto", flex: "none" }}
                  disabled={busyId === `plan-${i}`}
                  onClick={() => markPaid(hop, i)}
                >
                  {busyId === `plan-${i}` ? "…" : "Mark as paid"}
                </button>
              </div>
            );
          })}
        </>
      )}

      {pending.length > 0 && (
        <>
          <h2>Awaiting confirmation</h2>
          <p className="sub">Marked as paid — waiting on the payee to confirm receipt.</p>
          {pending.map((s) => {
            const iAmPayee = s.toUser === user.id;
            const iAmParty = iAmPayee || s.fromUser === user.id;
            return (
              <div className="card pad" key={s.id} style={{ marginBottom: 12 }}>
                <span className="chip await" style={{ marginBottom: 10 }}>
                  <span style={{ width: 12, height: 12, display: "inline-flex" }}>
                    <Clock />
                  </span>
                  Awaiting confirmation
                </span>
                <p style={{ margin: "0 0 4px" }}>
                  <b>{s.fromUser === user.id ? "You" : s.fromName}</b> marked{" "}
                  <b>{money(s.amountCents, cur)}</b> to <b>{s.toUser === user.id ? "You" : s.toName}</b> as paid.
                </p>
                <p className="sub" style={{ margin: "0 0 16px" }}>
                  {iAmPayee
                    ? "Confirm you received it to update the balances."
                    : `Waiting on ${s.toName} to confirm receipt.`}
                </p>
                {iAmParty && (
                  <div style={{ display: "flex", gap: 10 }}>
                    {iAmPayee && (
                      <button className="btn confirm" style={{ flex: 1 }} disabled={busyId === `s-${s.id}`} onClick={() => confirm(s)}>
                        Confirm received
                      </button>
                    )}
                    <button className="btn dispute" style={{ flex: 1 }} disabled={busyId === `s-${s.id}`} onClick={() => dispute(s)}>
                      Dispute
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
