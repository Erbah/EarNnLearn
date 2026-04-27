"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AriaOrb } from "./AriaOrb";

interface LessonSkeletonProps {
  topic: string;
}

export const LessonSkeleton: React.FC<LessonSkeletonProps> = ({ topic }) => {
  const [statusIndex, setStatusIndex] = useState(0);
  
  const statuses = [
    "I'm preparing your lesson...",
    `Structuring key ideas for ${topic}...`,
    "Fine-tuning examples for your style...",
    "Almost ready...",
    "Just adding the finishing touches..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev < statuses.length - 1 ? prev + 1 : prev));
    }, 3500);
    return () => clearInterval(interval);
  }, [statuses.length]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="mb-12">
        <AriaOrb state="thinking" size="lg" />
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
            Aria is synthesizing custom content just for you.
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
};
