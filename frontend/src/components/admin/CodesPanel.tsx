'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { X, Hash, Sparkles, Eye, Trash2, Loader2 } from 'lucide-react';
import { API_BASE_URL, api } from '@/lib/api';
import { CodeInspector } from './CodeInspector';
import { AIAdvisorModal } from './AIAdvisorModal';

const API = `${API_BASE_URL}/api/v1/admin`;

interface ConfigRowProps {
  config: any;
  index: number;
  onRemove: (index: number) => void;
  onChange: (index: number, field: string, value: any) => void;
}

const ConfigRow = React.memo(function ConfigRow({ config, index, onRemove, onChange }: ConfigRowProps) {
  const handleRemove = useCallback(() => {
    onRemove(index);
  }, [index, onRemove]);

  const handleTierChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(index, 'tier_type', e.target.value);
  }, [index, onChange]);

  const handleCountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, 'count', parseInt(e.target.value) || 0);
  }, [index, onChange]);

  const handlePriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, 'price', parseFloat(e.target.value) || 0);
  }, [index, onChange]);

  return (
    <div className="flex gap-4 items-end bg-white/5 p-4 rounded-xl border border-white/5 relative group">
      <button 
        onClick={handleRemove} 
        className="absolute top-2 right-2 p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex-1 space-y-1.5">
        <label className="text-[10px] uppercase font-bold text-gray-400">Tier Type</label>
        <select 
          value={config.tier_type} 
          onChange={handleTierChange}
          className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2.5 text-white text-xs outline-none focus:border-primary"
        >
          <option value="public" className="bg-background">Public</option>
          <option value="creator" className="bg-background">Creator</option>
          <option value="ngo" className="bg-background">NGO</option>
        </select>
      </div>
      
      <div className="flex-1 space-y-1.5">
        <label className="text-[10px] uppercase font-bold text-gray-400">Count</label>
        <input 
          type="number" 
          value={config.count} 
          onChange={handleCountChange} 
          className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2.5 text-white text-xs outline-none focus:border-primary"
        />
      </div>
      
      <div className="flex-1 space-y-1.5">
        <label className="text-[10px] uppercase font-bold text-gray-400">Price (GHS)</label>
        <input 
          type="number" 
          value={config.price} 
          onChange={handlePriceChange} 
          className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2.5 text-white text-xs outline-none focus:border-primary"
        />
      </div>
    </div>
  );
});

interface HistoryRowProps {
  session: any;
  onDelete: (id: string) => void;
}

