import { useState } from "react";
import { api } from "../api";
import { useGroups } from "../context/GroupContext";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];

// Small inline form to create a group. Calls onDone(id) after creating.
export default function CreateGroup({ onDone }) {
  const { loadGroups, selectGroup } = useGroups();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d = await api.post("/api/groups", { name, baseCurrency: currency });
      await loadGroups();
      await selectGroup(d.group.id);
      if (onDone) onDone(d.group.id);
      setName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card pad" onSubmit={submit}>
      {error && <div className="error-banner">{error}</div>}
      <div className="field">
        <label htmlFor="gname">Group name</label>
        <input id="gname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maple St. Apartment" required />
      </div>
      <div className="field">
        <label htmlFor="gcur">Base currency</label>
        <select id="gcur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <button className="btn primary block" type="submit" disabled={busy || !name.trim()}>
        {busy ? "Creating…" : "Create group"}
      </button>
    </form>
  );
}
