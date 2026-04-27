"use client";

import { motion } from "framer-motion";
import { Users, ArrowRight } from "lucide-react";
import Link from "next/link";

export function NetworkPreview({ count = 0 }: { count?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="p-6 rounded-2xl bg-card/70 backdrop-blur-xl border border-white/5 shadow-lg flex flex-col items-center justify-center relative overflow-hidden group hover:border-secondary/20 transition-all duration-300"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,215,0,0.05),transparent_70%)] pointer-events-none" />
      
      <div className="w-full flex justify-between items-start mb-8 relative z-10">
        <div>
          <h3 className="text-lg font-semibold text-white">Network Tree</h3>
          <p className="text-sm text-gray-400">{count} Active Members</p>
        </div>
        <div className="p-2 rounded-xl bg-secondary/10 text-secondary">
          <Users className="w-5 h-5" />
        </div>
      </div>

      {/* Stylized Abstract Tree Preview */}
      <div className="relative w-full max-w-[200px] h-[180px] flex items-center justify-center mb-6 z-10">
        {/* You Node */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center z-20 shadow-[0_0_15px_rgba(0,224,255,0.4)] ring-4 ring-background">
          <span className="text-xs font-bold text-white">YOU</span>
        </div>
        
        {/* Level 1 Nodes */}
        <div 
          className="absolute top-[80px] left-[20%] w-10 h-10 rounded-full bg-card border-2 border-primary/50 flex items-center justify-center z-20 hover:border-primary transition-colors cursor-pointer outline-none"
          role="img"
          aria-label="Network Member A"
          title="Network Member A"
        >
          <span className="text-xs text-white">A</span>
        </div>
        <div 
          className="absolute top-[80px] right-[20%] w-10 h-10 rounded-full bg-card border-2 border-primary/50 flex items-center justify-center z-20 hover:border-primary transition-colors cursor-pointer outline-none"
          role="img"
          aria-label="Network Member B"
          title="Network Member B"
        >
          <span className="text-xs text-white">B</span>
        </div>

        {/* Level 2 Nodes (Partial) */}
        <div className="absolute bottom-0 left-[5%] w-8 h-8 rounded-full bg-card border-2 border-white/20 flex items-center justify-center z-20">
          <span className="text-[10px] text-gray-400">C</span>
        </div>
        <div className="absolute bottom-0 left-[35%] w-8 h-8 rounded-full bg-card border-2 border-white/20 flex items-center justify-center z-20">
          <span className="text-[10px] text-gray-400">D</span>
        </div>

        {/* Lines */}
        <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none">
          <path d="M 100 48 L 40 80" stroke="rgba(255,255,255,0.1)" strokeWidth="2" fill="none" />
          <path d="M 100 48 L 160 80" stroke="rgba(255,255,255,0.1)" strokeWidth="2" fill="none" />
          
          <path d="M 40 120 L 20 160" stroke="rgba(255,255,255,0.1)" strokeWidth="2" fill="none" />
          <path d="M 40 120 L 70 160" stroke="rgba(255,255,255,0.1)" strokeWidth="2" fill="none" />
        </svg>
      </div>

      <Link href="/network" className="w-full relative z-10">
        <button className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors flex items-center justify-center group/btn">
          Explore Network
          <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
        </button>
      </Link>
    </motion.div>
  );
}
