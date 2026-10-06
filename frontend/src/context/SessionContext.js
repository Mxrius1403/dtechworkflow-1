import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchCurrentUser, login as requestLogin, logout as requestLogout } from "@/lib/api";
import { notifyError } from "@/lib/notify";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    fetchCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch((requestError) => {
        if (active && requestError.response?.status !== 401) setError(requestError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const signIn = useCallback(async (credentials) => {
    const authenticatedUser = await requestLogin(credentials);
    setError(null);
    setUser(authenticatedUser);
    return authenticatedUser;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await requestLogout();
      setUser(null);
      setError(null);
      queryClient.clear();
    } catch {
      notifyError("Could not sign out. Check your connection and try again.");
    }
  }, [queryClient]);

  const value = useMemo(() => ({ user, loading, error, signIn, signOut }), [user, loading, error, signIn, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
