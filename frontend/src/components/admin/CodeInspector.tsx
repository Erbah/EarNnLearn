'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, Smile, CheckCircle2, Zap, ShoppingBag, Trash2, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { API_BASE_URL, api } from '@/lib/api';
import axios from 'axios';
import { AdminStatCard } from './AdminStatCard';
import { ShareModal } from './ShareModal';
import { useDebounce } from '@/hooks/useDebounce';

const API = `${API_BASE_URL}/api/v1/admin`;

interface CodeRowProps {
  code: any;
  isSelected: boolean;
  onSelectChange: (id: string, checked: boolean) => void;
  onShare: (code: string) => void;
  onDelete: (id: string) => void;
}

const CodeRow = React.memo(function CodeRow({ code, isSelected, onSelectChange, onShare, onDelete }: CodeRowProps) {
  const handleSelectChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSelectChange(code.id, e.target.checked);
  }, [code.id, onSelectChange]);

  const handleShareClick = useCallback(() => {
    onShare(code.rid_code);
  }, [code.rid_code, onShare]);

  const handleDeleteClick = useCallback(() => {
    onDelete(code.id);
  }, [code.id, onDelete]);

  return (
    <tr className={isSelected ? 'bg-primary/5' : ''}>
      <td className="px-6 py-4">
        {!code.is_used && (
          <input 
            type="checkbox" 
            checked={isSelected}
            onChange={handleSelectChange}
            className="rounded border-white/20 bg-transparent text-primary focus:ring-primary"
          />
        )}
      </td>
      <td className="px-6 py-4 font-mono text-gray-300 font-bold">{code.rid_code?.slice(0, 10)}...</td>
      <td className="px-6 py-4 text-[10px] uppercase text-primary/70">{code.tier_type}</td>
      <td className="px-6 py-4 text-center">{code.is_used ? 'Used' : 'Avail'}</td>
      <td className="px-6 py-4 text-center">{code.price} GHS</td>
      <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
        <button 
          onClick={handleShareClick} 
          className="p-1 px-3 bg-primary/10 text-primary rounded-lg text-[10px]"
        >
          Share
        </button>
        {!code.is_used && (
          <button 
            onClick={handleDeleteClick}
            className="p-1 px-2 bg-red-500/10 text-red-500 rounded-lg"
          >
            <X size={12} />
          </button>
        )}
      </td>
    </tr>
  );
});

interface CodeInspectorProps {
  onClose: () => void;
}

