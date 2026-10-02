import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi } from "../api";
import { setToken, getToken } from "../api/client";
import { appStore } from "../api/appStore";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [perms, setPerms] = useState([]);
  const [loading, setLoading] = useState(true);
  // Set when the saved data couldn't be loaded — the app must not run on an
  // empty store, or it would look like everything was lost.
  const [storeError, setStoreError] = useState(null);

  const loadStore = useCallback(async () => {
    try {
      await appStore.hydrate();
      setStoreError(null);
    } catch (e) {
      setStoreError(e?.message || "Could not load saved data");
    }
  }, []);

  // On boot, if a token exists, fetch the current user
  useEffect(() => {
    (async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const res = await authApi.me();
        await loadStore();
        setUser(res.data.user);
        setPerms(res.data.perms || []);
      } catch {
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadStore]);

  // A successful sign-in (after the password, or after the one-time code).
  const startSession = useCallback(async (data) => {
    setToken(data.token);
    await loadStore();
    setUser(data.user);
    setPerms(data.user?.userType?.perms || []);
    return data.user;
  }, [loadStore]);

  // Returns the user — or { otpRequired, challenge, sentTo } when a one-time code is needed first.
  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password);
    if (res.data.otpRequired) return res.data;
    return startSession(res.data);
  }, [startSession]);

  const verifyOtp = useCallback(async (challenge, code) => {
    const res = await authApi.verifyOtp(challenge, code);
    return startSession(res.data);
  }, [startSession]);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await authApi.changePassword(currentPassword, newPassword);
    setUser((u) => (u ? { ...u, mustChangePassword: false } : u));
  }, []);

  const logout = useCallback(() => {
    appStore.reset();
    setToken(null);
    setUser(null);
    setPerms([]);
  }, []);

  // permission check: can(module, action)
  const can = useCallback(
    (module, action = "view") => {
      const p = perms.find((x) => x.module === module);
      return !!p && !!p[action];
    },
    [perms]
  );

  return (
    <AuthContext.Provider value={{ user, perms, loading, login, verifyOtp, changePassword, logout, can, storeError, retryStore: loadStore }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
