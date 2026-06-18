"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Bell, User, Home, Menu, Check, CheckCircle2 } from "lucide-react";
import { useGamification } from "@/hooks/useGamification";
import { useUser } from "@/context/UserContext";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL, api } from "@/lib/api";
import { useSidebar } from "@/components/Sidebar";

const API = `${API_BASE_URL}/api/v1`;

export const Topbar = React.memo(function Topbar() {
  const { toggle: toggleSidebar } = useSidebar();
  const router = useRouter();
  const SHOW_HEARTS = false; // Set to true to re-enable heart system UI
  const { hud, loading: hudLoading } = useGamification();
  const { user } = useUser();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get(`${API}/users/me/notifications?limit=15`);
      setNotifications(res.data);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Optional polling or websocket could go here
    }
  }, [user, fetchNotifications]);

  const handleNotificationsClick = useCallback(() => {
    setShowNotifications(prev => !prev);
  }, []);

  const markAsRead = async (noteId: string, link: string | null) => {
    try {
      await api.post(`${API}/users/me/notifications/${noteId}/read`);
      setNotifications(prev => prev.map(n => n.id === noteId ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error(err);
    }
    if (link) {
      router.push(link);
      setShowNotifications(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post(`${API}/users/me/notifications/read-all`);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleProfileClick = useCallback(() => {
    router.push("/settings");
  }, [router]);

  return (
    <header className="h-16 lg:h-20 w-full flex items-center justify-between px-4 lg:px-8 bg-background/80 backdrop-blur-md sticky top-0 z-40 border-b border-white/5">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex-shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Search bar */}
        <div className="relative flex-1 max-w-xs lg:max-w-md group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full bg-card/50 border border-white/10 rounded-full py-2 pl-10 pr-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-medium"
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

        <div className="relative">
          <button
            onClick={handleNotificationsClick}
            className={`relative p-2 rounded-full transition-colors group cursor-pointer ${showNotifications ? 'bg-white/10' : 'hover:bg-white/5'}`}
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell className={`w-6 h-6 transition-colors ${showNotifications ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)] border-2 border-background"></span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowNotifications(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-3 w-80 sm:w-96 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/5">
                    <h3 className="text-white font-semibold">Notifications</h3>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllAsRead}
                        className="text-xs text-primary hover:text-cyan-400 font-medium transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Mark all read
                      </button>
                    )}
                  </div>
                  
                  <div className="flex flex-col max-h-[400px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-gray-500 text-sm">
                        You're all caught up!
                      </div>
                    ) : (
                      notifications.map(note => (
                        <button
                          key={note.id}
                          onClick={() => markAsRead(note.id, note.link)}
                          className={`w-full text-left px-5 py-4 border-b border-white/5 hover:bg-white/5 transition-colors flex gap-3 items-start ${!note.is_read ? 'bg-primary/5' : ''}`}
                        >
                          <div className="mt-0.5 flex-shrink-0">
                            {!note.is_read ? (
                              <div className="w-2 h-2 rounded-full bg-primary mt-2 shadow-[0_0_5px_rgba(0,224,255,0.5)]" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-gray-600 mt-1" />
                            )}
                          </div>
                          <div>
                            <p className={`text-sm ${!note.is_read ? 'text-white font-medium' : 'text-gray-300'}`}>
                              {note.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 leading-snug">
                              {note.message}
                            </p>
                            <p className="text-[10px] text-gray-600 mt-2 font-medium">
                              {new Date(note.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  
                  {notifications.length >= 15 && (
                    <div className="px-5 py-3 border-t border-white/10 text-center bg-white/5">
                      <Link href="/settings" onClick={() => setShowNotifications(false)} className="text-xs text-gray-400 hover:text-white font-medium transition-colors">
                        View all notifications
                      </Link>
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
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
