"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useUser } from "@/context/UserContext";
import { StatCard } from "@/components/StatCard";
import dynamic from "next/dynamic";
import { EarningsChartSkeleton } from "@/components/Skeletons";
import { ActivityFeed } from "@/components/ActivityFeed";

const EarningsChart = dynamic(
  () => import("@/components/EarningsChart").then(mod => mod.EarningsChart),
  {
    loading: () => <EarningsChartSkeleton />,
    ssr: false
  }
);
import { Wallet, Users, KeyRound, DollarSign, Share2 } from "lucide-react";
import axios from "axios";
import { api } from "@/lib/api";
import { APP_URL } from "@/lib/config";


const API = "/api/v1";

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser();
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDashboardData = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      // Only fetch wallet and transactions - NOT user profile
      const results = await Promise.allSettled([
        api.get(`${API}/wallet/`, { signal }),
        api.get(`${API}/wallet/transactions`, { signal })
      ]);
      
      // Handle each result separately so one failure doesn't block all
      if (results[0].status === 'fulfilled') {
        setWallet(results[0].value.data);
      } else {
        if (!axios.isCancel(results[0].reason)) {
          console.debug("Wallet fetch failed:", results[0].reason?.response?.status);
          setWallet(null);
        }
      }
      
      if (results[1].status === 'fulfilled') {
        setTransactions(results[1].value.data);
      } else {
        if (!axios.isCancel(results[1].reason)) {
          console.debug("Transactions fetch failed:", results[1].reason?.response?.status);
          setTransactions([]);
        }
      }
    } catch (e: any) {
      if (axios.isCancel(e)) return;
      console.debug("Dashboard data fetch error:", e.message);
      setWallet(null);
      setTransactions([]);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!userLoading) {
      const controller = new AbortController();
      fetchDashboardData(controller.signal);
      return () => {
        controller.abort();
      };
    }
  }, [userLoading, fetchDashboardData]);

  return (
    <div className="flex flex-col gap-6 lg:gap-8 pb-12 pt-2 lg:pt-4">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
            Welcome back, {user?.name?.split(" ")[0] || "Member"}!
          </h1>
          <p className="text-gray-400 mt-1 text-sm lg:text-base">Ready to continue your learning journey?</p>
        </div>
      </div>

      {/* Invite & Earn Header Banner */}
      <div className="bg-gradient-to-r from-primary/10 via-background to-secondary/10 border border-primary/20 rounded-2xl p-4 lg:p-8 shadow-[0_0_40px_rgba(0,224,255,0.05)] relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 lg:gap-8">
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative z-10 flex-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black tracking-widest uppercase mb-3 lg:mb-4">
            <Share2 className="w-3 h-3" /> Growth Engine
          </div>
          <h2 className="text-xl md:text-2xl lg:text-3xl font-black text-white mb-2 lg:mb-3 tracking-tight">
            Invite & Earn {user?.seller_percentage ? user.seller_percentage * 100 : 70}% Instantly
          </h2>
          <p className="text-gray-400 text-xs lg:text-sm max-w-xl leading-relaxed">
            Share your unique access link below. When someone registers using it, the system automatically tags them to your network and credits your wallet matching your tier.
          </p>
        </div>

        <div className="relative z-10 flex flex-col gap-3 w-full md:w-[400px]">
          <div className="bg-background/90 border border-white/20 rounded-2xl p-3 lg:p-4 flex items-center justify-between gap-3 lg:gap-4 shadow-xl">
            <div className="truncate font-mono text-white text-sm md:text-lg lg:text-xl font-black tracking-widest min-w-0">
              {user?.product_codes?.[0] || user?.productCodes?.[0] || "GENERATING..."}
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const code = user?.product_codes?.[0] || user?.productCodes?.[0];
                if (!code) return;
                // Use the canonical app URL so shared links point to the live site, not localhost
                const origin = APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
                const link = `${origin}/register?code=${code}&type=product_code`;
                const shareData = {
                  title: 'Join LearNnEarn',
                  text: `Join me on LearNnEarn! Use my activation code: ${code}`,
                  url: link
                };

                if (navigator.share) {
                  navigator.share(shareData).catch((err) => console.error("Error sharing:", err));
                } else {
                  navigator.clipboard.writeText(link);
                  alert("Link copied to clipboard!");
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-background font-black rounded-xl hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(0,224,255,0.3)] focus:outline-none shrink-0 uppercase tracking-widest text-[10px] md:text-xs cursor-pointer"
              title="Share Invite"
            >
              <Share2 className="w-4 h-4 md:mr-1" />
              <span>Share</span>
            </motion.button>
          </div>

          <p className="text-[10px] text-gray-500 text-center uppercase tracking-widest font-bold mt-1">
            Tap share to send your automated access link
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <StatCard
          title="Wallet Balance"
          value={wallet ? `${Number(wallet.balance).toFixed(2)} ${wallet.currency || 'GHS'}` : "LOADING..."}
          trend={transactions.length > 0 ? "+Active" : "0%"}
          isPositive={true}
          icon={Wallet}
          delay={0.1}
          href="/wallet"
        />
        <StatCard
          title="Activations"
          value={user?.product_codes?.length ? String(user.product_codes.length) : user?.productCodes?.length ? String(user.productCodes.length) : "0"}
          trend={(user?.product_codes?.length || user?.productCodes?.length) ? "+Growing" : "0"}
          isPositive={true}
          icon={KeyRound}
          delay={0.3}
          href="/activate"
        />
        <StatCard
          title="Total Earned"
          value={wallet ? `${transactions.reduce((sum, t) => t.type === 'CREDIT' ? sum + Number(t.amount) : sum, 0).toFixed(2)} ${wallet.currency || 'GHS'}` : "0.00"}
          trend={transactions.some(t => t.type === 'CREDIT') ? "+Earning" : "New"}
          isPositive={true}
          icon={DollarSign}
          delay={0.4}
          href="/wallet"
        />
      </div>

      {/* Main Grid: Charts */}
      <div className="grid grid-cols-1 gap-6">
        <EarningsChart transactions={transactions} />
      </div>

      {/* Activity Content */}
      <div className="grid grid-cols-1 gap-6">
        <div className="col-span-1">
          <ActivityFeed activities={transactions} />
        </div>
      </div>

    </div>
  );
}
