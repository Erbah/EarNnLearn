'use client';
import { motion } from 'framer-motion';
import NetworkTree from '@/components/NetworkTree';

export default function NetworkPage() {
  return (
    <div className="p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[28px] font-bold text-gray-200 mb-2">
            🌳 Your Network
          </h1>
          <p className="text-gray-400 text-sm">
            Visualize your referral tree and track earnings across your network
          </p>
        </div>

        {/* Tree Visualization */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-card/40 backdrop-blur-xl rounded-[20px] border border-white/5 p-1"
        >
          <NetworkTree />
        </motion.div>

        {/* Legend */}
        <div className="flex gap-6 mt-4 p-4 px-5 bg-card/40 rounded-xl border border-white/5 text-[12px] text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm border-2 border-primary bg-primary/10" />
            <span>You</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm border border-white/10 bg-card/85" />
            <span>Network Member</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-primary opacity-60" />
            <span>Referral Connection</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
