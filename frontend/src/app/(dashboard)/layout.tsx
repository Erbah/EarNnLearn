"use client";

import { UserProvider } from "@/context/UserContext";
import { AdminSidebar, SidebarProvider } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { useUser } from "@/context/UserContext";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2, LogOut, RefreshCw, AlertCircle } from "lucide-react";
import { api, setClientToken } from "@/lib/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <SidebarProvider>
        <DashboardContent>{children}</DashboardContent>
      </SidebarProvider>
    </UserProvider>
  );
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, loading, refetchUser } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  const handleSupportClick = useCallback(() => {
    window.location.href = 'mailto:support@learnnearn.com';
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await api.post("/api/v1/auth/logout");
    } catch (e) {
      console.error("Logout request failed", e);
    }
    setClientToken(null);
    document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/login";
  }, []);

  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");

  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryError("");
    try {
      const res = await api.post("/api/v1/auth/retry-activation");
      if (res.data.status === "paystack" && res.data.paystack_url) {
        window.location.href = res.data.paystack_url;
      } else {
        await refetchUser();
      }
    } catch (e: any) {
      setRetryError(e.response?.data?.detail || "Failed to retry activation.");
    } finally {
      setIsRetrying(false);
    }
  };

  // Poll for user status if pending
  useEffect(() => {
    if (user && user.status === "pending") {
      const interval = setInterval(async () => {
        try {
          await refetchUser();
        } catch (e) {
          console.error("Failed to refetch user status during poll:", e);
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [user, refetchUser]);

  // Auto-verify if returning from Paystack
  useEffect(() => {
    if (typeof window !== "undefined" && user && user.status === "pending") {
      const searchParams = new URLSearchParams(window.location.search);
      const hasRef = searchParams.get('reference') || searchParams.get('trxref');
      if (hasRef) {
        // Clean URL to prevent multiple calls
        window.history.replaceState({}, document.title, window.location.pathname);
        handleRetry();
      }
    }
  }, [user, handleRetry]);

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

  // --- 🚨 Elite Hardening: Prevent Pending Users from Accessing Dashboard ---
  const isPending = !loading && user && user.status === "pending" && user.role !== 'SUPER_ADMIN';

  if (isPending && pathname !== '/activate') {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-950 p-8 text-center overscroll-none relative">
        <div className="absolute top-0 left-0 w-full h-[300px] bg-primary/10 rounded-full blur-[120px] -z-10" />
        <div className="max-w-md space-y-6">
          <div className="mx-auto w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center mb-8 border border-primary/20 shadow-[0_0_40px_rgba(var(--primary-rgb),0.2)] relative">
             <Loader2 className="w-10 h-10 text-primary animate-spin" />
             <div className="absolute inset-0 flex items-center justify-center font-bold text-[10px] text-primary">PAY</div>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Activation Pending</h1>
          <p className="text-gray-400 leading-relaxed">
            Your registration is complete, but your activation payment is currently pending verification. 
            Once your payment/transaction is confirmed successful, your dashboard will unlock automatically.
          </p>

          {retryError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm flex items-start gap-3 text-left">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{retryError}</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button 
              onClick={handleRetry}
              disabled={isRetrying}
              className="p-4 bg-white/5 hover:bg-white/10 transition-colors rounded-2xl border border-white/10 text-primary text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`} />
              {isRetrying ? "Checking..." : "Check Payment Status / Retry"}
            </button>
          </div>
          
          <button 
            onClick={() => router.push('/activate')}
            className="w-full py-4 bg-primary text-background font-bold rounded-xl hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(0,224,255,0.3)] hover:shadow-[0_0_25px_rgba(0,224,255,0.5)] flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            Go to Activation Page
          </button>

          <button 
            onClick={handleLogout}
            className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-bold rounded-xl border border-red-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <LogOut className="w-4 h-4" />
            Logout & Return
          </button>
        </div>
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
            onClick={handleSupportClick}
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
      <div className="flex-1 lg:ml-64 flex flex-col relative overflow-x-hidden">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10 opacity-50 pointer-events-none" />
        <Topbar />
        <main className="flex-1 px-3 sm:px-4 lg:px-8 py-4 lg:py-8 w-full max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
