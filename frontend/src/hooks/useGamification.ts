import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API_BASE_URL, api } from "@/lib/api";

const API = `${API_BASE_URL}/api/v1`;

export interface GamificationHUD {
  total_xp: number;
  level: number;
  current_streak: number;
  hearts: number;
  xp_to_next_level: number;
  progress_percent: number;
}

export function useGamification() {
  const [hud, setHud] = useState<GamificationHUD | null>(null);
  const [loading, setLoading] = useState(true);

  const syncHeartbeat = useCallback(async (signal?: AbortSignal) => {
    try {
      await api.post(`${API}/learn/heart-beat`, null, { signal });
    } catch (e: any) {
      if (axios.isCancel(e)) return;
      // Silently fail - endpoint may not exist in all deployments
      if (e.response?.status !== 404) {
        console.debug("Heartbeat sync error:", e.response?.status);
      }
    }
  }, []);

  const fetchHUD = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await api.get(`${API}/learn/hud`, { signal });
      setHud(res.data);
    } catch (e: any) {
      if (axios.isCancel(e)) return;
      // Gracefully handle missing gamification endpoint
      if (e.response?.status === 404) {
        console.debug("Gamification HUD endpoint not available");
      } else {
        console.debug("Failed to fetch gamification HUD:", e.response?.status);
      }
      // Don't treat this as a fatal error
      setHud(null);
    } finally {
      // Avoid state updates if aborted
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const controller = new AbortController();
    if (token) {
      fetchHUD(controller.signal);
      syncHeartbeat(controller.signal);
    } else {
      setLoading(false);
    }
    return () => {
      controller.abort();
    };
  }, [fetchHUD, syncHeartbeat]);

  return { hud, loading, refresh: fetchHUD };
}
