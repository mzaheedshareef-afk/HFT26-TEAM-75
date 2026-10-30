import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authService } from '../services/authService';
import type { AuthSession, AuthUser } from '../types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  establishSession: (session: AuthSession) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() =>
    authService.getStoredSession()
  );

  useEffect(() => {
    const handleUnauthorized = () => {
      setSession(null);
    };
    window.addEventListener('gatecode:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('gatecode:unauthorized', handleUnauthorized);
    };
  }, []);

  const establishSession = useCallback((nextSession: AuthSession) => {
    authService.saveSession(nextSession);
    setSession(nextSession);
  }, []);

  const logout = useCallback(() => {
    authService.clearSession();
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        accessToken: session?.accessToken ?? null,
        isAuthenticated: Boolean(session?.accessToken && session?.user),
        establishSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

