"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Lock, Mail, Loader2, Eye, EyeOff, ChevronLeft } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL, api } from "@/lib/api";
import { PLATFORM_NAME, API_PREFIX } from "@/lib/config";

import { LandingHeader } from "@/components/LandingHeader";

const API = API_PREFIX;

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const loginData = {
        identifier: identifier,
        password: password
      };

      const res = await api.post(`${API}/auth/login`, loginData);

      if (res.status === 200) {
        const data = res.data;
        localStorage.setItem("access_token", data.access_token);
        // Set cookie for middleware
        document.cookie = `access_token=${data.access_token}; path=/; max-age=86400; SameSite=Lax`;

        // Fetch profile to determine redirect
        const profileRes = await api.get(`${API}/auth/me`);

        if (profileRes.status === 200) {
          const profile = profileRes.data;
          if (profile.role === "SUPER_ADMIN" || profile.role === "EDUCATION_ADMIN") {
            router.push("/admin");
          } else if (profile.tier_type === "admin") {
            router.push("/admin"); // Fallback for transition
          } else {
            router.push("/dashboard");
          }
        } else {
          router.push("/dashboard");
        }
      }
    } catch (err: any) {
      const responseData = err.response?.data;
      const responseStatus = err.response?.status;
      
      // Removed explicit console.error to keep the terminal clean

      
      let errorMessage = "An unexpected error occurred. Please try again.";
      
      if (err.message === "Network Error") {
        errorMessage = `Cannot connect to the backend server at ${API_BASE_URL}. 
        
        Please ensure the backend is running. 
        TIP: Use "npm run dev" from the project root to start both services together.`;
      } else if (responseStatus === 422) {
        // Specifically handle FastAPI validation errors (e.g. JSON vs Form mismatch)
        errorMessage = "Backend validation error (422). Possible data format mismatch.";
        if (responseData?.detail) {
          errorMessage += ": " + (typeof responseData.detail === 'string' 
            ? responseData.detail 
            : JSON.stringify(responseData.detail));
        }
      } else if (responseData?.detail) {
        if (Array.isArray(responseData.detail)) {
          errorMessage = responseData.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
        } else {
          errorMessage = responseData.detail;
        }
      } else if (responseStatus === 401) {
        errorMessage = "Invalid email or password.";
      } else if (responseStatus === 404) {
        errorMessage = `Login service not found (404) at ${API_BASE_URL}. Check your configuration.`;
      } else if (responseStatus === 502) {
        errorMessage = "Gateway error (502). The authentication service might be unreachable.";
      } else if (responseStatus >= 500) {
        errorMessage = "Server error (500). Please try again later.";
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <LandingHeader />
      
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 blur-[150px] rounded-full pointer-events-none -z-10" />

      <div className="flex-1 flex items-center justify-center p-6 relative z-10">

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 rounded-3xl bg-card border border-white/10 shadow-2xl glass relative z-10"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
            {PLATFORM_NAME}
          </h1>
          <p className="text-gray-400">Welcome back. Enter your details to access your dashboard.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-sm font-medium">
            {typeof error === 'string' ? error : (error as any).message || "An error occurred"}
          </div>
        )}

        <form className="space-y-5" onSubmit={handleLogin}>
          <div>
            <label htmlFor="identifier" className="block text-sm font-medium text-gray-300 mb-2">Email Address or Phone Number</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
              <input
                id="identifier"
                name="username"
                autoComplete="username"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com or 054 123 4567"
                required
                className="w-full bg-background/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-600 caret-primary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
              <input
                id="password"
                name="password"
                autoComplete="current-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-background/50 border border-white/10 rounded-xl py-3 pl-12 pr-12 text-white placeholder-gray-600 caret-primary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <div className="flex justify-end mt-2">
              <a href="#" className="text-xs text-primary hover:text-white transition-colors">Forgot password?</a>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-primary text-background font-bold rounded-xl hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(0,224,255,0.3)] hover:shadow-[0_0_25px_rgba(0,224,255,0.5)] flex items-center justify-center group mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Sign In
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <p className="text-sm text-center text-gray-400 mt-6">
          Don't have an account? <Link href="/register" className="text-white hover:text-primary transition-colors font-medium">Create one</Link>
        </p>
      </motion.div>
      </div>
    </div>
  );
}
