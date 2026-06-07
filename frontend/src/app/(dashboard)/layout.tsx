"use client";

import { UserProvider } from "@/context/UserContext";
import { AdminSidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { useUser } from "@/context/UserContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <DashboardContent>{children}</DashboardContent>
    </UserProvider>
  );
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();



  // --- 🚨 Elite Hardening: Beta Access Gate ---
  const isBetaAuthorized = user?.is_beta_user || user?.role === 'SUPER_ADMIN';
  const isPublicRoute = pathname?.startsWith('/admin/launch-dashboard'); // Allow admin to see dashboard

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }



  // Final Hardening: Launch Gate Screen
  if (!loading && user && !isBetaAuthorized) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-950 p-8 text-center overscroll-none">
        <div className="absolute top-0 left-0 w-full h-[300px] bg-primary/10 rounded-full blur-[120px] -z-10" />
        <div className="max-w-md space-y-6">
          <div className="mx-auto w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center mb-8 border border-primary/20 shadow-[0_0_40px_rgba(var(--primary-rgb),0.2)]">
             <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">The Future is Loading</h1>
          <p className="text-gray-400 leading-relaxed">
            LearNnEarn is currently in a <b>Controlled Soft Launch</b> phase. Our engine is fine-tuning the platform for the first 50 explorers.
          </p>
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-primary text-sm font-semibold">
            Your spot on the waitlist is secured.
          </div>
          <button 
            onClick={() => window.location.href = 'mailto:support@learnnearn.com'}
            className="text-gray-500 text-xs hover:text-white transition-colors"
          >
            Have a Beta invite? Contact Support
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AdminSidebar />
      <div className="flex-1 ml-64 flex flex-col relative overflow-x-hidden">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10 opacity-50 pointer-events-none" />
        <Topbar />
        <main className="flex-1 px-8 py-8 w-full max-w-7xl mx-auto z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
