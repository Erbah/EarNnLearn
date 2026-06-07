"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Bell, User, Home } from "lucide-react";
import { useGamification } from "@/hooks/useGamification";
import { useUser } from "@/context/UserContext";
import { motion } from "framer-motion";
import { API_BASE_URL } from "@/lib/api";

const API = `${API_BASE_URL}/api/v1`;

export const Topbar = React.memo(function Topbar() {
  const router = useRouter();
  const SHOW_HEARTS = false; // Set to true to re-enable heart system UI
  const { hud, loading: hudLoading } = useGamification();
  const { user } = useUser();

  const handleNotificationsClick = useCallback(() => {
    alert("Notifications coming soon!");
  }, []);

  const handleProfileClick = useCallback(() => {
    router.push("/settings");
  }, [router]);

  return (
    <header className="h-20 w-full flex items-center justify-between px-8 bg-background/80 backdrop-blur-md sticky top-0 z-40 border-b border-white/5">
      <div className="flex-1 flex items-center">
        <div className="relative w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search network, transactions, or courses..."
            className="w-full bg-card/50 border border-white/10 rounded-full py-2.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-medium"
          />
        </div>
      </div>

      <div className="flex items-center space-x-6">
        {/* Gamification Stats */}
        <div className="hidden lg:flex items-center gap-4 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 shadow-inner group/hud">
          {hud ? (
            <>
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="flex items-center gap-1.5 cursor-help"
                title="Daily Streak"
              >
                <span className="text-orange-500 font-bold text-sm drop-shadow-[0_0_5px_rgba(249,115,22,0.3)]">🔥</span>
                <span className="text-white text-xs font-black tracking-tight">{hud.current_streak}</span>
              </motion.div>

              <div className="w-[1px] h-3 bg-white/10" />

              <div className="flex flex-col gap-0.5 min-w-[70px]" title={`XP: ${hud.total_xp} / ${hud.xp_to_next_level}`}>
                <div className="flex justify-between items-center text-[9px] font-black text-primary uppercase tracking-tighter">
                  <span>PROGRESS</span>
                  <span>LVL {hud.level}</span>
                </div>
                <div className="w-full bg-background/50 rounded-full h-1.5 overflow-hidden p-0.5 border border-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${hud.progress_percent}%` }}
                    className="h-full bg-gradient-to-r from-primary to-blue-500 rounded-full shadow-[0_0_10px_rgba(0,224,255,0.4)]"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex gap-2 items-center text-gray-600">
              <div className="w-16 h-2 bg-white/5 animate-pulse rounded" />
            </div>
          )}
        </div>

        <Link
          href="/"
          className="p-2 rounded-full hover:bg-white/5 transition-colors group"
          title="Back to Landing Page"
        >
          <Home className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
        </Link>

        <button
          onClick={handleNotificationsClick}
          className="relative p-2 rounded-full hover:bg-white/5 transition-colors group cursor-pointer"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(0,224,255,0.8)]"></span>
        </button>
        <div className="h-8 w-[1px] bg-white/10"></div>
        <button
          onClick={handleProfileClick}
          className="flex items-center space-x-3 hover:opacity-80 transition-opacity cursor-pointer"
          aria-label="User Profile"
          title="User Profile"
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center p-0.5">
            <div className="w-full h-full rounded-full bg-card flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="text-left hidden md:block">
            <p className="text-sm font-medium text-white leading-tight">
              {user?.name || "Member"}
            </p>
            <p className="text-xs text-secondary font-medium leading-tight mt-0.5 capitalize">
              {user?.tier_type || "Standard"} Member
            </p>
          </div>
        </button>
      </div>
    </header>
  );
});
