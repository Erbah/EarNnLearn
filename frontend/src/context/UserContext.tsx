"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { api, setClientToken, getClientToken } from "@/lib/api";
import axios from "axios";

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
  is_beta_user?: boolean;
  isBetaUser?: boolean;
  seller_percentage?: number;
  activation_price?: number;
  min_withdrawal?: number;
  withdrawal_fee?: number;
  default_currency?: string;
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

  const fetchUser = useCallback(async (signal?: AbortSignal, isBackground: boolean = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      setError(null);
      
      // Bootstrap token if not already in memory
      if (!getClientToken()) {
        try {
          const tokenRes = await api.get(`${API}/auth/token`, { signal });
          if (tokenRes.data?.access_token) {
            setClientToken(tokenRes.data.access_token);
          }
        } catch (e) {
          setClientToken(null);
          setUser(null);
          setLoading(false);
          return;
        }
      }
      
      const res = await api.get(`${API}/auth/me`, { signal });
      const userData = res.data;
      if (userData) {
        const normalized: any = { ...userData };
        const mappings: [string, string][] = [
          ['isBetaUser', 'is_beta_user'],
          ['productCodes', 'product_codes'],
          ['sellerPercentage', 'seller_percentage'],
          ['activationPrice', 'activation_price'],
          ['minWithdrawal', 'min_withdrawal'],
          ['withdrawalFee', 'withdrawal_fee'],
          ['defaultCurrency', 'default_currency'],
          ['onboardingCompleted', 'onboarding_completed'],
          ['lastOnboardingStep', 'last_onboarding_step']
        ];
        for (const [camel, snake] of mappings) {
          if (userData[camel] !== undefined && userData[snake] === undefined) {
            normalized[snake] = userData[camel];
          }
          if (userData[snake] !== undefined && userData[camel] === undefined) {
            normalized[camel] = userData[snake];
          }
        }
        setUser(normalized);
      } else {
        setUser(null);
      }
    } catch (err: any) {
      if (axios.isCancel(err)) return;
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
    const controller = new AbortController();
    fetchUser(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchUser]);

  const refetchUser = useCallback(async () => {
    await fetchUser(undefined, true);
  }, [fetchUser]);

  const contextValue = useMemo(() => ({
    user,
    loading,
    error,
    refetchUser
  }), [user, loading, error, refetchUser]);

  return (
    <UserContext.Provider value={contextValue}>
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