export const CodeInspector = React.memo(function CodeInspector({ onClose }: CodeInspectorProps) {
  const [codes, setCodes] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [loading, setLoading] = useState(true);
  const [sharingCode, setSharingCode] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    try {
      const [codesRes, statsRes] = await Promise.all([
        api.get(`${API}/codes?search=${debouncedSearch}`, { signal }),
        api.get(`${API}/codes/stats`, { signal })
      ]);
      setCodes(codesRes.data);
      setStats(statsRes.data);
      setLoading(false);
    } catch (e: any) {
      if (axios.isCancel(e)) return;
      if (e.response?.status === 401) {
        alert("Admin Token Expired! Please log out and unlock the gateway again.");
        window.location.href = '/admin-login';
      }
    }
  }, [debouncedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  const handlePurgeAll = useCallback(async () => {
    if (!confirm("DANGER: This will delete ALL unused RIDs on the platform. Continue?")) return;
    const s = prompt("Type 'PURGE ALL' to confirm:");
    if (s !== 'PURGE ALL') return;
    setLoading(true);
    try {
      const res = await api.delete(`${API}/codes/purge-unused`);
      alert(`Purged ${res.data.deleted_count} unused RIDs.`);
      loadData();
    } catch (e: any) {
      alert("Failed to purge codes: " + (e.response?.data?.detail || e.message));
    }
  }, [loadData]);

  const handleDeleteBulk = useCallback(async () => {
    if (!confirm(`Delete ${selectedIds.length} selected codes?`)) return;
    setDeletingBulk(true);
    try {
      await Promise.all(selectedIds.map(id => api.delete(`${API}/codes/${id}`)));
      setSelectedIds([]);
      loadData();
      alert("Selected codes deleted successfully.");
    } catch (e) {}
    setDeletingBulk(false);
  }, [selectedIds, loadData]);

  const handleSelectChange = useCallback((id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(x => x !== id));
    }
  }, []);

  const handleSelectAllChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(codes.filter(c => !c.is_used).map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  }, [codes]);

  const handleShare = useCallback((codeString: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://earnnlearn.com';
    const text = `Check out this activation code: ${codeString}`;
    const url = `${origin}/register?code=${codeString}&type=rid`;
    if (navigator.share) {
      navigator.share({ title: 'Share Code', text, url }).catch(() => setSharingCode(codeString));
    } else {
      setSharingCode(codeString);
    }
  }, []);

  const handleDeleteSingle = useCallback(async (id: string) => {
    if (!confirm("Delete this code?")) return;
    try {
      await api.delete(`${API}/codes/${id}`);
      loadData();
    } catch (e) {}
  }, [loadData]);

  const handleCloseShare = useCallback(() => {
    setSharingCode(null);
  }, []);

  const unusedCodesCount = useMemo(() => codes.filter(c => !c.is_used).length, [codes]);
  const isAllSelected = useMemo(() => selectedIds.length > 0 && selectedIds.length === unusedCodesCount, [selectedIds, unusedCodesCount]);

  if (!mounted) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 text-white"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="bg-card border border-white/10 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center"><Eye className="w-5 h-5 text-primary" /></div>
             <div><h2 className="text-xl font-bold text-white">RID Activation Inspector</h2><p className="text-xs text-gray-400">Manage and audit generated system codes</p></div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-500"><X className="w-6 h-6" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-5 gap-4">
            <AdminStatCard icon={<Smile />} label="Total" value={stats?.total || 0} color="blue" />
            <AdminStatCard icon={<CheckCircle2 />} label="Available" value={stats?.unused || 0} color="emerald" />
            <AdminStatCard icon={<Zap />} label="Used" value={stats?.used || 0} color="orange" />
            <AdminStatCard icon={<ShoppingBag />} label="Value" value={`₵${stats?.total_value?.toFixed(2) || 0}`} color="purple" />
            <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4 flex flex-col justify-center gap-2">
              <div className="text-[10px] uppercase font-bold text-red-400 tracking-widest text-center">Batch Reset</div>
              <button 
                 onClick={handlePurgeAll}
                 className="w-full bg-red-500 text-white py-2 rounded-xl text-[10px] font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                Purge All Unused
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center gap-4 bg-white/5 p-4 rounded-2xl">
            <div className="flex-1 max-w-md">
              <input
                type="text"
                value={search}
                onChange={handleSearchChange}
                placeholder="Search codes by RID..."
                className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary/50 transition-all"
              />
            </div>
          </div>

          {selectedIds.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center bg-primary/10 border border-primary/20 p-4 rounded-2xl">
              <span className="text-xs font-bold text-primary">{selectedIds.length} codes selected for deletion</span>
              <button 
                onClick={handleDeleteBulk}
                disabled={deletingBulk}
                className="bg-red-500 text-white px-4 py-2 rounded-xl text-[10px] font-bold flex items-center gap-2"
              >
                {deletingBulk ? <Loader2 className="animate-spin w-3 h-3" /> : <Trash2 size={12} />}
                Confirm Delete Selected
              </button>
            </motion.div>
          )}

          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/10 text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                <tr>
                  <th className="px-6 py-4 w-10">
                    <input 
                      type="checkbox" 
                      onChange={handleSelectAllChange}
                      checked={isAllSelected}
                      className="rounded border-white/20 bg-transparent text-primary focus:ring-primary"
                    />
                  </th>
                  <th className="px-6 py-4">RID_CODE</th>
                  <th className="px-6 py-4">Tier</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Price</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {codes.map((c) => (
                  <CodeRow
                    key={c.id}
                    code={c}
                    isSelected={selectedIds.includes(c.id)}
                    onSelectChange={handleSelectChange}
                    onShare={handleShare}
                    onDelete={handleDeleteSingle}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
      <AnimatePresence>{sharingCode && <ShareModal code={sharingCode} onClose={handleCloseShare} />}</AnimatePresence>
    </motion.div>,
    document.body
  );
});

export default CodeInspector;
