import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useGroups } from "../context/GroupContext";
import TopBar from "../components/TopBar";
import { Plus, Swap, ArrowRight, Home } from "../components/icons";
import { money, signedMoney, initials, symbolFor } from "../lib/format";
import CreateGroup from "../components/CreateGroup";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { group, currentId, groups, loading } = useGroups();
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    if (!currentId) return;
    api
      .get(`/api/groups/${currentId}/expenses`)
      .then((d) => setExpenses(d.expenses))
      .catch(() => setExpenses([]));
  }, [currentId, group]);

  if (loading) return <div className="spinner-wrap">Loading…</div>;

  if (!groups.length) {
    return (
      <div className="wrap">
        <TopBar />
        <h1>Welcome, {user.name.split(" ")[0]}</h1>
        <p className="lede">You're not in any groups yet. Create one to start splitting.</p>
        <CreateGroup />
        <button className="backlink" onClick={logout}>
          Sign out
        </button>
      </div>
    );
  }

  const cur = group?.baseCurrency || "USD";
  const net = group?.netCents || 0;
  const netColor = net > 0 ? "var(--pos)" : net < 0 ? "var(--neg)" : "var(--ink)";

  return (
    <>
      <div className="wrap">
        <TopBar />

        <div className="balance">
          <p className="label">Your position in {group?.name}</p>
          <p className="amount" style={{ color: netColor }}>
            {signedMoney(net, cur)}
          </p>
          <p className="reassure">
            {net > 0
              ? "You're owed overall — nothing to pay right now."
              : net < 0
                ? "You owe overall — settle up when you're ready."
                : "You're all settled up. "}
          </p>
        </div>

        <h2>Who owes whom</h2>
        <div className="card">
          {group?.plan?.length ? (
            group.plan.map((p, i) => {
              const toYou = p.to === user.id;
              return (
                <div className="row-line" key={i}>
                  <span className={`mini ${toYou ? "pos" : "neg"}`}>{initials(p.fromName)}</span>
                  <span>
                    {p.from === user.id ? "You" : p.fromName}{" "}
                    <ArrowRight width="13" height="13" style={{ verticalAlign: "middle", color: "var(--ink-faint)" }} />{" "}
                    {toYou ? "You" : p.toName}
                  </span>
                  <span className={`amt-strong ${toYou ? "pos" : ""}`} style={{ marginLeft: "auto" }}>
                    {money(p.amountCents, cur)}
                  </span>
                </div>
              );
            })
          ) : (
            <p className="empty">Everyone's settled up. 🎉</p>
          )}
        </div>

        <h2>Recent activity</h2>
        <div className="card">
          {expenses.length ? (
            expenses.map((e) => (
              <div className="act-row" key={e.id}>
                <span className="act-icon">
                  <Home />
                </span>
                <div className="act-main">
                  <div className="act-title">
                    {e.description || "(no description)"}{" "}
                    {e.currency !== cur && (
                      <span className="chip fx">
                        {symbolFor(e.currency)}→{symbolFor(cur)} @{e.rateToBase.toFixed(3)}
                      </span>
                    )}
                  </div>
                  <div className="act-sub">
                    {e.payerName} paid · {e.splitType} split · {e.shares.length} way
                    {e.shares.length > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="act-right">
                  <div className="act-amt">{money(e.amountCents, e.currency)}</div>
                  {e.currency !== cur && (
                    <div className="act-share">≈ {money(e.baseAmountCents, cur)}</div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="empty">No expenses yet — add the first one below.</p>
          )}
        </div>

        <p style={{ marginTop: 20 }}>
          <Link className="backlink" to="/members">
            Members & settings →
          </Link>
          {"  "}
          <button className="backlink" onClick={logout} style={{ marginLeft: 12 }}>
            Sign out
          </button>
        </p>
      </div>

      <div className="actions">
        <div className="actions-inner">
          <Link className="btn primary" to="/add">
            <Plus />
            Add expense
          </Link>
          <Link className="btn ghost" to="/settle">
            <Swap />
            Settle up
          </Link>
        </div>
      </div>
    </>
  );
}
