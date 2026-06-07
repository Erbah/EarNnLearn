'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { API_BASE_URL, api } from '@/lib/api';
import axios from 'axios';

const API = `${API_BASE_URL}/api/v1/admin`;

interface InspectUserModalProps {
  rid: string;
  onClose: () => void;
}

export const InspectUserModal = React.memo(function InspectUserModal({ rid, onClose }: InspectUserModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api.get(`${API}/users/${rid}`, { signal: controller.signal })
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setLoading(false);
      });
    return () => controller.abort();
  }, [rid]);

  const adjustWallet = useCallback(async () => {
    const amt = prompt("Enter adjustment amount (can be negative):");
    if (!amt) return;
    const reason = prompt("Enter reason for adjustment:");
    if (!reason) return;
    try {
      await api.post(`${API}/users/${rid}/adjust-wallet?amount=${amt}&reason=${reason}`);
      alert("Wallet adjusted");
      const res = await api.get(`${API}/users/${rid}`);
      setData(res.data);
    } catch (e) {}
  }, [rid]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[160] flex items-center justify-center bg-background/90 backdrop-blur-md p-4 text-white"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="bg-card border border-white/10 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <h2 className="text-xl font-bold">User Dossier: <span className="text-primary">{rid}</span></h2>
          <button onClick={onClose} title="Close Dossier" className="p-2 hover:bg-white/5 rounded-full text-gray-500"><X className="w-5 h-5" /></button>
        </div>

        {loading ? (
          <div className="p-20 text-center text-gray-500">Analyzing fingerprint...</div>
        ) : !data ? (
          <div className="p-20 text-center text-red-400">Failed to load dossier.</div>
        ) : (
          <div className="p-8 overflow-y-auto space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Account Details</h3>
                <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between border-b border-white/5 pb-2"><span>Name</span><span className="text-white font-bold">{data.user.name}</span></div>
                  <div className="flex justify-between border-b border-white/5 pb-2"><span>Email</span><span className="text-gray-400">{data.user.email}</span></div>
                  <div className="flex justify-between border-b border-white/5 pb-2"><span>Tier</span><span className="text-primary font-bold">{data.user.tier_type}</span></div>
                  <div className="flex justify-between"><span>Status</span><span className={data.user.status === 'active' ? 'text-emerald-500' : 'text-red-500'}>{data.user.status}</span></div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Financial Status</h3>
                <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between border-b border-white/5 pb-2"><span>Total Balance</span><span className="text-white font-bold">{data.wallet.balance} GHS</span></div>
                  <div className="flex justify-between border-b border-white/5 pb-2"><span>Withdrawable</span><span className="text-emerald-500 font-bold">{data.wallet.withdrawable} GHS</span></div>
                  <button onClick={adjustWallet} className="w-full bg-primary/10 text-primary border border-primary/20 py-2 rounded-xl font-bold text-xs hover:bg-primary transition-all hover:text-white">Adjust Wallet</button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Network Impact</h3>
                <div className="bg-white/5 rounded-2xl p-4 space-y-3 font-mono text-xs">
                  <div className="flex justify-between"><span>Direct Referrals</span><span>{data.children_count}</span></div>
                  <div className="flex justify-between"><span>Tree Depth</span><span>{data.depth}</span></div>
                  <div className="flex justify-between"><span>Path</span><span className="text-[9px] text-gray-500">{data.path}</span></div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Code Inventory</h3>
                <div className="bg-white/5 rounded-2xl p-4 space-y-3 text-xs">
                  <div className="flex justify-between"><span>Total Created</span><span>{data.codes_count}</span></div>
                  <div className="flex justify-between"><span>Unused / Available</span><span className="text-primary font-bold">{data.codes_unused}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
});

export default InspectUserModal;
