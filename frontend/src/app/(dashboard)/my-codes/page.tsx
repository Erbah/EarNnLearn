"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, Copy, CheckCircle, Share2, MessageCircle, Send, Plus, CreditCard } from "lucide-react";
import { api } from "@/lib/api";
import { useUser } from "@/context/UserContext";

const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001';

export default function MyCodesPage() {
  const { user } = useUser();
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  const loadCodes = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/codes/my-codes', { signal });
      setCodes(res.data);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setCodes([]);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadCodes(controller.signal);
    api.get('/api/v1/wallet/', { signal: controller.signal })
      .then(res => setWalletBalance(Number(res.data.balance) || 0))
      .catch(() => { });
    return () => {
      controller.abort();
    };
  }, [loadCodes]);

  async function buyCode() {
    setBuying(true);
    try {
      const res = await api.post('/api/v1/codes/buy');
      if (res.status === 200 || res.status === 201) {
        await loadCodes();
        // update wallet balance
        api.get('/api/v1/wallet/')
          .then(res => setWalletBalance(Number(res.data.balance) || 0))
          .catch(() => { });
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to buy code");
    }
    setBuying(false);
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleShare(codeValue: string) {
    const text = `Join me on LearNnEarn! Use my activation code: ${codeValue}`;
    const url = `${APP_URL}/register?code=${codeValue}&type=rid`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Join LearNnEarn',
        text: text,
        url: url
      }).catch(() => {
        // Fallback or ignore
      });
    } else {
      // Fallback to WhatsApp if native share is not supported
      const waText = encodeURIComponent(`${text}\n\n${url}`);
      window.open(`https://wa.me/?text=${waText}`, "_blank");
    }
  }

  // Split codes into unused vs used
  const unusedCodes = useMemo(() => codes.filter(c => c.status === "active"), [codes]);
  const usedCodes = useMemo(() => codes.filter(c => c.status === "used"), [codes]);

  return (
    <div className="flex flex-col gap-8 pb-12 pt-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">My Product Codes</h1>
          <p className="text-gray-400 mt-1">Share these codes to grow your network and earn {user?.seller_percentage ? user.seller_percentage * 100 : 70}% commission</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400 mb-1">Wallet Balance</p>
          <p className="text-xl font-bold text-white">{Number(walletBalance).toFixed(2)} GHS</p>
        </div>
      </div>

      {/* Buy New Code banner */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 bg-gradient-to-br from-primary/10 to-blue-600/10 border border-primary/20 flex flex-col md:flex-row items-center justify-between gap-6"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Plus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg">Buy a New Product Code</h3>
            <p className="text-gray-400 text-sm mt-0.5">Purchasing a code automatically generates it in your inventory.</p>
          </div>
        </div>
        <button onClick={buyCode} disabled={buying}
          className="px-6 py-3 bg-primary text-background font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
        >
          <CreditCard className="w-5 h-5" />
          {buying ? "Purchasing..." : "Purchase Code"}
        </button>
      </motion.div>

      {/* Unused Codes */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <QrCode className="w-5 h-5 text-green-400" /> Active Codes ({unusedCodes.length})
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : unusedCodes.length === 0 ? (
          <div className="text-center py-16 rounded-2xl bg-white/[0.02] border border-white/5">
            <Share2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">You don&apos;t have any active codes.</p>
            <p className="text-gray-500 text-sm mt-1">Purchase one to start earning!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {unusedCodes.map((code, i) => (
                <motion.div key={code.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                  className="rounded-xl bg-white/5 border border-white/10 p-5 group hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold text-green-400 bg-green-500/10 px-2 py-1 rounded">ACTIVE</span>
                    <span className="text-xs text-gray-500">{new Date(code.created_at).toLocaleDateString()}</span>
                  </div>

                  <div className="text-center py-4 bg-black/40 rounded-lg border border-white/5 mb-4 relative font-mono text-xl tracking-wider text-white">
                    {code.code_value}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => copyToClipboard(code.code_value, code.id)}
                      className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-xs text-gray-300 border border-white/5"
                    >
                      {copiedId === code.id ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                      {copiedId === code.id ? "Copied" : "Copy Code"}
                    </button>
                    <button onClick={() => handleShare(code.code_value)}
                      className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-xs border border-primary/20"
                    >
                      <Share2 className="w-5 h-5" />
                      Share Native
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Used Codes */}
      {usedCodes.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-400 mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-gray-500" /> Used Codes History ({usedCodes.length})
          </h2>
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden p-1">
            {usedCodes.map(code => (
              <div key={code.id} className="flex items-center justify-between p-4 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-white font-mono">{code.code_value}</p>
                  <p className="text-gray-500 text-xs mt-1">Status: Used</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-sm">{code.price} GHS</p>
                  <p className="text-gray-600 text-xs mt-1">{new Date(code.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
