"use client";

import React, { useState, useEffect, useMemo, useCallback, createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  KeyRound,
  Wallet,
  Network,
  GraduationCap,
  ArrowRightLeft,
  Settings,
  LogOut,
  Shield,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/context/UserContext";
import { API_BASE_URL } from "@/lib/api";

const API = `${API_BASE_URL}/api/v1`;

// ─── Sidebar Context (lets Topbar toggle the mobile drawer) ──────────────────
interface SidebarContextType {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}
const SidebarContext = createContext<SidebarContextType>({
  isOpen: false,
  toggle: () => {},
  close: () => {},
});
export const useSidebar = () => useContext(SidebarContext);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const close = useCallback(() => setIsOpen(false), []);
  return (
    <SidebarContext.Provider value={{ isOpen, toggle, close }}>
      {children}
    </SidebarContext.Provider>
  );
}

// ─── Nav Items ────────────────────────────────────────────────────────────────
const navItems = [
  { name: "Dashboard",     href: "/dashboard", icon: LayoutDashboard,  roles: ["USER", "SUPER_ADMIN", "EDUCATION_ADMIN"] },
  { name: "Activate Code", href: "/activate",  icon: KeyRound,         roles: ["USER"] },
  { name: "Wallet",        href: "/wallet",    icon: Wallet,           roles: ["USER"] },
  { name: "Courses",       href: "/courses",   icon: GraduationCap,    roles: ["USER", "SUPER_ADMIN", "EDUCATION_ADMIN"] },
  { name: "Creator",       href: "/creator",   icon: ArrowRightLeft,   roles: ["USER", "SUPER_ADMIN", "EDUCATION_ADMIN"] },
  { name: "Settings",      href: "/settings",  icon: Settings,         roles: ["USER", "SUPER_ADMIN", "EDUCATION_ADMIN"] },
  { name: "Platform Admin",href: "/admin",     icon: Shield,           roles: ["SUPER_ADMIN", "EDUCATION_ADMIN"] },
];

// ─── Sidebar Inner Content ────────────────────────────────────────────────────
function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { user, loading } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const filteredItems = useMemo(() => {
    return navItems.filter((item) => {
      if (!user) return !item.roles || item.roles.includes("USER");
      return item.roles.includes(user.role || "USER");
    });
  }, [user]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("access_token");
    document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    sessionStorage.removeItem("admin_unlocked");
    window.location.href = "/login";
  }, []);

  return (
    <div className="w-64 h-full flex flex-col bg-surface border-r border-white/5 glass">
      {/* Header */}
      <div className="p-6 flex items-center justify-between">
        {mounted ? (
          <Link
            href="/"
            onClick={onClose}
            className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent opacity-80"
          >
            EarNnLearN
          </Link>
        ) : (
          <div className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent opacity-20">
            EarNnLearN
          </div>
        )}
        {/* Close button — only visible on mobile */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      {!mounted ? (
        <div className="flex-1 px-4 mt-8 space-y-4 opacity-20">
          <div className="h-10 w-full bg-white/5 rounded-xl animate-pulse" />
          <div className="h-10 w-full bg-white/5 rounded-xl animate-pulse" />
          <div className="h-10 w-full bg-white/5 rounded-xl animate-pulse" />
        </div>
      ) : (
        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href} onClick={onClose}>
                <div
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 relative group
                    ${isActive
                      ? "text-primary bg-primary/10 border border-primary/20"
                      : "text-foreground hover:text-white hover:bg-white/5"
                    }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-indicator"
                      className="absolute inset-0 bg-primary/10 rounded-xl"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <item.icon
                    className={`w-5 h-5 z-10 flex-shrink-0 ${
                      isActive ? "text-primary" : "text-gray-400 group-hover:text-white transition-colors"
                    }`}
                  />
                  <span className="z-10 font-medium">{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      )}

      {/* Logout */}
      <div className="p-4 border-t border-white/5">
        <button
          onClick={handleLogout}
          className="flex items-center space-x-3 px-4 py-3 rounded-xl w-full text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export const AdminSidebar = React.memo(function AdminSidebar() {
  const { isOpen, close } = useSidebar();

  return (
    <>
      {/* ── Desktop: fixed sidebar ── */}
      <aside className="hidden lg:flex w-64 h-screen fixed top-0 left-0 z-50">
        <SidebarContent />
      </aside>

      {/* ── Mobile: backdrop + slide-in drawer ── */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={close}
            />

            {/* Drawer */}
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed top-0 left-0 h-full z-50 lg:hidden"
            >
              <SidebarContent onClose={close} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
});

export default AdminSidebar;
