"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/context/UserContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  ArrowRight,
  Loader2,
  Smartphone,
  Copy,
  ChevronLeft,
  Sparkles,
  CreditCard,
  CheckCircle,
  Share2
} from "lucide-react";
import axios from "axios";
import { api } from "@/lib/api";

const API = "/api/v1";

export default function ActivateCodePage() {
  const { user } = useUser();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error" | "pending">("idle");
  const [message, setMessage] = useState("");
  const [sellerInfo, setSellerInfo] = useState<any>(null);
  const [reference, setReference] = useState("");
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Consolidated states
  const [walletBalance, setWalletBalance] = useState(0);
  const [minPrice, setMinPrice] = useState(user?.activation_price || 20);
  const [currency, setCurrency] = useState("GHS");
  const [userCodes, setUserCodes] = useState<any[]>([]);

  const loadUserCodes = useCallback(async (signal?: AbortSignal) => {
    try {
      const resp = await api.get(`${API}/codes/my-codes`, { signal });
      setUserCodes(resp.data);
    } catch (err: any) {
      if (axios.isCancel(err)) return;
      setUserCodes([]);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadUserCodes(controller.signal);
    api.get(`${API}/wallet/`, { signal: controller.signal })
      .then(res => setWalletBalance(Number(res.data.balance) || 0))
      .catch((err) => {
        if (axios.isCancel(err)) return;
      });
    return () => {
      controller.abort();
    };
  }, [loadUserCodes]);

  async function fetchSellerInfo() {
    setLoading(true);
    setStatus("idle");
    try {
      const res = await api.get(`${API}/codes/seller-payment/${code}`);
      if (res.status === 200) {
        setSellerInfo(res.data);
        setStep(2);
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err.response?.data?.detail || "Seller info not found");
    } finally {
      setLoading(false);
    }
  }

  async function buyCode() {
    if (walletBalance < minPrice) {
      const amountNeeded = Math.max(minPrice - walletBalance, minPrice);
      const proceed = window.confirm(
        `Insufficient wallet balance (${walletBalance.toFixed(2)} GHS).\n\nYou need ${minPrice.toFixed(2)} GHS to purchase this code.\nWould you like to top up the remaining ${amountNeeded.toFixed(2)} GHS via Momo/Card?`
      );
      if (proceed) {
        return handleDeposit();
      }
      return;
    }

    setLoading(true);
    setStatus("idle");
    try {
      const res = await api.post(`${API}/codes/buy`, { min_price: minPrice, currency: currency });
      if (res.status === 200) {
        setStatus("success");
        setAffiliateCode(res.data.product_code);
        await loadUserCodes();
        api.get(`${API}/wallet/`).then(res => setWalletBalance(Number(res.data.balance) || 0)).catch(() => { });
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err.response?.data?.detail || "Failed to buy code");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeposit(amountOverride?: number) {
    setLoading(true);
    try {
      const targetAmount = amountOverride ?? minPrice;
      const amountToAdd = Math.max(targetAmount - walletBalance, targetAmount);
      const res = await api.post(`${API}/wallet/deposit`, {
        amount: amountToAdd
      });

      if (res.data.authorization_url) {
        window.location.href = res.data.authorization_url;
      } else {
        setStatus("error");
        setMessage("Failed to initialize deposit");
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err.response?.data?.detail || "Error initializing deposit");
    } finally {
      setLoading(false);
    }
  }

  async function buySponsor() {
    if (!sellerInfo) return;
    
    if (walletBalance < sellerInfo.amount) {
      const amountNeeded = Math.max(sellerInfo.amount - walletBalance, sellerInfo.amount);
      const proceed = window.confirm(
        `Insufficient wallet balance (${walletBalance.toFixed(2)} GHS).\n\nYou need ${sellerInfo.amount.toFixed(2)} GHS to purchase this sponsor code.\nWould you like to top up the remaining ${amountNeeded.toFixed(2)} GHS via Momo/Card?`
      );
      if (proceed) {
        return handleDeposit(sellerInfo.amount);
      }
      return;
    }

    setLoading(true);
    setStatus("idle");
    try {
      const res = await api.post(`${API}/codes/buy-sponsor`, { product_code: code });
      if (res.status === 200) {
        setStatus("success");
        setAffiliateCode(res.data.product_code);
        await loadUserCodes();
        api.get(`${API}/wallet/`).then(res => setWalletBalance(Number(res.data.balance) || 0)).catch(() => { });
        setStep(1); // Reset step, the active code UI will show up since activeCode will be populated
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err.response?.data?.detail || "Failed to buy sponsor code.");
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleShare(codeValue: string) {
    const text = `Join me on LearNnEarn! Use my activation code: ${codeValue}`;
    const url = `${window.location.origin}/register?code=${codeValue}&type=rid`;
    
    if (navigator.share) {
      navigator.share({ title: 'Join LearNnEarn', text: text, url: url }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + "\n\n" + url)}`, "_blank");
    }
  }

  const activeCode = userCodes.find(c => !c.used);

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-block p-3 rounded-2xl bg-primary/10 mb-4"
        >
          <KeyRound className="w-8 h-8 text-primary" />
        </motion.div>
        <h1 className="text-3xl font-bold text-white mb-2">Portal Activation</h1>
        <p className="text-gray-400">Unlock your earning potential by acquiring your seasonal product code.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Left Side: Activation / Purchase */}
        <div className="space-y-6">
          {activeCode ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="p-8 rounded-3xl bg-primary/10 border border-primary/20 glass relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <ShieldCheck className="w-16 h-16 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Your Active Code</h3>
              <p className="text-gray-400 text-sm mb-6">Share this code to earn {user?.seller_percentage ? user.seller_percentage * 100 : 70}% commission.</p>
              
              <div className="text-center py-4 bg-black/40 rounded-lg border border-white/5 mb-6 font-mono text-xl tracking-wider text-white">
                {activeCode.product_code}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => copyToClipboard(activeCode.product_code, activeCode.id)}
                  className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-xs text-gray-300 border border-white/5"
                >
                  {copiedId === activeCode.id ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                  {copiedId === activeCode.id ? "Copied" : "Copy Code"}
                </button>
                <button onClick={() => handleShare(activeCode.product_code)}
                  className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary transition-colors text-xs border border-primary/30"
                >
                  <Share2 className="w-5 h-5" />
                  Share Native
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="p-8 rounded-3xl bg-card border border-white/10 glass relative overflow-hidden"
            >
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Identify Seller (Use Sponsor Code)</label>
                      <div className="relative">
                        <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                          type="text"
                          value={code}
                          onChange={(e) => setCode(e.target.value.toUpperCase())}
                          placeholder="CT-XXXX-XXXX"
                          className="w-full bg-background/50 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-primary transition-all font-mono"
                        />
                      </div>
                    </div>
                    <button
                      onClick={fetchSellerInfo}
                      disabled={loading || !code}
                      className="w-full py-4 bg-primary text-background font-bold rounded-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2 group"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Identify Seller <ArrowRight className="w-5 h-5" /></>}
                    </button>
                  </motion.div>
                )}

                {step === 2 && sellerInfo && (
                  <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                    <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                      <h3 className="text-xl font-bold text-white mb-4">Sponsor Details</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center bg-background/40 p-4 rounded-xl border border-white/5">
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase">Seller</p>
                            <p className="text-sm font-bold text-white">{sellerInfo.seller_name}</p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center bg-primary/10 p-4 rounded-xl border border-primary/20">
                          <div>
                            <p className="text-[10px] text-primary/70 uppercase">Amount Due</p>
                            <p className="text-xl font-bold text-primary">{sellerInfo.amount} {sellerInfo.currency}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button onClick={buySponsor} disabled={loading} className="w-full py-4 bg-primary text-background font-bold rounded-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2 group">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Pay with Wallet"}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {status === "error" && (
                <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-sm font-medium">{typeof message === 'string' ? message : JSON.stringify(message)}</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Wallet / Settings Section */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold">Wallet Balance</p>
              <p className="text-xl font-bold text-white">{walletBalance.toFixed(2)} GHS</p>
            </div>
            <Link href="/wallet" className="text-primary text-sm font-semibold hover:underline">View Wallet</Link>
          </div>
        </div>

        {/* Right Side: Marketplace Purchase */}
        <div className="space-y-6">
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
            className="p-8 rounded-3xl bg-gradient-to-br from-blue-600/20 to-primary/10 border border-primary/20 glass"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Marketplace Purchase</h3>
                <p className="text-gray-400 text-xs">Don't have a sponsor? Buy from the market pool.</p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-500 uppercase font-bold ml-1">Currency</label>
                  <select title="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}
                    className="bg-background/50 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all"
                  >
                    <option value="GHS">GHS (Cedis)</option>
                    <option value="USD">USD (Dollars)</option>
                    <option value="NGN">NGN (Naira)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-500 uppercase font-bold ml-1">Min Price</label>
                  <input type="number" title="Price" value={minPrice} onChange={(e) => setMinPrice(Number(e.target.value))}
                    className="bg-background/50 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>
            </div>

            <button onClick={buyCode} disabled={loading || !!activeCode}
              className="w-full py-6 bg-primary text-background font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
            >
              <CreditCard className="w-5 h-5" />
              {loading ? "Processing..." : activeCode ? "Already Activated" : "Purchase from Market"}
            </button>
          </motion.div>

          {/* Quick Guide */}
          <div className="p-6 space-y-4">
            <h4 className="text-gray-300 font-bold text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-500" /> Secure Activation Guide
            </h4>
            <div className="space-y-3">
              {[
                "Choose a Sponsor or the Marketplace.",
                "Complete the payment as specified.",
                "Receive your ONE unique product code.",
                `Start selling and earn ${user?.seller_percentage ? user.seller_percentage * 100 : 70}% commission.`
              ].map((text, i) => (
                <div key={i} className="flex gap-3 text-xs text-gray-500">
                  <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/10 text-[10px] font-bold text-primary">
                    {i + 1}
                  </div>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
