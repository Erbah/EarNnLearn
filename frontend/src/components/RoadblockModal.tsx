"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Lock, ArrowRight, BookOpen, AlertCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface RoadblockModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicTitle: string;
  prerequisiteTitle: string;
  prerequisiteId: string;
  isSoftLock?: boolean;
}

export default function RoadblockModal({ 
  isOpen, 
  onClose, 
  topicTitle, 
  prerequisiteTitle, 
  prerequisiteId,
  isSoftLock = false
}: RoadblockModalProps) {
  const router = useRouter();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          
          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[101] pointer-events-none">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-[2rem] p-8 space-y-6 shadow-2xl pointer-events-auto relative overflow-hidden"
            >
              {/* Header Icon */}
              <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 ${isSoftLock ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'} border`}>
                {isSoftLock ? <AlertCircle className="w-8 h-8" /> : <Lock className="w-8 h-8" />}
              </div>

              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black text-white">
                  {isSoftLock ? "Mastery Recommended" : "Topic Locked"}
                </h2>
                <p className="text-sm text-zinc-400 leading-relaxed px-4">
                  {isSoftLock ? (
                    <>You haven't fully mastered <strong>{prerequisiteTitle}</strong> yet. You can proceed, but the lesson might be difficult.</>
                  ) : (
                    <>To unlock <strong>{topicTitle}</strong>, you first need to complete the prerequisite foundations.</>
                  )}
                </p>
              </div>

              {/* Prerequisite Action Card */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] uppercase font-black text-zinc-500">Prerequisite</p>
                    <p className="text-sm font-bold text-white truncate max-w-[150px]">{prerequisiteTitle}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    onClose();
                    router.push(`/education/lesson/${prerequisiteId}`);
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-primary hover:opacity-80 transition-opacity"
                >
                  {isSoftLock ? "Review Now" : "Unlock Now"}
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                {isSoftLock && (
                   <button 
                      onClick={() => {
                         onClose();
                         // Logic to proceed anyway
                         router.push(`/education/lesson/${prerequisiteId}`); // Or the actual topic id if we pass it
                      }}
                      className="w-full py-4 text-sm font-bold text-white hover:text-primary transition-colors"
                   >
                      Proceed anyway
                   </button>
                )}
                <button 
                   onClick={onClose}
                   className="w-full py-4 rounded-2xl bg-white text-black font-black hover:scale-[1.02] transition-transform active:scale-[0.98]"
                >
                  {isSoftLock ? "Got it" : "Go Back"}
                </button>
              </div>

              <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
