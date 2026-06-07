"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LessonSkeletonProps {
  topic: string;
}

export const LessonSkeleton = React.memo(function LessonSkeleton({ topic }: LessonSkeletonProps) {
  const [statusIndex, setStatusIndex] = useState(0);
  
  const statuses = useMemo(() => [
    "I'm preparing your lesson...",
    `Structuring key ideas for ${topic}...`,
    "Fine-tuning examples for your style...",
    "Almost ready...",
    "Just adding the finishing touches..."
  ], [topic]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev < statuses.length - 1 ? prev + 1 : prev));
    }, 3500);
    return () => clearInterval(interval);
  }, [statuses.length]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="mb-12 flex items-center justify-center">
        <div className="relative w-24 h-24">
          {/* Glowing Background */}
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
          {/* Animated Spinner Ring */}
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`status-${statusIndex}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5 }}
          className="max-w-md"
        >
          <h2 className="text-2xl font-bold text-white mb-2">
            {statuses[statusIndex]}
          </h2>
          <p className="text-blue-200/60 text-sm animate-pulse">
            Our engine is synthesizing custom content just for you.
          </p>
        </motion.div>
      </AnimatePresence>

      <div className="mt-12 w-full max-w-lg space-y-4">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0.1 }}
            animate={{ opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
            className="h-16 bg-white/5 rounded-2xl border border-white/10"
          />
        ))}
      </div>
    </div>
  );
});
