'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Globe, X, Loader2 } from 'lucide-react';
import { API_BASE_URL, api } from '@/lib/api';
import axios from 'axios';

const API = `${API_BASE_URL}/api/v1/admin`;

interface SeasonRowProps {
  season: any;
  onClearRids: (id: string) => void;
}

const SeasonRow = React.memo(function SeasonRow({ season, onClearRids }: SeasonRowProps) {
  const handleClear = useCallback(() => {
    onClearRids(season.id);
  }, [season.id, onClearRids]);

  return (
    <div className="bg-card/70 border border-white/5 rounded-2xl p-6 flex justify-between items-center">
      <div>
        <div className="text-[18px] font-bold text-white">Season {season.season_number}</div>
        <div className="text-[12px] text-gray-500">Started: {new Date(season.start_date).toLocaleDateString()}</div>
        {season.is_active && <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ml-2">Active</span>}
      </div>
      <button
        onClick={handleClear}
        className="bg-red-500/10 text-red-500 border border-red-500/20 px-4 py-2 rounded-xl text-[12px] font-bold hover:bg-red-500 hover:text-white transition-all"
      >
        Clear Unused RIDs
      </button>
    </div>
  );
});

export const SeasonsPanel = React.memo(function SeasonsPanel() {
  const [seasons, setSeasons] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [isRidDeleting, setIsRidDeleting] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [newSeasonNum, setNewSeasonNum] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadSeasons = useCallback((signal?: AbortSignal) => {
    api.get(`${API}/seasons`, { signal })
      .then(res => setSeasons(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        if (axios.isCancel(err)) return;
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadSeasons(controller.signal);
    return () => controller.abort();
  }, [loadSeasons]);

  const createSeason = useCallback(async () => {
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
  }, [newSeasonNum, startDate, endDate, loadSeasons]);

  const handleDelete = useCallback(async () => {
    if (confirmPhrase !== "DELETE RID SEASON") {
      alert("Please type the confirmation phrase exactly.");
      return;
    }
    setLoading(true);
    try {
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
    } catch (e) {
      alert("Deletion failed.");
    }
    setLoading(false);
  }, [confirmPhrase, deletingId]);

  const handleOpenScheduleModal = useCallback(() => {
    setShowScheduleModal(true);
  }, []);

  const handleCloseScheduleModal = useCallback(() => {
    setShowScheduleModal(false);
  }, []);

  const handleNewSeasonNumChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewSeasonNum(e.target.value);
  }, []);

  const handleStartDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value);
  }, []);

  const handleEndDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
  }, []);

  const handleClearRids = useCallback((id: string) => {
    setDeletingId(id);
    setIsRidDeleting(true);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setIsRidDeleting(false);
    setDeletingId(null);
    setConfirmPhrase('');
  }, []);

  const handleConfirmPhraseChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPhrase(e.target.value);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-[16px] font-bold text-white">📅 Transaction Seasons</h3>
        <button
          onClick={handleOpenScheduleModal}
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
              onClick={handleCloseScheduleModal}
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
                <button onClick={handleCloseScheduleModal} className="text-gray-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 px-1">Season Number</label>
                  <input
                    type="number"
                    value={newSeasonNum}
                    onChange={handleNewSeasonNumChange}
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
                      onChange={handleStartDateChange}
                      className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-all text-[12px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 px-1">End Date (Optional)</label>
                    <input
                      type="datetime-local"
                      value={endDate}
                      onChange={handleEndDateChange}
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
          <SeasonRow
            key={s.id}
            season={s}
            onClearRids={handleClearRids}
          />
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
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">{'Type "DELETE RID SEASON" to confirm'}</label>
              <input
                value={confirmPhrase}
                onChange={handleConfirmPhraseChange}
                title="Type confirmation phrase here"
                aria-label="Confirmation phrase"
                className="w-full bg-white/5 border border-red-500/30 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500"
              />
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleCancelDelete}
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
});

export default SeasonsPanel;
