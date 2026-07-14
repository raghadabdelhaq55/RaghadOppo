import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useGroups } from "../context/GroupContext";
import TopBar from "../components/TopBar";
import { Star, Envelope, Clock, Home } from "../components/icons";
import { money, signedMoney, initials } from "../lib/format";

const ROLE_LABEL = { owner: "Owner", admin: "Admin", member: "Member" };

export default function Members() {
  const { user } = useAuth();
  const { group, currentId, refresh } = useGroups();
  const cur = group?.baseCurrency || "USD";
  const myRole = group?.role;
  const isAdmin = myRole === "owner" || myRole === "admin";
  const isOwner = myRole === "owner";

  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!currentId) return;
    const [m, r] = await Promise.all([
      api.get(`/api/groups/${currentId}/members`),
      api.get(`/api/groups/${currentId}/recurring`),
    ]);
    setMembers(m.members);
    setInvites(m.invites);
    setRecurring(r.recurring);
    setLoaded(true);
  }, [currentId]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  const run = async (fn, okNote) => {
    setBusy(true);
    setError("");
    setNote("");
    try {
      await fn();
      await load();
      await refresh();
      if (okNote) setNote(okNote);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendInvite = (e) => {
    e.preventDefault();
    const addr = email.trim();
    run(
      () => api.post(`/api/groups/${currentId}/invites`, { email: addr, origin: window.location.origin }),
      `Invite sent to ${addr} (check data/outbox.log in dev).`
    ).then(() => setEmail(""));
  };

  if (!loaded) return <div className="spinner-wrap">Loading…</div>;

  return (
    <div className="wrap narrow">
      <TopBar back={{ to: "/", label: group?.name }} />
      <h1>Members</h1>
      <p className="lede">
        {members.length} {members.length === 1 ? "person" : "people"} in {group?.name}.
      </p>
      {isOwner && (
        <span className="chip await" style={{ gap: 7 }}>
          <span style={{ width: 14, height: 14, display: "inline-flex" }}>
            <Star />
          </span>
          You're the Owner — you can invite, approve recurring charges, and manage roles.
        </span>
      )}

      {error && <div className="error-banner" style={{ marginTop: 14 }}>{error}</div>}
      {note && (
        <div className="card pad" style={{ marginTop: 14, color: "var(--pos)", fontWeight: 600 }}>
          {note}
        </div>
      )}

      <h2>People</h2>
      <div className="card">
        {members.map((m) => {
          const pos = m.balanceCents > 0;
          const isYou = m.id === user.id;
          return (
            <div className="row-line" key={m.id} style={{ padding: "15px 18px" }}>
              <span className={`mini lg${isYou ? " you" : ""}`}>{initials(m.name)}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {m.name}{" "}
                  <span
                    className="chip"
                    style={{
                      background: m.role === "member" ? "var(--surface-2)" : "var(--accent-soft)",
                      color: m.role === "member" ? "var(--ink-soft)" : "var(--accent-ink)",
                      textTransform: "uppercase",
                      fontSize: ".62rem",
                    }}
                  >
                    {ROLE_LABEL[m.role]}
                  </span>
                </div>
                <div className="sub" style={{ margin: 0 }}>
                  {m.email}
                  {isYou ? " · You" : ""}
                  {m.isShadow ? " · hasn't joined yet" : ""}
                </div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right", flex: "none" }}>
                <div className={`amt-strong ${pos ? "pos" : m.balanceCents < 0 ? "neg" : ""}`}>
                  {signedMoney(m.balanceCents, cur)}
                </div>
                <div className="sub" style={{ margin: 0, fontSize: ".72rem" }}>
                  {m.balanceCents > 0 ? "is owed" : m.balanceCents < 0 ? "owes" : "settled"}
                </div>
              </div>
              {isOwner && !isYou && m.role !== "owner" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginLeft: 10 }}>
                  <button
                    className="backlink"
                    style={{ margin: 0 }}
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        api.patch(`/api/groups/${currentId}/members/${m.id}`, {
                          role: m.role === "admin" ? "member" : "admin",
                        })
                      )
                    }
                  >
                    {m.role === "admin" ? "Make member" : "Make admin"}
                  </button>
                  <button
                    className="backlink"
                    style={{ margin: 0, color: "var(--neg)" }}
                    disabled={busy}
                    onClick={() => run(() => api.del(`/api/groups/${currentId}/members/${m.id}`))}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <>
          <h2>Invite someone</h2>
          <p className="sub">Owner &amp; admins can invite by email.</p>
          <div className="card pad">
            <form onSubmit={sendInvite} style={{ display: "flex", gap: 10 }}>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Invite email"
                required
              />
              <button className="btn primary" type="submit" disabled={busy} style={{ whiteSpace: "nowrap", flex: "none" }}>
                Send invite
              </button>
            </form>
            {invites.map((i) => (
              <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--hair)" }}>
                <span className="mini lg">
                  <Envelope />
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>{i.email}</div>
                  <div className="sub" style={{ margin: 0 }}>
                    Invited · hasn't joined yet
                  </div>
                </div>
                <button
                  className="backlink"
                  style={{ marginLeft: "auto", margin: 0, color: "var(--neg)" }}
                  disabled={busy}
                  onClick={() => run(() => api.del(`/api/groups/${currentId}/invites/${i.id}`))}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {recurring.length > 0 && (
        <>
          <h2>Recurring expenses</h2>
          <p className="sub">
            {isAdmin ? "Owner & admins approve charges before they post." : "Admins approve these before they post."}
          </p>
          {recurring.map((r) => (
            <div className="card pad" key={r.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span className="act-icon">
                  <Home />
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.description}</div>
                  <div className="sub" style={{ margin: 0 }}>
                    {money(r.amountCents, r.currency)} / {r.cadence} · {r.splitType} split
                  </div>
                </div>
                <span className="amt-strong" style={{ marginLeft: "auto", fontSize: "1.15rem" }}>
                  {money(r.amountCents, r.currency)}
                </span>
              </div>
              {r.pendingInstances.map((inst) => (
                <div key={inst.id}>
                  <span className="chip invited" style={{ marginBottom: 12 }}>
                    <span style={{ width: 14, height: 14, display: "inline-flex" }}>
                      <Clock />
                    </span>
                    {inst.dueDate} · awaiting admin approval
                  </span>
                  {isAdmin && (
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        className="btn primary"
                        style={{ flex: 1 }}
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => api.post(`/api/groups/${currentId}/recurring/${r.id}/instances/${inst.id}/approve`),
                            `${r.description} posted.`
                          )
                        }
                      >
                        Approve
                      </button>
                      <button
                        className="btn ghost"
                        style={{ flex: 1 }}
                        disabled={busy}
                        onClick={() =>
                          run(() => api.post(`/api/groups/${currentId}/recurring/${r.id}/instances/${inst.id}/skip`))
                        }
                      >
                        Skip this cycle
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {r.pendingInstances.length === 0 && <p className="sub" style={{ margin: 0 }}>Nothing pending.</p>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
