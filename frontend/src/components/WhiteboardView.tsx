"use client";

import React, { useEffect, useState } from "react";
import {
  whiteboardManager,
  WhiteboardState,
  WhiteboardElement,
} from "@/lib/whiteboard";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu } from "lucide-react";

// Default Color Protocol
const COLORS = {
  circle: "#22d3ee", // Electric Cyan
  line: "rgba(255, 255, 255, 0.7)",
  arrow: "rgba(255, 255, 255, 0.8)",
  text: "#ffffff",
};

const BLUEPRINT_GRID_STYLE = {
  backgroundImage: `
    linear-gradient(to right, #ffffff 1px, transparent 1px),
    linear-gradient(to bottom, #ffffff 1px, transparent 1px)
  `,
  backgroundSize: '40px 40px'
};

const TEXT_SHADOW_STYLE = { textShadow: "0 2px 4px rgba(0,0,0,0.5)" };

export const WhiteboardView = React.memo(function WhiteboardView() {
  const [state, setState] = useState<WhiteboardState>(
    whiteboardManager.getState()
  );

  useEffect(() => {
    const unsubscribe = whiteboardManager.subscribe(setState);
    return unsubscribe;
  }, []);

  const isEmpty = state.elements.length === 0;
  const { currentStep, totalSteps, label, isActive } = state.sequenceStatus || {};

  return (
    <div className="relative w-full h-full bg-slate-950/40 overflow-hidden group">
      {/* 🧪 Laboratory Blueprint Grid */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={BLUEPRINT_GRID_STYLE}
      />
      
      {/* 🎬 Sequence Progress Overlay */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-6 right-6 z-20 flex flex-col items-end pointer-events-none"
          >
            <div className="bg-background/80 backdrop-blur-md border border-primary/20 rounded-xl p-3 shadow-2xl flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-primary/60 tracking-widest uppercase mb-0.5">
                  Reasoning Step {currentStep} / {totalSteps}
                </span>
                <span className="text-sm font-bold text-white tracking-wide">
                  {label}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-primary/20 flex items-center justify-center relative">
                <svg className="w-8 h-8 -rotate-90">
                  <circle
                    cx="16"
                    cy="16"
                    r="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-white/5"
                  />
                  <motion.circle
                    cx="16"
                    cy="16"
                    r="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="88"
                    animate={{ strokeDashoffset: 88 - (88 * (currentStep || 0)) / (totalSteps || 1) }}
                    className="text-primary"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary">
                    {Math.round(((currentStep || 0) / (totalSteps || 1)) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🧠 Idle State Overlay */}
      <AnimatePresence>
        {isEmpty && !isActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.05, 1],
                opacity: [0.3, 0.5, 0.3]
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Cpu className="w-16 h-16 text-primary/40 mb-4" />
            </motion.div>
            <p className="text-primary/30 font-mono text-sm tracking-widest uppercase">
              Visual Lab Ready
            </p>
            <p className="text-white/10 text-xs mt-2">
              Diagrams will appear here
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🎨 Main Drawing Canvas */}
      <svg 
        className="w-full h-full pointer-events-none z-[5]" 
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255, 255, 255, 0.8)" />
          </marker>
        </defs>

        <AnimatePresence mode="popLayout">
          {state.elements.map((el: WhiteboardElement) => {
            const { command, stepIndex } = el;
            // 🎯 Attention Guidance: Dim older elements
            const isOld = isActive && stepIndex < (currentStep || 0);
            const baseOpacity = isOld ? 0.3 : 1;

            if (command.type === "circle") {
              return (
                <motion.circle
                  key={el.id}
                  cx={command.x}
                  cy={command.y}
                  r={command.r}
                  fill="none"
                  stroke={command.color || COLORS.circle}
                  strokeWidth="2"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: baseOpacity, scale: 1 }}
                  transition={{ type: "spring", damping: 15 }}
                />
              );
            }

            if (command.type === "line" || command.type === "arrow") {
              return (
                <motion.line
                  key={el.id}
                  x1={command.from[0]}
                  y1={command.from[1]}
                  x2={command.to[0]}
                  y2={command.to[1]}
                  stroke={command.color || (command.type === "line" ? COLORS.line : COLORS.arrow)}
                  strokeWidth="2"
                  markerEnd={command.type === "arrow" ? "url(#arrowhead)" : undefined}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: baseOpacity }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                />
              );
            }

            if (command.type === "text") {
              return (
                <motion.text
                  key={el.id}
                  x={command.x}
                  y={command.y}
                  fill={command.color || COLORS.text}
                  fontSize={command.fontSize || "20"}
                  textAnchor="middle"
                  className="font-mono font-bold tracking-tight"
                  style={TEXT_SHADOW_STYLE}
                  initial={{ opacity: 0, y: command.y + 10 }}
                  animate={{ opacity: baseOpacity, y: command.y }}
                  transition={{ duration: 0.4 }}
                >
                  {command.value}
                </motion.text>
              );
            }

            return null;
          })}
        </AnimatePresence>
      </svg>

      {/* Status Indicator */}
      <div className="absolute bottom-4 right-4 flex items-center gap-3 opacity-20 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${isEmpty && !isActive ? 'bg-gray-500' : 'bg-green-500 animate-pulse'}`} />
          <span className="text-[10px] font-mono text-white/50 tracking-tighter uppercase">
            {isActive ? 'Synthesizing...' : isEmpty ? 'Idle' : 'Live_Context'}
          </span>
        </div>
      </div>
    </div>
  );
});
