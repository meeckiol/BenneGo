import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setUnauthorizedHandler } from "@/lib/api";
import { clearSession, getStoredUser, getToken, saveSession, type SessionUser } from "@/lib/session";

type AuthState = {
  user: SessionUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    (async () => {
      const [token, stored] = await Promise.all([getToken(), getStoredUser()]);
      setUser(token && stored ? stored : null);
      setLoading(false);
    })();
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    const { data } = await api.post("/auth/login", { phone: phone.trim(), password });
    if (data.user.role !== "driver") {
      throw new Error("Cette application est réservée aux chauffeurs.");
    }
    const sessionUser: SessionUser = {
      id: data.user.id, phone: data.user.phone, full_name: data.user.full_name, role: data.user.role,
    };
    await saveSession(data.token, sessionUser);
    setUser(sessionUser);
  }, []);

  const logout = useCallback(async () => {
    try { await api.patch("/drivers/availability", { is_available: false }); } catch { /* hors-ligne : on déconnecte quand même */ }
    await clearSession();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, isAuthenticated: !!user, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
