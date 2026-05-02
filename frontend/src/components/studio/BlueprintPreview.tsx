"use client";

import { motion } from "framer-motion";
import { Check, ArrowRight, BookOpen, Layers, Target, ShieldCheck } from "lucide-react";

interface RoadmapNode {
  id: string;
  title: string;
  topics: { id: string; title: string }[];
}

interface BlueprintPreviewProps {
  roadmap: {
    subject: string;
    units: RoadmapNode[];
  };
  onApprove: () => void;
  onCancel: () => void;
}

export default function BlueprintPreview({ roadmap, onApprove, onCancel }: BlueprintPreviewProps) {
  return (
    <div className="max-w-5xl mx-auto py-12 px-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-12">
        <div>
          <div className="flex items-center gap-2 mb-2">
             <ShieldCheck className="w-4 h-4 text-green-400" />
             <span className="text-[10px] font-black tracking-widest uppercase text-gray-500">Curriculum Blueprint Validated</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-serif text-white">Mastering {roadmap.subject}</h2>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <button 
            onClick={onCancel}
            className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors text-sm font-bold"
          >
            Re-architect
          </button>
          <button 
            onClick={onApprove}
            className="flex-1 md:flex-none px-8 py-3 rounded-xl bg-primary text-background font-black hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(0,224,255,0.3)] flex items-center justify-center gap-2"
          >
            Launch Forge
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roadmap.units.map((unit, idx) => (
          <motion.div
            key={unit.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group relative"
          >
            <div className="relative z-10 p-6 rounded-3xl bg-white/5 border border-white/10 group-hover:border-primary/30 transition-all h-full glass">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                  <span className="text-xs font-black text-primary">{idx + 1}</span>
                </div>
                <h3 className="font-bold text-white group-hover:text-primary transition-colors">{unit.title}</h3>
              </div>
              
              <ul className="space-y-3">
                {unit.topics.map((topic, tIdx) => (
                  <li key={topic.id} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-1.5 shrink-0" />
                    <span className="text-sm text-gray-400 leading-tight">{topic.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-16 p-8 rounded-[32px] bg-primary/5 border border-primary/20 flex flex-col md:flex-row items-center gap-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
          <BookOpen className="w-8 h-8 text-primary" />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h4 className="text-xl font-bold text-white mb-1">Textbook-Quality Synthesis</h4>
          <p className="text-gray-400 text-sm">Our AI will now generate high-fidelity scenes, interactive assessments, and technical depth for each node in this blueprint.</p>
        </div>
        <div className="flex gap-4 shrink-0">
           <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">Estimated Depth</span>
              <span className="text-lg font-black text-white">45+ SCENES</span>
           </div>
           <div className="w-[1px] h-10 bg-white/10" />
           <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">Generation Time</span>
              <span className="text-lg font-black text-white">~20s</span>
           </div>
        </div>
      </div>
    </div>
  );
}