const HistoryRow = React.memo(function HistoryRow({ session, onDelete }: HistoryRowProps) {
  const handleDelete = useCallback(() => {
    onDelete(session.id);
  }, [session.id, onDelete]);

  return (
    <tr className="hover:bg-white/5 transition-colors group">
      <td className="px-4 py-4 font-bold text-primary uppercase">{session.tier_type}</td>
      <td className="px-4 py-4 text-center text-white font-mono">{session.count}</td>
      <td className="px-4 py-4 text-center text-gray-400 font-mono">{session.price} GHS</td>
      <td className="px-4 py-4 text-center text-gray-500">{new Date(session.created_at).toLocaleString()}</td>
      <td className="px-4 py-4 text-right">
        <button 
          onClick={handleDelete}
          className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
          title="Delete Session"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
});

export const CodesPanel = React.memo(function CodesPanel() {
  const [configs, setConfigs] = useState<any[]>([{ tier_type: 'public', count: 10, price: 20, platform_share: 40, seller_share: 30, family_share: 30 }]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [advisorData, setAdvisorData] = useState<any>(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const resp = await api.get(`${API}/codes/sessions`);
      setHistory(resp.data);
    } catch (e) {}
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const fetchStrategy = useCallback(async () => {
    setAdvisorLoading(true);
    setShowAdvisor(true);
    try {
      const resp = await api.get(`${API}/ai/strategy`);
      setAdvisorData(resp.data);
    } catch (e) {}
    setAdvisorLoading(false);
  }, []);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.post(`${API}/codes/generate`, { configs });
      if (res.status === 200 || res.status === 201) { 
        setResult(res.data); 
        loadHistory(); 
        alert("Bulk generation successful! Check the Inspector.");
      } else {
        alert("Generation Error");
      }
    } catch (e: any) {
      alert("Error: " + (e.response?.data?.detail || "Could not reach Admin Service"));
    }
    setLoading(false);
  }, [configs, loadHistory]);

  const handleAddTier = useCallback(() => {
    setConfigs(prev => [...prev, { tier_type: 'public', count: 10, price: 20, platform_share: 40, seller_share: 30, family_share: 30 }]);
  }, []);

  const handleRemoveTier = useCallback((idx: number) => {
    setConfigs(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleConfigChange = useCallback((idx: number, field: string, value: any) => {
    setConfigs(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  }, []);

  const handleOpenInspector = useCallback(() => {
    setShowInspector(true);
  }, []);

  const handleCloseInspector = useCallback(() => {
    setShowInspector(false);
  }, []);

  const handleCloseAdvisor = useCallback(() => {
    setShowAdvisor(false);
  }, []);

  const handleApplyAdvisorConfig = useCallback((cfg: any) => {
    setConfigs([cfg]);
    setShowAdvisor(false);
  }, []);

  const handleDeleteSession = useCallback(async (id: string) => {
    if (!confirm("Permanently delete UNUSED codes from this batch?")) return;
    try {
      const res = await api.delete(`${API}/codes/sessions/${id}`);
      alert(res.data.message);
      loadHistory();
    } catch (e) {}
  }, [loadHistory]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="p-6 bg-card/70 border border-white/5 rounded-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-white">🔑 Bulk Generate Codes</h3>
          <button onClick={handleAddTier} className="text-xs text-primary font-bold bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">+ Add Tier</button>
        </div>
        
        <div className="space-y-4 mb-6">
          {configs.map((conf, i) => (
            <ConfigRow
              key={i}
              config={conf}
              index={i}
              onRemove={handleRemoveTier}
              onChange={handleConfigChange}
            />
          ))}
          {configs.length === 0 && (
            <div className="p-8 text-center text-gray-500 border border-dashed border-white/10 rounded-xl">
              No tiers added. Click "+ Add Tier" to configure a generation batch.
            </div>
          )}
        </div>

        <button onClick={generate} disabled={loading || configs.length === 0} className="w-full py-3.5 bg-primary text-background font-bold rounded-2xl hover:scale-[1.02] transition-all disabled:opacity-50">
          {loading ? 'Generating Codes...' : 'Confirm and Generate'}
        </button>
      </div>
      <div className="p-6 bg-card/70 border border-white/5 rounded-2xl space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Hash size={18} className="text-primary" />
            Generation History
          </h3>
          <div className="flex items-center gap-4">
            <button onClick={fetchStrategy} className="text-[10px] uppercase font-bold text-primary flex items-center gap-2 bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10 hover:bg-primary/10 transition-all">
              <Sparkles size={12}/> AI Analysis
            </button>
            <button onClick={handleOpenInspector} className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 hover:bg-white/10 transition-all">
              <Eye size={12} /> Inspector
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {history.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-white/10 rounded-2xl text-gray-500 italic text-xs">
              No generation batches recorded yet.
            </div>
          ) : (
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="text-gray-500 uppercase tracking-widest font-bold border-b border-white/5">
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3 text-center">Batch Count</th>
                  <th className="px-4 py-3 text-center">Price</th>
                  <th className="px-4 py-3 text-center">Date</th>
                  <th className="px-4 py-3 text-right">Reset</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.map(s => (
                  <HistoryRow
                    key={s.id}
                    session={s}
                    onDelete={handleDeleteSession}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <AnimatePresence>
        {showInspector && <CodeInspector onClose={handleCloseInspector} />}
        {showAdvisor && <AIAdvisorModal data={advisorData} loading={advisorLoading} onClose={handleCloseAdvisor} onApply={handleApplyAdvisorConfig} />}
      </AnimatePresence>
    </div>
  );
});

export default CodesPanel;
