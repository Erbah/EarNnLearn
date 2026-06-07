"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  KeyRound,
  Wallet,
  Network,
  QrCode,
  GraduationCap,
  ArrowRightLeft,
  Settings,
  LogOut,
  Shield,
  CreditCard
} from "lucide-react";
import { motion } from "framer-motion";
import { useUser } from "@/context/UserContext";
import { API_BASE_URL } from "@/lib/api";

const API = `${API_BASE_URL}/api/v1`;

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["USER", "SUPER_ADMIN", "EDUCATION_ADMIN"] },
  { name: "Activate Code", href: "/activate", icon: KeyRound, roles: ["USER"] },
  { name: "Wallet", href: "/wallet", icon: Wallet, roles: ["USER"] },
  { name: "Network", href: "/network", icon: Network, roles: ["USER"] },
  { name: "Courses", href: "/courses", icon: GraduationCap, roles: ["USER", "SUPER_ADMIN", "EDUCATION_ADMIN"] },
  { name: "Creator", href: "/creator", icon: ArrowRightLeft, roles: ["USER", "SUPER_ADMIN", "EDUCATION_ADMIN"] },
  { name: "Settings", href: "/settings", icon: Settings, roles: ["USER", "SUPER_ADMIN", "EDUCATION_ADMIN"] },
  { name: "Platform Admin", href: "/admin", icon: Shield, roles: ["SUPER_ADMIN", "EDUCATION_ADMIN"] },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, loading } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredItems = navItems.filter(item => {
    if (!user) return !item.roles || item.roles.includes("USER");
    return item.roles.includes(user.role || "USER");
  });

  return (
    <aside 
      suppressHydrationWarning
      className="w-64 h-screen fixed top-0 left-0 bg-surface border-r border-white/5 flex flex-col glass z-50"
    >
      <div className="p-6">
        {mounted ? (
          <Link 
            href="/" 
            className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent opacity-80 block"
          >
            EarNnLearn
          </Link>
        ) : (
          <div className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent opacity-20 block">
            EarNnLearn
          </div>
        )}
      </div>

      {!mounted ? (
        <div className="flex-1 px-4 mt-8 space-y-4 opacity-20">
          <div className="h-10 w-full bg-white/5 rounded-xl animate-pulse" />
          <div className="h-10 w-full bg-white/5 rounded-xl animate-pulse" />
          <div className="h-10 w-full bg-white/5 rounded-xl animate-pulse" />
        </div>
      ) : (
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <div className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 relative group
                  ${isActive ? "text-primary bg-primary/10 border border-primary/20" : "text-foreground hover:text-white hover:bg-white/5"}`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-indicator"
                      className="absolute inset-0 bg-primary/10 rounded-xl"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <item.icon className={`w-5 h-5 z-10 ${isActive ? "text-primary" : "text-gray-400 group-hover:text-white transition-colors"}`} />
                  <span className="z-10 font-medium">{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      )}

      <div className="p-4 border-t border-white/5">
        <button
          onClick={() => {
            localStorage.removeItem("access_token");
            document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
            sessionStorage.removeItem("admin_unlocked");
            window.location.href = "/login";
          }}
          className="flex items-center space-x-3 px-4 py-3 rounded-xl w-full text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all mt-2"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default AdminSidebar;
