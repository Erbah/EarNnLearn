"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export type AriaState = "idle" | "thinking" | "success" | "speaking";

interface AriaOrbProps {
  state?: AriaState;
  size?: number;
  className?: string;
}

/**
 * AriaOrb: The visual identity of our AI Tutor.
 * Features state-dependent pulsing, rotations, and glow effects.
 */
export const AriaOrb: React.FC<AriaOrbProps> = ({ 
  state = "idle", 
  size = 120,
  className = ""
}) => {
  // Animation Variants based on state
  const orbVariants = {
    idle: {
      scale: [1, 1.05, 1],
      opacity: [0.7, 0.9, 0.7],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut" as const
      }
    },
    thinking: {
      scale: [1, 1.1, 1],
      rotate: [0, 180, 360],
      filter: ["blur(4px) brightness(1)", "blur(8px) brightness(1.3)", "blur(4px) brightness(1)"],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "linear" as const
      }
    },
    success: {
      scale: [1, 1.4, 1.2],
      opacity: [0.7, 1, 0.9],
      filter: "blur(2px) brightness(1.5)",
      transition: {
        duration: 0.8,
        ease: "easeOut" as const
      }
    },
    speaking: {
      scale: [1, 1.08, 1, 1.12, 1],
      transition: {
        duration: 0.6,
        repeat: Infinity,
        ease: "easeInOut" as const
      }
    }
  };

  return (
    <div 
      className={`relative flex items-center justify-center pointer-events-none select-none ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Aria AI Tutor is ${state}`}
    >
      {/* Background Glow Layer */}
      <motion.div
        className="absolute inset-0 rounded-full bg-primary/20 blur-3xl"
        animate={{
          scale: state === "thinking" ? [1, 1.5, 1] : 1,
          opacity: state === "idle" ? 0.3 : 0.6
        }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Main Visual Orb */}
      <motion.div
        variants={orbVariants}
        animate={state}
        className={`relative z-10 w-full h-full rounded-full flex items-center justify-center overflow-hidden border border-white/10 shadow-[0_0_30px_var(--color-primary)] transition-shadow duration-500 bg-[radial-gradient(circle_at_30%_30%,_var(--color-primary),_transparent)] ${
          state === 'success' ? 'shadow-[0_0_60px_var(--color-primary)]' : ''
        }`}
      >
        {/* Internal Procedural Detail (Simulates depth) */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.4)_100%)]" />
        
        {/* Dynamic Waveform (for 'speaking' state) */}
        <AnimatePresence>
          {state === "speaking" && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 h-8"
            >
              {[1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-white rounded-full"
                  animate={{
                    height: [8, 24, 8]
                  }}
                  transition={{
                    duration: 0.5,
                    repeat: Infinity,
                    delay: i * 0.1
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Thinking Pulse Center */}
        {state === "thinking" && (
          <motion.div
            className="w-4 h-4 bg-white rounded-full blur-sm"
            animate={{ scale: [1, 2, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </motion.div>

      {/* Secondary Orbitals (Aesthetics Only) */}
      <motion.div
        className="absolute w-[120%] h-[120%] border border-primary/10 rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
};

