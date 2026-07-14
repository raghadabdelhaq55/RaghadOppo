import { useEffect, useState } from "react";
import { Sun } from "./icons";

function systemDark() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Toggles data-theme on <html>, persisted in localStorage. Applied eagerly in
// main.jsx so there's no flash before React mounts.
export default function ThemeToggle() {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || (systemDark() ? "dark" : "light")
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("bs-theme", theme);
  }, [theme]);

  return (
    <button
      className="toggle"
      type="button"
      aria-label="Toggle color theme"
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
    >
      <Sun />
      <span>{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}
