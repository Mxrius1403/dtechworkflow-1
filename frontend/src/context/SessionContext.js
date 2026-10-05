import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useData } from "./DataContext";

const SessionContext = createContext(null);
const STORAGE_KEY = "dt-demo-persona";

const readPersona = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
};

/** Demo sign-in: the chosen persona (staff member or driver) decides which screens are available. */
export function SessionProvider({ children }) {
  const { byId } = useData();
  const [persona, setPersona] = useState(readPersona);

  const signIn = useCallback((next) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setPersona(next);
  }, []);
  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPersona(null);
  }, []);

  const value = useMemo(() => {
    const staff = persona?.kind === "staff" ? byId.users[persona.id] : null;
    const driver = persona?.kind === "driver" ? byId.drivers[persona.id] : null;
    const user = staff && { ...staff, isOwner: staff.role === "owner", isManager: ["owner", "manager"].includes(staff.role) };
    return { user, driver, signIn, signOut };
  }, [persona, byId, signIn, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
