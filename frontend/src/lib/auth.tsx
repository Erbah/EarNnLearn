"use client";

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setClientToken, getClientToken, api } from './api';

interface AuthContextType {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const stored = getClientToken();
    if (stored) {
      setToken(stored);
    }
  }, []);

  const login = (newToken: string) => {
    setClientToken(newToken);
    setToken(newToken);
    router.push('/dashboard');
  };

  const logout = async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch (e) {
      console.error("Logout request failed", e);
    }
    setClientToken(null);
    setToken(null);
    document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
