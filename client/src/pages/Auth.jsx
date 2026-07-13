import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
import { Logo } from "../components/icons";

export default function Auth() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", password2: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (mode === "signup" && form.password !== form.password2) {
      return setError("Passwords don't match.");
    }
    setBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await signup(form.name, form.email, form.password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="topbar" style={{ maxWidth: 560, width: "100%", margin: "0 auto", padding: "20px 22px" }}>
        <div className="brand">
          <Logo />
          Bill Splitter
        </div>
        <ThemeToggle />
      </div>

      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 22px 64px" }}>
        <div style={{ maxWidth: 400, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 26 }}>
            <span className="chip await" style={{ marginBottom: 14, display: "inline-flex" }}>
              Bill Splitter v2
            </span>
            <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
            <p className="sub" style={{ marginBottom: 0 }}>
              {mode === "login"
                ? "Sign in to your groups."
                : "A few calm steps and you're splitting bills in seconds."}
            </p>
          </div>

          <form className="card pad" onSubmit={submit}>
            <div className="tabs" role="tablist" style={{ display: "flex", gap: 4, background: "var(--surface-2)", border: "1px solid var(--glass-border)", borderRadius: 999, padding: 4, marginBottom: 22 }}>
              {["login", "signup"].map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => {
                    setMode(m);
                    setError("");
                  }}
                  style={{
                    flex: 1,
                    border: "none",
                    background: mode === m ? "var(--accent-soft)" : "transparent",
                    color: mode === m ? "var(--accent-ink)" : "var(--ink-soft)",
                    fontWeight: 700,
                    padding: 9,
                    borderRadius: 999,
                    cursor: "pointer",
                    boxShadow: "none",
                    font: "inherit",
                  }}
                >
                  {m === "login" ? "Sign in" : "Sign up"}
                </button>
              ))}
            </div>

            {error && <div className="error-banner">{error}</div>}

            {mode === "signup" && (
              <div className="field">
                <label htmlFor="name">Your name</label>
                <input id="name" type="text" placeholder="Raghad Abdelhaq" value={form.name} onChange={set("name")} autoComplete="name" />
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" placeholder="you@example.com" value={form.email} onChange={set("email")} autoComplete="email" required />
            </div>
            <div className="field">
              <label htmlFor="pw">Password</label>
              <input id="pw" type="password" placeholder="••••••••" value={form.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} required />
            </div>
            {mode === "signup" && (
              <div className="field">
                <label htmlFor="pw2">Confirm password</label>
                <input id="pw2" type="password" placeholder="••••••••" value={form.password2} onChange={set("password2")} autoComplete="new-password" required />
              </div>
            )}

            <button className="btn primary block" type="submit" disabled={busy}>
              {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="sub" style={{ textAlign: "center", marginTop: 18 }}>
            <b style={{ color: "var(--ink)" }}>New in v2:</b> personal accounts — your groups follow you across devices.
          </p>
        </div>
      </main>
    </div>
  );
}
