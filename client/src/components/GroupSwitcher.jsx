import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGroups } from "../context/GroupContext";
import { Chevron, Check } from "./icons";
import { initials, money } from "../lib/format";

// The topbar group name button + dropdown switcher (dashboard mockup).
export default function GroupSwitcher() {
  const { groups, group, currentId, selectGroup } = useGroups();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const pick = async (id) => {
    setOpen(false);
    await selectGroup(id);
    navigate("/");
  };

  return (
    <div style={{ position: "relative", minWidth: 0 }}>
      <button
        className="group-btn"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span>{group ? group.name : "Select a group"}</span>
        <Chevron />
      </button>

      {open && (
        <div
          className="switcher"
          role="menu"
          style={{ position: "absolute", top: "100%", left: 0, zIndex: 20, minWidth: 280 }}
        >
          <p className="switcher-title">Your groups</p>
          {groups.map((g) => (
            <button
              key={g.id}
              className={`grp${g.id === currentId ? " active" : ""}`}
              role="menuitem"
              onClick={() => pick(g.id)}
            >
              <span className="g-ini" style={g.id === currentId ? { background: "var(--accent-soft)", color: "var(--accent-ink)" } : undefined}>
                {initials(g.name)}
              </span>
              <span>
                <span className="g-name">{g.name}</span>
                <br />
                <span className="g-meta">
                  {g.memberCount} members
                  {g.netCents ? ` · you're ${g.netCents > 0 ? "owed" : "down"} ${money(Math.abs(g.netCents), g.baseCurrency)}` : ""}
                </span>
              </span>
              {g.id === currentId && <Check className="check" width="18" height="18" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
