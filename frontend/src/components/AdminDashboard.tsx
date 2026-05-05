'use client';
// Rebuild: 2026-03-22T17:15:00
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Download, X, Smile, CheckCircle2, Zap, ShoppingBag,
  ChevronDown, ExternalLink, Eye, EyeOff, Key, Hash, DollarSign, Globe,
  Share2, MessageCircle, Twitter, Facebook, Copy, Send, Loader2, Check, Lock, Sparkles, LogOut, Trash2,
  CheckCircle, ShieldCheck, AlertCircle
} from 'lucide-react';

import { API_BASE_URL, api } from '@/lib/api';
const API = `${API_BASE_URL}/api/v1/admin`;

function Stat({ label, value, color = '#00E0FF' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex flex-col justify-center min-h-[110px] hover:border-white/20 transition-all">
      <div className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2">{label}</div>
      <div className="text-3xl font-black tracking-tight" style={{ color }}>{value}</div>
    </div>
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 rounded-xl border-none cursor-pointer text-[13px] font-semibold transition-all duration-200 ${active ? 'bg-primary/15 text-primary' : 'bg-transparent text-gray-400'
        }`}
    >
      {label}
    </button>
  );
}

function SeasonsPanel() {
  const [seasons, setSeasons] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [isRidDeleting, setIsRidDeleting] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [newSeasonNum, setNewSeasonNum] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => { loadSeasons(); }, []);

  const loadSeasons = () => {
    api.get(`${API}/seasons`)
      .then(res => setSeasons(Array.isArray(res.data) ? res.data : []))
      .catch(() => { });
  };

  const createSeason = async () => {
    if (!newSeasonNum || !startDate) {
      alert("Season Number and Start Date are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post(`${API}/seasons`, {
        season_number: parseInt(newSeasonNum),
        start_date: new Date(startDate).toISOString(),
        end_date: endDate ? new Date(endDate).toISOString() : null
      });

      if (res.status === 200 || res.status === 201) {
        setShowScheduleModal(false);
        setNewSeasonNum('');
        setStartDate('');
        setEndDate('');
        loadSeasons();
      } else {
        alert("Failed to create season");
      }
    } catch (e) {
      alert("Network error occurred.");
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (confirmPhrase !== "DELETE RID SEASON") {
      alert("Please type the confirmation phrase exactly.");
      return;
    }
    setLoading(true);
    const res = await api.delete(`${API}/seasons/${deletingId}/rids?confirmation_phrase=${confirmPhrase}`);
    if (res.status === 200) {
      const data = res.data;
      alert(`Successfully deleted ${data.deleted_count} unused RIDs.`);
      setIsRidDeleting(false);
      setDeletingId(null);
      setConfirmPhrase('');
    } else {
      alert("Deletion failed. Check permissions.");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-[16px] font-bold text-white">📅 Transaction Seasons</h3>
        <button
          onClick={() => setShowScheduleModal(true)}
          className="bg-primary text-background px-4 py-2 rounded-xl text-[12px] font-bold hover:opacity-90 transition-all flex items-center gap-2"
        >
          <Sparkles size={14} />
          Schedule New Season
        </button>
      </div>

      {/* Schedule Modal */}
      <AnimatePresence>
        {showScheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowScheduleModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-[#0A0C10] border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
              
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Globe className="text-primary" size={20} />
                  Schedule New Season
                </h3>
                <button onClick={() => setShowScheduleModal(false)} className="text-gray-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 px-1">Season Number</label>
                  <input
                    type="number"
                    value={newSeasonNum}
                    onChange={(e) => setNewSeasonNum(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 px-1">Start Date</label>
                    <input
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-all text-[12px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 px-1">End Date (Optional)</label>
                    <input
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-all text-[12px]"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={createSeason}
                    disabled={loading}
                    className="w-full bg-primary text-background h-12 rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : 'Create Season'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid gap-4">
        {seasons.map(s => (
          <div key={s.id} className="bg-card/70 border border-white/5 rounded-2xl p-6 flex justify-between items-center">
            <div>
              <div className="text-[18px] font-bold text-white">Season {s.season_number}</div>
              <div className="text-[12px] text-gray-500">Started: {new Date(s.start_date).toLocaleDateString()}</div>
              {s.is_active && <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ml-2">Active</span>}
            </div>
            <button
              onClick={() => { setDeletingId(s.id); setIsRidDeleting(true); }}
              className="bg-red-500/10 text-red-500 border border-red-500/20 px-4 py-2 rounded-xl text-[12px] font-bold hover:bg-red-500 hover:text-white transition-all"
            >
              Clear Unused RIDs
            </button>
          </div>
        ))}
      </div>

      {isRidDeleting && (
        <div className="fixed inset-0 z-[150] bg-background/95 flex items-center justify-center p-4">
          <div className="bg-card border border-red-500/20 p-8 rounded-3xl max-w-sm w-full space-y-6">
            <h4 className="text-xl font-bold text-white">⚠️ Destructive Action</h4>
            <p className="text-sm text-gray-400">
              You are about to delete ALL unused RID codes for this season. This cannot be undone.
            </p>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Type "DELETE RID SEASON" to confirm</label>
              <input
                value={confirmPhrase}
                onChange={e => setConfirmPhrase(e.target.value)}
                title="Type confirmation phrase here"
                aria-label="Confirmation phrase"
                className="w-full bg-white/5 border border-red-500/30 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500"
              />
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setIsRidDeleting(false)}
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-gray-400 font-bold text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading || confirmPhrase !== "DELETE RID SEASON"}
                className={`flex-1 px-4 py-3 rounded-xl font-bold text-[13px] ${loading ? 'bg-gray-700' : 'bg-red-500 text-white'}`}
              >
                {loading ? 'Deleting...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewPanel() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    api.get(`${API}/analytics`)
      .then(res => setData(res.data && typeof res.data === 'object' ? res.data : null))
      .catch(() => { });
  }, []);
  if (!data) return <div style={{ color: '#9CA3AF', padding: '40px', textAlign: 'center' }}>Loading analytics...</div>;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5 mb-8">
        <Stat label="Total Users" value={data.total_users ?? 0} />
        <Stat label="Activated Users" value={data.activated_users ?? 0} color="#FFD700" />
        <Stat label="Revenue (GHS)" value={(Number(data?.total_revenue) || 0).toFixed(2)} color="#10B981" />
        <Stat label="Codes Used" value={data.codes_used ?? 0} />
        <Stat label="Codes Available" value={data.codes_available ?? 0} color="#FFD700" />
        <Stat label="Total Payouts (GHS)" value={(Number(data?.total_payouts) || 0).toFixed(2)} color="#F59E0B" />
      </div>
      {(data.top_promoters && data.top_promoters.length > 0) && (
        <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl p-6 border border-white/10 max-w-2xl">
          <h3 className="text-xs uppercase font-bold text-gray-400 tracking-widest mb-6">🏆 Top Promoters</h3>
          <div className="space-y-4">
            {data.top_promoters.map((p: any, i: number) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                <span className="text-primary font-mono font-bold">{p.rid}</span>
                <span className="text-yellow-500 font-bold text-sm">{p.network_size} referrals</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsPanel() {
  const [settings, setSettings] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  useEffect(() => {
    api.get(`${API}/settings`).then(res => setSettings(res.data)).catch(() => { });
  }, []);

  const save = async (key: string) => {
    await api.put(`${API}/settings/${key}`, { value: editVal });
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value: editVal } : s));
    setEditing(null);
  };

  return (
    <div style={{ background: 'rgba(27,36,51,0.7)', borderRadius: '14px', padding: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#E5E7EB', marginBottom: '16px' }}>⚙️ System Settings</h3>
      {settings.map(s => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#E5E7EB' }}>{s.key}</div>
            <div style={{ fontSize: '11px', color: '#6B7280' }}>{s.description}</div>
          </div>
          {editing === s.key ? (
            <div className="flex gap-2">
              <input
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                title={`Edit value for ${s.key}`}
                aria-label={`Edit value for ${s.key}`}
                className="bg-white/5 border border-primary/30 rounded-lg px-3 py-1.5 text-foreground text-[13px] w-30 outline-none"
              />
              <button
                onClick={() => save(s.key)}
                className="bg-primary text-background border-none rounded-lg px-4 py-1.5 font-semibold text-[12px] cursor-pointer"
              >
                Save
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: '#FFD700', fontFamily: 'monospace', fontSize: '14px' }}>{s.value}</span>
              <button onClick={() => { setEditing(s.key); setEditVal(s.value); }}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '4px 12px', color: '#9CA3AF', fontSize: '11px', cursor: 'pointer' }}>Edit</button>
            </div>
          )}
        </div>
      ))}

      <hr style={{ border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', margin: '24px 0' }} />
      <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#E5E7EB', marginBottom: '16px' }}>🔒 Update Master Password</h3>
      
      <div className="flex flex-col gap-3 max-w-sm">
        <input
          type="password"
          placeholder="Current Password"
          value={currentPw}
          onChange={e => { setCurrentPw(e.target.value); setPwMsg(''); }}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground text-[13px] outline-none focus:border-primary"
        />
        <input
          type="password"
          placeholder="New Password"
          value={newPw}
          onChange={e => { setNewPw(e.target.value); setPwMsg(''); }}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground text-[13px] outline-none focus:border-primary"
        />
        <button
          onClick={async () => {
            if (!currentPw || !newPw) { setPwMsg('Fill required fields'); return; }
            setPwMsg('Updating...');
            try {
              const res = await api.put(`${API}/credentials`, { current_password: currentPw, new_password: newPw });
              setPwMsg('Password updated successfully!');
              setCurrentPw(''); setNewPw('');
            } catch (e: any) {
              setPwMsg(e.response?.data?.detail || 'Update failed');
            }
          }}
          disabled={!currentPw || !newPw}
          className="bg-primary text-background font-bold px-4 py-2.5 rounded-xl text-[13px] hover:scale-[1.02] transition-all disabled:opacity-50"
        >
          Change Password
        </button>
        {pwMsg && <div className="text-[12px] text-primary">{pwMsg}</div>}
      </div>
    </div>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [inspectingRid, setInspectingRid] = useState<string | null>(null);

  useEffect(() => {
    api.get(`${API}/users`)
      .then(res => setUsers(Array.isArray(res.data) ? res.data : []))
      .catch(() => { });
  }, []);

  return (
    <div style={{ background: 'rgba(27,36,51,0.7)', borderRadius: '14px', padding: '20px', border: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#E5E7EB', marginBottom: '16px' }}>👥 Users ({users.length})</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            {['Name', 'Email', 'RID', 'Tier', 'Status', 'Actions'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#9CA3AF', fontWeight: 500 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <td style={{ padding: '10px 12px', color: '#E5E7EB' }}>{u.name}</td>
              <td style={{ padding: '10px 12px', color: '#9CA3AF' }}>{u.email}</td>
              <td style={{ padding: '10px 12px', color: '#00E0FF', fontFamily: 'monospace', fontSize: '11px' }}>{u.rid || '—'}</td>
              <td style={{ padding: '10px 12px' }}><span style={{ background: 'rgba(0,224,255,0.1)', color: '#00E0FF', padding: '2px 10px', borderRadius: '20px', fontSize: '11px' }}>{u.tier_type}</span></td>
              <td style={{ padding: '10px 12px' }}><span style={{ color: u.status === 'active' ? '#10B981' : '#EF4444' }}>{u.status}</span></td>
              <td style={{ padding: '10px 12px' }}>
                <button
                  onClick={() => setInspectingRid(u.rid)}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-primary transition-colors"
                  title="Inspect User"
                >
                  <Search className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <AnimatePresence>
        {inspectingRid && <InspectUserModal rid={inspectingRid} onClose={() => setInspectingRid(null)} />}
      </AnimatePresence>
    </div>
  );
}

function PayoutsPanel() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadRequests(); }, []);

  const loadRequests = () => {
    api.get(`${API}/withdrawals/pending`)
      .then(res => setRequests(Array.isArray(res.data) ? res.data : []))
      .finally(() => setLoading(false));
  };

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    const reason = action === 'reject' ? prompt("Enter rejection reason:") : null;
    if (action === 'reject' && !reason) return;

    try {
      await api.post(`${API}/withdrawals/${id}/${action}${reason ? `?reason=${reason}` : ''}`);
      alert(`Withdrawal ${action}d successfully`);
      loadRequests();
    } catch (e) {}
  };

  return (
    <div className="bg-card/70 border border-white/5 rounded-2xl p-6">
      <h3 className="text-lg font-bold text-white mb-6">💰 Pending Withdrawals</h3>
      {loading ? (
        <div className="p-10 text-center text-gray-500">Loading requests...</div>
      ) : requests.length === 0 ? (
        <div className="p-10 text-center text-gray-500 italic">No pending withdrawal requests</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-gray-500">
                <th className="px-4 py-3 font-bold uppercase tracking-widest text-[10px]">RID</th>
                <th className="px-4 py-3 font-bold uppercase tracking-widest text-[10px]">Amount</th>
                <th className="px-4 py-3 font-bold uppercase tracking-widest text-[10px]">Method</th>
                <th className="px-4 py-3 font-bold uppercase tracking-widest text-[10px]">Details</th>
                <th className="px-4 py-3 font-bold uppercase tracking-widest text-[10px]">Date</th>
                <th className="px-4 py-3 font-bold uppercase tracking-widest text-[10px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {requests.map(req => (
                <tr key={req.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-4 font-mono text-primary">{req.user_rid}</td>
                  <td className="px-4 py-4 font-bold text-white">{req.amount} GHS</td>
                  <td className="px-4 py-4 text-gray-400">{req.payout_method}</td>
                  <td className="px-4 py-4 text-gray-500 text-[11px]">
                    {Object.entries(req.payout_details || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}
                  </td>
                  <td className="px-4 py-4 text-gray-500">{new Date(req.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-4 text-right space-x-2">
                    <button
                      onClick={() => handleAction(req.id, 'approve')}
                      className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold hover:opacity-80 transition-all"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(req.id, 'reject')}
                      className="bg-red-500/10 text-red-500 border border-red-500/20 px-3 py-1.5 rounded-lg font-bold hover:bg-red-500 hover:text-white transition-all"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InspectUserModal({ rid, onClose }: { rid: string, onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`${API}/users/${rid}`)
      .then(res => setData(res.data))
      .finally(() => setLoading(false));
  }, [rid]);

  const adjustWallet = async () => {
    const amt = prompt("Enter adjustment amount (can be negative):");
    if (!amt) return;
    const reason = prompt("Enter reason for adjustment:");
    await api.post(`${API}/users/${rid}/adjust-wallet?amount=${amt}&reason=${reason}`);
    alert("Wallet adjusted");
    api.get(`${API}/users/${rid}`).then(res => setData(res.data));
  };

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
}

function ShareModal({ code, onClose }: { code: string, onClose: () => void }) {
  const shareText = `Check out this activation code: ${code}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://earnnlearn.com';
  const url = `${origin}/register?code=${code}&type=rid`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    alert('Code copied to clipboard!');
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Share Activation Code',
        text: shareText,
        url: url,
      }).catch(err => console.log('Share failed:', err));
    }
  };

  const platforms = [
    { name: 'WhatsApp', icon: <MessageCircle className="w-5 h-5" />, color: 'bg-[#25D366]', link: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + url)}` },
    { name: 'Telegram', icon: <Send className="w-5 h-5" />, color: 'bg-[#0088CC]', link: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}` },
    { name: 'Twitter', icon: <Twitter className="w-5 h-5" />, color: 'bg-[#1DA1F2]', link: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}` },
    { name: 'Facebook', icon: <Facebook className="w-5 h-5" />, color: 'bg-[#1877F2]', link: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { name: 'SMS', icon: <Hash className="w-5 h-5" />, color: 'bg-gray-600', link: `sms:?body=${encodeURIComponent(shareText + ' ' + url)}` },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-background/90 backdrop-blur-md p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="bg-card border border-white/10 w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-6"
      >
        <div className="flex justify-between items-center text-white">
          <h3 className="text-xl font-bold">Share Code</h3>
          <div className="flex gap-2">
            {typeof navigator !== 'undefined' && !!navigator.share && (
              <button onClick={handleNativeShare} title="Native Share" className="p-2 bg-primary/20 text-primary rounded-full hover:bg-primary/30 transition-all">
                <Share2 className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} title="Close Share Modal" className="p-2 hover:bg-white/5 rounded-full text-gray-400"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
          <span className="font-mono text-primary font-bold text-lg">{code}</span>
          <button onClick={copyToClipboard} title="Copy Code" className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all">
            <Copy className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {platforms.map(p => (
            <a key={p.name} href={p.link} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 group">
              <div className={`w-14 h-14 rounded-2xl ${p.color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
                {p.icon}
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{p.name}</span>
            </a>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatCard({ icon, label, value, color }: { icon: any, label: string, value: any, color: string }) {
  const colors: any = {
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    orange: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    purple: "bg-purple-500/10 text-purple-500 border-purple-500/20"
  };
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 transition-hover hover:border-white/20">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color].split(' ')[0]} ${colors[color].split(' ')[1]}`}>
        {icon}
      </div>
      <div>
        <div className="text-[10px] uppercase font-bold text-gray-500 tracking-widest text-[#9CA3AF]">{label}</div>
        <div className="text-2xl font-bold text-white">{value}</div>
      </div>
    </div>
  );
}

