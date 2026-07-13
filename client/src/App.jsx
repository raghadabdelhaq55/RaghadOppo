import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AddExpense from "./pages/AddExpense";
import SettleUp from "./pages/SettleUp";
import Members from "./pages/Members";
import AcceptInvite from "./pages/AcceptInvite";

function Loading() {
  return <div className="spinner-wrap">Loading…</div>;
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? <Loading /> : user ? <Navigate to="/" replace /> : <Auth />}
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/add"
        element={
          <RequireAuth>
            <AddExpense />
          </RequireAuth>
        }
      />
      <Route
        path="/settle"
        element={
          <RequireAuth>
            <SettleUp />
          </RequireAuth>
        }
      />
      <Route
        path="/members"
        element={
          <RequireAuth>
            <Members />
          </RequireAuth>
        }
      />
      <Route
        path="/invite/:token"
        element={
          <RequireAuth>
            <AcceptInvite />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
