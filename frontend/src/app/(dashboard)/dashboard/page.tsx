"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useUser } from "@/context/UserContext";
import { StatCard } from "@/components/StatCard";
import { EarningsChart } from "@/components/EarningsChart";
import { NetworkPreview } from "@/components/NetworkPreview";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Wallet, Users, KeyRound, DollarSign, Share2, Copy, MessageCircle, Twitter, MessageSquare, BookOpen } from "lucide-react";
import { API_BASE_URL, api } from "@/lib/api";


const API = "/api/v1";

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser();
  const [wallet, setWallet] = useState<any>(null);
  const [network, setNetwork] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userLoading) {
      fetchDashboardData();
    }
  }, [userLoading]);

  async function fetchDashboardData() {
    try {
      setLoading(true);
      // Only fetch wallet, network, and transactions - NOT user profile
      const results = await Promise.allSettled([
        api.get(`${API}/wallet/`),
        api.get(`${API}/network/tree-view`),
        api.get(`${API}/wallet/transactions`)
      ]);
      
      // Handle each result separately so one failure doesn't block all
      if (results[0].status === 'fulfilled') {
        setWallet(results[0].value.data);
      } else {
        console.debug("Wallet fetch failed:", results[0].reason?.response?.status);
        setWallet(null);
      }
      
      if (results[1].status === 'fulfilled') {
        setNetwork(results[1].value.data);
      } else {
        console.debug("Network fetch failed:", results[1].reason?.response?.status);
        setNetwork(null);
      }
      
      if (results[2].status === 'fulfilled') {
        setTransactions(results[2].value.data);
      } else {
        console.debug("Transactions fetch failed:", results[2].reason?.response?.status);
        setTransactions([]);
      }
    } catch (e: any) {
      console.debug("Dashboard data fetch error:", e.message);
      setWallet(null);
      setNetwork(null);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 pb-12 pt-4">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Welcome back, {user?.name?.split(" ")[0] || "Member"}!
          </h1>
          <p className="text-gray-400 mt-1">Ready to continue your learning journey?</p>
        </div>
      </div>

      {/* Invite & Earn Header Banner */}
      <div className="bg-gradient-to-r from-primary/10 via-background to-secondary/10 border border-primary/20 rounded-2xl p-6 lg:p-8 shadow-[0_0_40px_rgba(0,224,255,0.05)] relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative z-10 flex-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black tracking-widest uppercase mb-4">
            <Share2 className="w-3 h-3" /> Growth Engine
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3 tracking-tight">
            Invite & Earn 70% Instantly
          </h2>
          <p className="text-gray-400 text-sm max-w-xl leading-relaxed">
            Share your unique access link below. When someone registers using it, the system automatically tags them to your network and credits your wallet matching your tier.
          </p>
        </div>

        <div className="relative z-10 flex flex-col gap-3 w-full md:w-[400px]">
          <div className="bg-background/90 border border-white/20 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xl">
            <div className="truncate font-mono text-white text-lg md:text-xl font-black tracking-widest">
              {user?.product_codes?.[0] || "GENERATING..."}
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (!user?.product_codes?.[0]) return;
                const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/register?code=${user?.product_codes[0]}&type=product_code`;
                const shareData = {
                  title: 'Join LearNnEarn',
                  text: `Join me on LearNnEarn! Use my activation code: ${user?.product_codes[0]}`,
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Wallet Balance"
          value={wallet ? `${Number(wallet.balance).toFixed(2)} ${wallet.currency || 'GHS'}` : "LOADING..."}
          trend={wallet?.recent_change || "0%"}
          isPositive={true}
          icon={Wallet}
          delay={0.1}
          href="/wallet"
        />
        <StatCard
          title="Network Size"
          value={network ? String(network.children_count) : "0"}
          trend="+"
          isPositive={true}
          icon={Users}
          delay={0.2}
          href="/network"
        />
        <StatCard
          title="Activations"
          value={network ? String(network.children?.length || 0) : "0"}
          trend="Direct"
          isPositive={true}
          icon={KeyRound}
          delay={0.3}
          href="/activate"
        />
        <StatCard
          title="Total Earned"
          value={wallet ? `${Number(wallet.balance).toFixed(2)} ${wallet.currency || 'GHS'}` : "0.00"}
          trend="Live"
          isPositive={true}
          icon={DollarSign}
          delay={0.4}
          href="/wallet"
        />
      </div>

      {/* Main Grid: Charts & Network */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <EarningsChart />
        <NetworkPreview count={network?.children_count || 0} />
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
