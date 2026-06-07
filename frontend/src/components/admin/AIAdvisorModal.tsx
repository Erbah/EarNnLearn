'use client';
import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Sparkles, Loader2 } from 'lucide-react';

interface AIAdvisorModalProps {
  data: any;
  loading: boolean;
  onClose: () => void;
  onApply: (config: any) => void;
}

export const AIAdvisorModal = React.memo(function AIAdvisorModal({
  data,
  loading,
  onClose,
  onApply,
}: AIAdvisorModalProps) {
  const handleApplyClick = useCallback(() => {
    if (data?.suggested_config) {
      onApply(data.suggested_config);
    }
  }, [data, onApply]);

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
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-sm text-gray-400 font-medium">Deep scanning ecosystem data...</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-6 p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <span className="text-xl font-bold text-white">{data?.health_score ?? 0}%</span>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Ecosystem Health</div>
                  <div className="text-sm text-gray-300 font-medium leading-tight">{data?.global_recommendation}</div>
                </div>
              </div>
              <button onClick={handleApplyClick} className="w-full py-3 bg-primary text-background font-black rounded-2xl hover:scale-[1.02] transition-all">
                Apply AI Strategy Batch
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
});

export default AIAdvisorModal;
