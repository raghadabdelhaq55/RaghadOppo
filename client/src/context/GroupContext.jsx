import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { useAuth } from "./AuthContext";

const GroupContext = createContext(null);
export const useGroups = () => useContext(GroupContext);

const STORE_KEY = "bs-current-group";

export function GroupProvider({ children }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [currentId, setCurrentId] = useState(() => {
    const saved = Number(localStorage.getItem(STORE_KEY));
    return saved || null;
  });
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadGroups = useCallback(async () => {
    const d = await api.get("/api/groups");
    setGroups(d.groups);
    return d.groups;
  }, []);

  const loadGroup = useCallback(async (id) => {
    if (!id) {
      setGroup(null);
      return null;
    }
    const d = await api.get(`/api/groups/${id}`);
    setGroup(d);
    return d;
  }, []);

  // Initial load (and reload when the signed-in user changes).
  useEffect(() => {
    if (!user) {
      setGroups([]);
      setGroup(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadGroups()
      .then((gs) => {
        const valid = gs.find((g) => g.id === currentId) ? currentId : gs[0]?.id || null;
        setCurrentId(valid);
        return loadGroup(valid);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const selectGroup = useCallback(
    async (id) => {
      setCurrentId(id);
      localStorage.setItem(STORE_KEY, String(id));
      await loadGroup(id);
    },
    [loadGroup]
  );

  // Reload everything for the current group (call after a mutation).
  const refresh = useCallback(async () => {
    await loadGroups();
    await loadGroup(currentId);
  }, [loadGroups, loadGroup, currentId]);

  useEffect(() => {
    if (currentId) localStorage.setItem(STORE_KEY, String(currentId));
  }, [currentId]);

  return (
    <GroupContext.Provider
      value={{ groups, group, currentId, loading, selectGroup, refresh, loadGroups, setCurrentId }}
    >
      {children}
    </GroupContext.Provider>
  );
}
