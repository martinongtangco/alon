import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { apiFetch, setAccessToken } from '../lib/api';
import { AuthContext } from './auth-context';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  
  // Login State
  const [loginStep, setLoginStep] = useState<1 | 2>(1);
  const [tempToken, setTempToken] = useState<string | null>(null);

  // Attempt silent refresh on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const data = await apiFetch('/auth/refresh', { method: 'POST' });
        setAccessToken(data.token);
        setRole(data.role);
        setIsAuthenticated(true);
      } catch {
        setAccessToken(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  // Periodic refresh (every 10 mins since token lives 15m)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const interval = setInterval(async () => {
      try {
        const data = await apiFetch('/auth/refresh', { method: 'POST' });
        setAccessToken(data.token);
        setRole(data.role);
      } catch {
        // Refresh failed (e.g. cookie expired), log them out
        setAccessToken(null);
        setIsAuthenticated(false);
        setRole(null);
      }
    }, 10 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const loginCredentials = async (email: string, password: string) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (data.totp_required) {
      setTempToken(data.tempToken);
      setLoginStep(2);
    } else {
      setAccessToken(data.token);
      setRole(data.role);
      setIsAuthenticated(true);
      setLoginStep(1);
    }
  };

  const loginTotp = async (code: string) => {
    if (!tempToken) throw new Error("Missing temp token");
    
    const data = await apiFetch('/auth/totp', {
      method: 'POST',
      body: JSON.stringify({ tempToken, code })
    });

    setAccessToken(data.token);
    setRole(data.role);
    setIsAuthenticated(true);
    setTempToken(null);
    setLoginStep(1);
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors on logout
    } finally {
      setAccessToken(null);
      setIsAuthenticated(false);
      setRole(null);
      setLoginStep(1);
      setTempToken(null);
    }
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isLoading,
      role,
      loginStep,
      tempToken,
      loginCredentials,
      loginTotp,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};
