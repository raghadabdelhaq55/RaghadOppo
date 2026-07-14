import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "./ThemeToggle";
import GroupSwitcher from "./GroupSwitcher";
import { Logo, Back } from "./icons";
import { initials } from "../lib/format";

// Dashboard-style top bar: logo + group switcher on the left, theme + avatar
// on the right. When `back` is set, shows a back link to the group instead.
export default function TopBar({ back }) {
  const { user } = useAuth();
  return (
    <div className="topbar">
      <div className="top-left">
        {back ? (
          <Link className="close" to={back.to}>
            <Back />
            {back.label}
          </Link>
        ) : (
          <>
            <Logo />
            <GroupSwitcher />
          </>
        )}
      </div>
      <div className="top-right">
        <ThemeToggle />
        {user && (
          <span className="avatar" title={user.name}>
            {initials(user.name)}
          </span>
        )}
      </div>
    </div>
  );
}
