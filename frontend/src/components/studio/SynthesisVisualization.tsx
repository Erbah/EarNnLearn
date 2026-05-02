"use client";

import { motion } from "framer-motion";
import { Loader2, Zap, Cpu, Sparkles, Database, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

const CHAPTERS = [
  "Introduction & Fundamentals",
  "Core Concepts & Theory",
  "Technical Deep-Dive",
  "Real-World Applications",
  "Interactive Exercises",
  "Assessment & Summary"
];

export default function SynthesisVisualization() {
  const [activeIndices, setActiveIndices] = useState<number[]>([]);

  useEffect(() => {
    // Simulate chapters starting at different times
    const interval = setInterval(() => {
      setActiveIndices(prev => {
        if (prev.length >= CHAPTERS.length) return prev;
        return [...prev, prev.length];
      });
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-3xl mx-auto py-20 px-4 text-center">
      <div className="relative mb-16">
        <motion.div
          animate={{ 
            rotate: 360,
            scale: [1, 1.05, 1],
          }}
          transition={{ 
            rotate: { duration: 20, repeat: Infinity, ease: "linear" },
            scale: { duration: 3, repeat: Infinity, ease: "easeInOut" }
          }}
          className="w-32 h-32 md:w-48 md:h-48 rounded-full border-2 border-dashed border-primary/40 mx-auto flex items-center justify-center"
        >
          <div className="w-24 h-24 md:w-36 md:h-36 rounded-full bg-primary/10 flex items-center justify-center relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent animate-pulse" />
             <Zap className="w-12 h-12 md:w-20 md:h-20 text-primary" />
          </div>
        </motion.div>
        
        {/* Orbiting particles */}
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            animate={{ 
              rotate: 360,
            }}
            transition={{ 
              duration: 6 + i * 2, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 md:w-64 md:h-64 pointer-events-none"
          >
             <div className="w-2 h-2 rounded-full bg-primary absolute top-0 left-1/2 -translate-x-1/2 shadow-[0_0_10px_#00e0ff]" />
          </motion.div>
        ))}
      </div>

      <h2 className="text-3xl font-serif text-white mb-4">Synthesis in Progress</h2>
      <p className="text-gray-500 mb-12 max-w-lg mx-auto font-medium">
        Parallelizing chapter generation across multiple AI kernels for textbook-quality depth.
      </p>

      <div className="space-y-4 text-left max-w-md mx-auto">
        {CHAPTERS.map((chapter, idx) => {
          const isActive = activeIndices.includes(idx);
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-4 rounded-2xl border transition-all ${
                isActive 
                  ? "bg-primary/5 border-primary/30 shadow-[0_0_20px_rgba(0,224,255,0.05)]" 
                  : "bg-white/5 border-white/5 opacity-40"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {isActive ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  ) : (
                    <Database className="w-4 h-4 text-gray-600" />
                  )}
                  <span className={`text-sm font-bold ${isActive ? "text-white" : "text-gray-500"}`}>
                    {chapter}
                  </span>
                </div>
                {isActive && (
                  <span className="text-[10px] font-black text-primary uppercase">Active</span>
                )}
              </div>
              {isActive && (
                <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 15, ease: "linear" }}
                    className="h-full bg-primary shadow-[0_0_10px_#00e0ff]"
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="mt-16 flex items-center justify-center gap-6">
         <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">8x Parallel Kernels</span>
         </div>
         <div className="w-[1px] h-4 bg-white/10" />
         <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Neural Depth Check Enabled</span>
         </div>
      </div>
    </div>
  );
}
