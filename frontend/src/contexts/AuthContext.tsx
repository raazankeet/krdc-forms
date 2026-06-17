import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { apiService } from '../services/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount — check if session exists via httpOnly cookie
  useEffect(() => {
    apiService
      .get<{ success: boolean; data: User }>('/api/v1/auth/me')
      .then((res) => {
        setUser(res.data);
      })
      .catch(() => {
        // No valid session — stay logged out
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Listen for session-expired events from the API interceptor
  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
    };
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    // Backend now returns user info + sets httpOnly cookies in one response
    const res = await apiService.post<{ success: boolean; data: User }>(
      '/api/v1/auth/login',
      { username, password },
    );
    setUser(res.data);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiService.post('/api/v1/auth/logout');
    } catch {
      // Ignore logout errors — cookies are cleared server-side
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
