import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import * as authService from '../services/authService';
import { invalidateAsyncCache } from '../hooks/useAsync';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.getCurrentUser());

  const login = useCallback(async (identifier, password, role) => {
    const u = await authService.login(identifier, password, role);
    if (user?.id !== u.id) invalidateAsyncCache();
    setUser(u);
    return u;
  }, [user]);

  const logout = useCallback(() => {
    try {
      authService.logout();
    } finally {
      invalidateAsyncCache();
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
