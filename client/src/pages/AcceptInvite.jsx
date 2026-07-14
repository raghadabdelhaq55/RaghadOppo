import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useGroups } from "../context/GroupContext";
import TopBar from "../components/TopBar";

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { selectGroup, refresh } = useGroups();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get(`/api/invites/${token}`)
      .then(setInvite)
      .catch((e) => setError(e.message));
  }, [token]);

  const accept = async () => {
    setBusy(true);
    setError("");
    try {
      const d = await api.post("/api/invites/accept", { token });
      await refresh();
      await selectGroup(d.groupId);
      navigate("/");
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="wrap narrow">
      <TopBar back={{ to: "/", label: "Home" }} />
      <h1>Group invite</h1>
      {error && <div className="error-banner">{error}</div>}
      {invite ? (
        <div className="card pad">
          <p className="lede">
            You've been invited to join <b>{invite.groupName}</b>.
          </p>
          <button className="btn primary block" onClick={accept} disabled={busy}>
            {busy ? "Joining…" : `Join ${invite.groupName}`}
          </button>
        </div>
      ) : (
        !error && <p className="empty">Looking up your invite…</p>
      )}
    </div>
  );
}