function DatabaseInspector({ onClose }: { onClose: () => void }) {
  const [codes, setCodes] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sharingCode, setSharingCode] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletingBulk, setDeletingBulk] = useState(false);

  useEffect(() => { loadData(); }, [search]);
  const loadData = async () => {
    try {
      const [codesRes, statsRes] = await Promise.all([
        api.get(`${API}/codes?search=${search}`),
        api.get(`${API}/codes/stats`)
      ]);
      setCodes(codesRes.data);
      setStats(statsRes.data);
      setLoading(false);
    } catch (e: any) {
      if (e.response?.status === 401) {
        alert("Admin Token Expired! Please log out and unlock the gateway again.");
        window.location.href = '/admin-login';
      }
    }
  };

  return (
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
             <div><h2 className="text-xl font-bold text-white">Database Inspector</h2><p className="text-xs text-gray-400">Manage and audit generated system codes</p></div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-500"><X className="w-6 h-6" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <StatCard icon={<Smile />} label="Total" value={stats?.total || 0} color="blue" />
            <StatCard icon={<CheckCircle2 />} label="Available" value={stats?.unused || 0} color="emerald" />
            <StatCard icon={<Zap />} label="Used" value={stats?.used || 0} color="orange" />
            <StatCard icon={<ShoppingBag />} label="Value" value={`₵${(stats?.total * 20) || 0}`} color="purple" />
            <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4 flex flex-col justify-center gap-2">
              <div className="text-[10px] uppercase font-bold text-red-400 tracking-widest text-center">Batch Reset</div>
              <button 
                 onClick={async () => {
                   if (!confirm("DANGER: This will delete ALL unused RIDs on the platform. Continue?")) return;
                   const s = prompt("Type 'PURGE ALL' to confirm:");
                   if (s !== 'PURGE ALL') return;
                   setLoading(true);
                   // We'll use the existing season delete logic or a new global one.
                   // For now, I'll just delete the ones currently in the inspector view if selected, 
                   // or better yet, a new                    alert("Purging all unused codes...");
                    try {
                      const res = await api.delete(`${API}/codes/purge-unused`);
                      alert(`Purged ${res.data.deleted_count} unused RIDs.`);
                      loadData();
                    } catch (e) {}
                 }}
                 className="w-full bg-red-500 text-white py-2 rounded-xl text-[10px] font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                Purge All Unused
              </button>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center bg-primary/10 border border-primary/20 p-4 rounded-2xl">
              <span className="text-xs font-bold text-primary">{selectedIds.length} codes selected for deletion</span>
              <button 
                onClick={async () => {
                  if (!confirm(`Delete ${selectedIds.length} selected codes?`)) return;
                  setDeletingBulk(true);
                  try {
                    await Promise.all(selectedIds.map(id => api.delete(`${API}/codes/${id}`)));
                    setSelectedIds([]);
                    loadData();
                    alert("Selected codes deleted successfully.");
                  } catch (e) {}
                  setDeletingBulk(false);
                }}
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
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(codes.filter(c => !c.is_used).map(c => c.id));
                        else setSelectedIds([]);
                      }}
                      checked={selectedIds.length > 0 && selectedIds.length === codes.filter(c => !c.is_used).length}
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
                  <tr key={c.id} className={selectedIds.includes(c.id) ? 'bg-primary/5' : ''}>
                    <td className="px-6 py-4">
                      {!c.is_used && (
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(c.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds([...selectedIds, c.id]);
                            else setSelectedIds(selectedIds.filter(id => id !== c.id));
                          }}
                          className="rounded border-white/20 bg-transparent text-primary focus:ring-primary"
                        />
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-300 font-bold">{c.rid_code?.slice(0, 10)}...</td>
                    <td className="px-6 py-4 text-[10px] uppercase text-primary/70">{c.tier_type}</td>
                    <td className="px-6 py-4 text-center">{c.is_used ? 'Used' : 'Avail'}</td>
                    <td className="px-6 py-4 text-center">{c.price} GHS</td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                      <button 
                        onClick={() => {
                          const origin = typeof window !== 'undefined' ? window.location.origin : 'https://earnnlearn.com';
                          const text = `Check out this activation code: ${c.rid_code}`;
                          const url = `${origin}/register?code=${c.rid_code}&type=rid`;
                          if (navigator.share) {
                            navigator.share({ title: 'Share Code', text, url }).catch(() => setSharingCode(c.rid_code));
                          } else {
                            setSharingCode(c.rid_code);
                          }
                        }} 
                        className="p-1 px-3 bg-primary/10 text-primary rounded-lg text-[10px]"
                      >
                        Share
                      </button>
                      {!c.is_used && (
                        <button 
                          onClick={async () => {
                            if (!confirm("Delete this code?")) return;
                            try {
                              await api.delete(`${API}/codes/${c.id}`);
                              loadData();
                            } catch (e) {}
                          }}
                          className="p-1 px-2 bg-red-500/10 text-red-500 rounded-lg"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
      <AnimatePresence>{sharingCode && <ShareModal code={sharingCode} onClose={() => setSharingCode(null)} />}</AnimatePresence>
    </motion.div>
  );
}

function AIAdvisorModal({ data, loading, onClose, onApply }: { data: any, loading: boolean, onClose: () => void, onApply: (config: any) => void }) {
  if (!data && !loading) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full max-w-lg bg-card border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary"><Sparkles className="w-5 h-5" /></div>
            <div><h3 className="text-lg font-bold text-white leading-none mb-1">AI Strategy Advisor</h3><p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Platform-Wide Analysis</p></div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="p-6 space-y-6">
          {loading ? <div className="py-20 flex flex-col items-center justify-center gap-4"><Loader2 className="w-10 h-10 text-primary animate-spin" /><p className="text-sm text-gray-400 font-medium">Deep scanning ecosystem data...</p></div> : (
            <>
              <div className="flex items-center gap-6 p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <span className="text-xl font-bold text-white">{data?.health_score ?? 0}%</span>
                </div>
                <div><div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Ecosystem Health</div><div className="text-sm text-gray-300 font-medium leading-tight">{data?.global_recommendation}</div></div>
              </div>
              <button onClick={() => onApply(data.suggested_config)} className="w-full py-3 bg-primary text-background font-black rounded-2xl hover:scale-[1.02] transition-all">Apply AI Strategy Batch</button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function CodesPanel() {
  const [configs, setConfigs] = useState<any[]>([{ tier_type: 'public', count: 10, price: 20, platform_share: 40, seller_share: 30, family_share: 30 }]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [advisorData, setAdvisorData] = useState<any>(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);

  useEffect(() => { loadHistory(); }, []);
  const loadHistory = async () => {
    try {
      const resp = await api.get(`${API}/codes/sessions`);
      setHistory(resp.data);
    } catch (e) {}
  };
  const fetchStrategy = async () => {
    setAdvisorLoading(true); setShowAdvisor(true);
    try {
      const resp = await api.get(`${API}/ai/strategy`);
      setAdvisorData(resp.data);
    } catch (e) {}
    setAdvisorLoading(false);
  };
  const generate = async () => {
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
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="p-6 bg-card/70 border border-white/5 rounded-2xl">
        <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold text-white">🔑 Bulk Generate Codes</h3><button onClick={() => setConfigs([...configs, { tier_type: 'public', count: 10, price: 20, platform_share: 40, seller_share: 30, family_share: 30 }])} className="text-xs text-primary font-bold bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">+ Add Tier</button></div>
        
        <div className="space-y-4 mb-6">
          {configs.map((conf, i) => (
            <div key={i} className="flex gap-4 items-end bg-white/5 p-4 rounded-xl border border-white/5 relative group">
              <button 
                onClick={() => setConfigs(configs.filter((_, idx) => idx !== i))} 
                className="absolute top-2 right-2 p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Tier Type</label>
                <select 
                  value={conf.tier_type} 
                  onChange={(e) => { const nc = [...configs]; nc[i].tier_type = e.target.value; setConfigs(nc); }}
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
                  value={conf.count} 
                  onChange={(e) => { const nc = [...configs]; nc[i].count = parseInt(e.target.value) || 0; setConfigs(nc); }} 
                  className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2.5 text-white text-xs outline-none focus:border-primary"
                />
              </div>
              
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Price (GHS)</label>
                <input 
                  type="number" 
                  value={conf.price} 
                  onChange={(e) => { const nc = [...configs]; nc[i].price = parseFloat(e.target.value) || 0; setConfigs(nc); }} 
                  className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2.5 text-white text-xs outline-none focus:border-primary"
                />
              </div>
            </div>
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
            <button onClick={() => setShowInspector(true)} className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 hover:bg-white/10 transition-all">
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
                  <tr key={s.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-4 py-4 font-bold text-primary uppercase">{s.tier_type}</td>
                    <td className="px-4 py-4 text-center text-white font-mono">{s.count}</td>
                    <td className="px-4 py-4 text-center text-gray-400 font-mono">{s.price} GHS</td>
                    <td className="px-4 py-4 text-center text-gray-500">{new Date(s.created_at).toLocaleString()}</td>
                    <td className="px-4 py-4 text-right">
                      <button 
                        onClick={async () => {
                          if (!confirm(`Permanently delete UNUSED codes from this batch (${s.tier_type})?`)) return;
                          try {
                            const res = await api.delete(`${API}/codes/sessions/${s.id}`);
                            alert(res.data.message);
                            loadHistory();
                          } catch (e) { }
                        }}
                        className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Delete Session"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <AnimatePresence>
        {showInspector && <DatabaseInspector onClose={() => setShowInspector(false)} />}
        {showAdvisor && <AIAdvisorModal data={advisorData} loading={advisorLoading} onClose={() => setShowAdvisor(false)} onApply={(c) => setConfigs([c])} />}
      </AnimatePresence>
    </div>
  );
}

function NotificationsPanel() {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = () => {
    api.get(`${API}/notifications`)
      .then(res => setNotes(Array.isArray(res.data) ? res.data : []))
      .finally(() => setLoading(false));
  };

  const markRead = async (id: string) => {
    await api.post(`${API}/notifications/${id}/read`);
    setNotes(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-white">🔔 Platform Notifications</h3>
        <button onClick={loadNotes} className="text-xs text-primary font-bold">Refresh</button>
      </div>
      
      <div className="space-y-3">
        {loading ? (
          <div className="p-10 text-center text-gray-500">Loading alerts...</div>
        ) : notes.length === 0 ? (
          <div className="p-10 text-center text-gray-500 border border-dashed border-white/10 rounded-2xl italic">No notifications found</div>
        ) : (
          notes.map(note => (
            <div key={note.id} className={`p-5 rounded-2xl border transition-all ${note.is_read ? 'bg-white/[0.02] border-white/5 opacity-60' : 'bg-primary/5 border-primary/20 shadow-lg shadow-primary/5'}`}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] uppercase font-black tracking-widest text-primary">{note.type}</span>
                <span className="text-[10px] text-gray-500">{new Date(note.created_at).toLocaleString()}</span>
              </div>
              <h4 className="text-sm font-bold text-white mb-1">{note.title}</h4>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">{note.message}</p>
              
              <div className="flex gap-3">
                {!note.is_read && (
                  <button onClick={() => markRead(note.id)} className="px-4 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-primary hover:text-background transition-all">
                    Mark as Read
                  </button>
                )}
                {note.link && (
                  <a href={note.link} className="flex items-center gap-1.5 px-4 py-1.5 bg-white/5 text-gray-300 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-white/10">
                    <ExternalLink size={12} /> View Details
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CourseReviewPanel() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiReviews, setAiReviews] = useState<Record<string, any>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => { loadPending(); }, []);

  const loadPending = () => {
    setLoading(true);
    api.get(`${API}/courses/pending`)
      .then(res => setCourses(Array.isArray(res.data) ? res.data : []))
      .finally(() => setLoading(false));
  };

  const handleAIReview = async (id: string) => {
    setReviewingId(id);
    try {
      const res = await api.post(`${API}/courses/${id}/ai-review`);
      setAiReviews(prev => ({ ...prev, [id]: res.data }));
    } catch (e) {
      alert("AI Scan failed");
    }
    setReviewingId(null);
  };

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    const reason = action === 'reject' ? prompt("Rejection Reason:") : null;
    if (action === 'reject' && !reason) return;

    try {
      await api.post(`${API}/courses/${id}/${action}`, action === 'reject' ? { reason } : {});
      alert(`Course ${action}d successfully`);
      loadPending();
    } catch (e) {}
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <CheckCircle2 className="text-primary" size={20} />
        Course Review Queue
      </h3>

      {loading ? (
        <div className="p-10 text-center text-gray-500">Scanning for submissions...</div>
      ) : courses.length === 0 ? (
        <div className="p-10 text-center text-gray-500 border border-dashed border-white/10 rounded-2xl italic">No courses awaiting review</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {courses.map(c => (
            <div key={c.id} className="bg-card/70 border border-white/10 rounded-3xl p-6 space-y-4 hover:border-primary/30 transition-all group">
              <div>
                <span className="text-[10px] font-black bg-primary/20 text-primary px-2 py-0.5 rounded uppercase tracking-tighter mb-2 inline-block">{c.category}</span>
                <h4 className="text-xl font-bold text-white group-hover:text-primary transition-colors">{c.title}</h4>
                <p className="text-xs text-gray-500 mt-1">By Creator: <span className="font-mono text-primary/70">{c.creator_rid}</span></p>
              </div>

              <div className="bg-white/5 rounded-2xl p-4 text-xs text-gray-400 leading-relaxed border border-white/5">
                {c.description?.slice(0, 150)}...
              </div>

              <div className="flex items-center justify-between py-2 border-y border-white/5">
                <span className="text-[10px] font-bold text-gray-500 uppercase">Price: GHS {c.price}</span>
                <a href={c.playlist_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary font-bold text-[10px] uppercase hover:underline">
                  <ExternalLink size={12} /> Review Content
                </a>
              </div>

              {/* AI Insight Section */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 relative overflow-hidden">
                {!aiReviews[c.id] ? (
                  <button 
                    onClick={() => handleAIReview(c.id)}
                    disabled={reviewingId === c.id}
                    className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-primary flex items-center justify-center gap-2 hover:bg-primary/10 transition-all rounded-lg"
                  >
                    {reviewingId === c.id ? (
                      <span className="flex items-center gap-2 animate-pulse">
                        <Zap className="w-3 h-3 animate-spin" /> Deep Scanning...
                      </span>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" /> Get AI Specialist Review
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-primary flex items-center gap-1 italic">
                        <Zap className="w-3 h-3" /> AI Recommendation: {aiReviews[c.id].recommendation}
                      </span>
                      <div className="h-1.5 w-16 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${aiReviews[c.id].health_score > 70 ? 'bg-emerald-500' : 'bg-orange-500'}`} 
                          style={{ width: `${aiReviews[c.id].health_score}%` }} 
                        />
                      </div>
                    </div>
                    <ul className="space-y-1">
                      {aiReviews[c.id].suggestions?.map((s: string, idx: number) => (
                        <li key={idx} className="text-[10px] text-gray-400 flex items-start gap-1.5 leading-tight">
                          <span className="mt-1 w-1 h-1 rounded-full bg-primary/40 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => handleAction(c.id, 'approve')} className="flex-1 py-3 bg-emerald-500 text-white font-bold rounded-xl text-[11px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/10">
                  Approve Course
                </button>
                <button onClick={() => handleAction(c.id, 'reject')} className="flex-1 py-3 bg-red-500/10 text-red-500 border border-red-500/20 font-bold rounded-xl text-[11px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AIStrategyPanel() {
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Form State
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  const providers = [
    { id: 'google', name: 'Google Gemini', models: ['gemini/gemini-2.0-flash', 'gemini/gemini-1.5-pro', 'gemini/gemini-1.5-flash'] },
    { id: 'openai', name: 'OpenAI GPT', models: ['openai/gpt-4o', 'openai/gpt-4o-mini'] },
    { id: 'deepseek', name: 'DeepSeek', models: ['deepseek/deepseek-chat', 'deepseek/deepseek-reasoner'] },
    { id: 'anthropic', name: 'Anthropic Claude', models: ['anthropic/claude-3-5-sonnet-20240620', 'anthropic/claude-3-haiku-20240307'] },
    { id: 'ollama', name: 'Ollama (Local)', models: ['ollama/qwen', 'ollama/llama3', 'ollama/mistral'] },
    { id: 'mock', name: 'Mock / Simulation', models: ['mock'] }
  ];

  const fetchSettings = () => {
    setLoading(true);
    api.get(`${API}/admin/ai-settings`)
      .then(res => {
        setProvider(res.data.active_provider);
        setModel(res.data.active_model);
        setBaseUrl(res.data.active_base_url || '');
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`${API}/admin/ai-settings`, {
        provider,
        model,
        api_key: apiKey || null,
        base_url: baseUrl || null
      });
      setIsEditing(false);
      setShowConfirm(false);
      setApiKey('');
      fetchSettings();
    } catch (err) {
      alert("Failed to update AI Strategy");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Sparkles size={120} className="text-primary" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-2xl font-black text-white">AI Strategy Center</h3>
            </div>
            <p className="text-gray-400 max-w-xl leading-relaxed">
              Dynamically switch platform intelligence. Stage 2 enables real-time provider hotswapping and model resolution.
            </p>
          </div>
          
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={`px-6 py-3 rounded-2xl font-black text-sm transition-all flex items-center gap-2 ${
              isEditing ? 'bg-white/10 text-white border border-white/20' : 'bg-primary text-black hover:scale-105 active:scale-95'
            }`}
          >
            {isEditing ? <X size={18} /> : <Settings size={18} />}
            {isEditing ? 'Cancel Configuration' : 'Adjust Intelligence'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Config Panel */}
        <div className="md:col-span-2 bg-card/70 border border-white/10 rounded-3xl p-8 space-y-8 relative overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500 animate-pulse font-mono uppercase tracking-widest">
              Syncing Neural Weights...
            </div>
          ) : isEditing ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h4 className="text-[10px] uppercase font-black text-primary tracking-[0.2em]">Configuration Matrix</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">Intelligence Provider</label>
                  <select 
                    value={provider}
                    onChange={(e) => {
                      const p = e.target.value;
                      setProvider(p);
                      const def = providers.find(x => x.id === p)?.models[0];
                      if (def) setModel(def);
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold appearance-none outline-none focus:border-primary/50 transition-colors"
                  >
                    {providers.map(p => <option key={p.id} value={p.id} className="bg-neutral-900">{p.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">Active Model</label>
                  <select 
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold appearance-none outline-none focus:border-primary/50 transition-colors"
                  >
                    {providers.find(p => p.id === provider)?.models.map(m => (
                      <option key={m} value={m} className="bg-neutral-900">{m.split('/').pop()}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">Custom API Key (Optional Override)</label>
                <div className="relative">
                  <input 
                    type="password"
                    placeholder="Leave blank to use system default..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 text-white font-mono text-sm outline-none focus:border-primary/50 transition-colors"
                  />
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">Custom Base URL (e.g. Ollama Cloud)</label>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="e.g. https://ollama.your-domain.com"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 text-white font-mono text-sm outline-none focus:border-primary/50 transition-colors"
                  />
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  onClick={() => setShowConfirm(true)}
                  disabled={saving}
                  className="flex-1 bg-primary text-black font-black py-4 rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle size={20} />
                  Deploy Strategy
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-between items-end">
                <h4 className="text-[10px] uppercase font-black text-gray-500 tracking-[0.2em]">Active Deployment</h4>
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase flex items-center gap-1.5 border border-emerald-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live in Production
                </span>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Provider</span>
                  <div className="text-xl font-black text-white flex items-center gap-2">
                    {providers.find(p => p.id === provider)?.name || provider}
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Model Specification</span>
                  <div className="text-xl font-mono font-black text-primary">
                    {model.split('/').pop() || model}
                  </div>
                </div>
              </div>

              {baseUrl && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Custom Endpoint</span>
                  <div className="text-xs font-mono text-gray-400 break-all">
                    {baseUrl}
                  </div>
                </div>
              )}

              <div className="p-4 bg-primary/5 border border-dashed border-primary/20 rounded-2xl flex items-start gap-3">
                <AlertCircle className="text-primary w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-[10px] text-primary/70 leading-relaxed italic">
                  Critical Warning: Switching to higher-parameter models may increase latency and token consumption significantly. Ensure the selected model is cached and optimized for pedagogical depth.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Stats Column */}
        <div className="space-y-6">
          <div className="bg-card/70 border border-white/10 rounded-3xl p-6 space-y-6">
            <h4 className="text-[10px] uppercase font-black text-gray-500 tracking-[0.2em]">Performance Index</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400">Response Latency</span>
                <span className="text-xs font-bold text-emerald-500">OPTIMAL (1.2s)</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: '85%' }} className="h-full bg-emerald-500" />
              </div>
              
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs font-bold text-gray-400">Context Retention</span>
                <span className="text-xs font-bold text-primary">ELITE (98%)</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: '98%' }} className="h-full bg-primary" />
              </div>
            </div>
          </div>

          <div className="bg-primary/10 border border-primary/20 rounded-3xl p-6">
            <h4 className="text-[10px] uppercase font-black text-primary tracking-[0.2em] mb-4">Neural Health</h4>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-3xl font-black text-white">99.4</span>
              <span className="text-xs font-bold text-primary mb-1">%</span>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Strategy uptime is currently at peak levels. No degradation detected across regional clusters.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#111] border border-white/10 rounded-[40px] p-10 max-w-md w-full shadow-2xl shadow-primary/20 space-y-8 animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Zap className="w-10 h-10 text-primary animate-pulse" />
            </div>
            
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-black text-white">Confirm Strategic Shift?</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                You are about to re-route all platform intelligence through <span className="text-primary font-bold">{providers.find(p => p.id === provider)?.name}</span>. 
                This will impact real-time lesson generation, course reviews, and user interactions immediately.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 font-bold uppercase">New Model</span>
                <span className="text-primary font-mono font-black">{model.split('/').pop()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 font-bold uppercase">Security Mode</span>
                <span className="text-emerald-500 font-bold uppercase">Encrypted</span>
              </div>
              {baseUrl && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 font-bold uppercase">Endpoint</span>
                  <span className="text-white font-mono truncate ml-4">{baseUrl}</span>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-6 py-4 rounded-2xl border border-white/10 text-white font-black text-sm hover:bg-white/5 transition-all"
              >
                Abort
              </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-6 py-4 rounded-2xl bg-primary text-black font-black text-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {saving ? 'Deploying...' : 'Confirm Deploy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LogsPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => { 
    api.get(`${API}/logs`)
      .then(res => setLogs(Array.isArray(res.data) ? res.data : []))
      .catch(() => { }); 
  }, []);
  return (
    <div className="p-6 bg-card/70 border border-white/5 rounded-2xl">
      <h3 className="text-lg font-bold text-white mb-6">📜 Logs</h3>
      <div className="space-y-2">
        {logs.map((log, i) => (
          <div key={i} className="py-2 border-b border-white/5 text-[10px] text-gray-400">
            <span className="text-primary font-bold">{new Date(log.created_at).toLocaleString()}</span>: {log.action}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const tabs = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'notifications', label: '🔔 Alerts' },
    { key: 'reviews', label: '🎓 Reviews' },
    { key: 'seasons', label: '📅 Seasons' },
    { key: 'settings', label: '⚙️ Settings' },
    { key: 'users', label: '👥 Users' },
    { key: 'payouts', label: '💰 Payouts' },
    { key: 'codes', label: '🔑 Codes' },
    { key: 'ai', label: '🧠 AI Strategy' },
    { key: 'logs', label: '📜 Logs' },
  ];

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-10 pb-6 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30 shadow-[0_0_20px_rgba(0,224,255,0.15)]">
               <Zap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-1">Super Admin Infrastructure</h1>
              <p className="text-[10px] uppercase font-bold text-gray-500 tracking-[0.2em]">Global Maintenance Command Center</p>
            </div>
          </div>
        <button 
          onClick={() => {
            localStorage.removeItem('access_token');
            sessionStorage.removeItem('admin_unlocked');
            window.location.href = '/admin-login';
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all text-xs font-bold"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
        </div>
        <div className="flex gap-1.5 mb-10 bg-slate-900/60 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 w-fit mx-auto shadow-2xl">
          {tabs.map(t => <Tab key={t.key} label={t.label} active={activeTab === t.key} onClick={() => setActiveTab(t.key)} />)}
        </div>
        <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}>
        {activeTab === 'overview' && <OverviewPanel />}
        {activeTab === 'notifications' && <NotificationsPanel />}
        {activeTab === 'reviews' && <CourseReviewPanel />}
        {activeTab === 'seasons' && <SeasonsPanel />}
        {activeTab === 'settings' && <SettingsPanel />}
        {activeTab === 'users' && <UsersPanel />}
        {activeTab === 'payouts' && <PayoutsPanel />}
        {activeTab === 'codes' && <CodesPanel />}
        {activeTab === 'ai' && <AIStrategyPanel />}
        {activeTab === 'logs' && <LogsPanel />}
      </motion.div>
    </div>
  </div>
  );
}
