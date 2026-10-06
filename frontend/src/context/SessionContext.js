import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchCurrentUser, fetchSetupStatus, login as requestLogin, logout as requestLogout, setupOwner as requestOwnerSetup, transferOwnership as requestOwnershipTransfer } from "@/lib/api";
import { notifyError } from "@/lib/notify";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [setupRequired, setSetupRequired] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchCurrentUser().catch((requestError) => {
        if (requestError.response?.status === 401) return null;
        throw requestError;
      }),
      fetchSetupStatus(),
    ])
      .then(([currentUser, isSetupRequired]) => {
        if (active) {
          setUser(currentUser);
          setSetupRequired(isSetupRequired);
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError);
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
    setSetupRequired(false);
    return authenticatedUser;
  }, []);

  const createOwner = useCallback(async (details) => {
    const authenticatedUser = await requestOwnerSetup(details);
    setError(null);
    setUser(authenticatedUser);
    setSetupRequired(false);
    return authenticatedUser;
  }, []);

  const transferOwnership = useCallback(async (managerId) => {
    const updatedUser = await requestOwnershipTransfer(managerId);
    setUser(updatedUser);
    return updatedUser;
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

  const value = useMemo(() => ({ user, loading, error, setupRequired, signIn, createOwner, transferOwnership, signOut }), [user, loading, error, setupRequired, signIn, createOwner, transferOwnership, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
