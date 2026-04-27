import { useState, useEffect } from "react";

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

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      fetchHUD();
      syncHeartbeat();
    } else {
      setLoading(false);
    }
  }, []);

  async function syncHeartbeat() {
    try {
      await api.post(`${API}/learn/heart-beat`);
    } catch (e: any) {
      // Silently fail - endpoint may not exist in all deployments
      if (e.response?.status !== 404) {
        console.debug("Heartbeat sync error:", e.response?.status);
      }
    }
  }

  async function fetchHUD() {
    try {
      const res = await api.get(`${API}/learn/hud`);
      setHud(res.data);
    } catch (e: any) {
      // Gracefully handle missing gamification endpoint
      if (e.response?.status === 404) {
        console.debug("Gamification HUD endpoint not available");
      } else {
        console.debug("Failed to fetch gamification HUD:", e.response?.status);
      }
      // Don't treat this as a fatal error
      setHud(null);
    } finally {
      setLoading(false);
    }
  }

  return { hud, loading, refresh: fetchHUD };
}
