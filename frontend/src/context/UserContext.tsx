"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

const API = "/api/v1";

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  role?: string;
  avatar?: string;
  onboarding_completed?: boolean;
  learning_goal?: string;
  preferred_style?: string;
  last_onboarding_step?: number;
  [key: string]: any;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  refetchUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if token exists before making request
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('access_token');
        if (!token) {
          setUser(null);
          setLoading(false);
          return;
        }
      }
      
      const res = await api.get(`${API}/auth/me`);
      setUser(res.data);
    } catch (err: any) {
      // Handle validation errors (arrays) and detail objects
      let errorMsg = "Failed to fetch user";
      const detail = err.response?.data?.detail;
      
      if (Array.isArray(detail)) {
        // Pydantic validation errors - convert to string
        errorMsg = detail.map((e: any) => e.msg || JSON.stringify(e)).join("; ");
      } else if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (detail && typeof detail === 'object') {
        errorMsg = JSON.stringify(detail);
      }
      
      setError(errorMsg);
      setUser(null); // Ensure user is cleared on error
      console.error("Failed to fetch user:", err);
      if (err.code) console.error("Error Code:", err.code);
      if (err.config) console.error("Request Config:", err.config.url, err.config.baseURL);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const refetchUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  return (
    <UserContext.Provider value={{ user, loading, error, refetchUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
