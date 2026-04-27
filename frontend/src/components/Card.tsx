"use client";

import React from "react";
import { motion } from "framer-motion";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  onClick,
  hoverable = true,
}) => {
  const isClickable = !!onClick;

  return (
    <motion.div
      whileHover={hoverable && isClickable ? { y: -4, borderColor: "var(--primary)" } : {}}
      onClick={onClick}
      className={`
        relative rounded-3xl border border-white/5 bg-white/5 p-6 backdrop-blur-xl 
        transition-all duration-300 shadow-xl shadow-black/10
        ${isClickable ? "cursor-pointer active:scale-[0.98]" : ""}
        ${className}
      `}
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)"
      }}
    >
      {/* Subtle Inner Glow */}
      <div className="absolute inset-px rounded-[22px] bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};
