"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export function TopBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user dismissed the banner previously
    const isDismissed = localStorage.getItem("top_banner_dismissed");
    if (!isDismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("top_banner_dismissed", "true");
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="w-full bg-gradient-to-r from-primary/25 via-blue-600/25 to-secondary/25 border-b border-primary/20 backdrop-blur-md relative z-[100] overflow-hidden"
        >
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes banner-shimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
            .animate-banner-shimmer {
              animation: banner-shimmer 3s infinite;
            }
          `}} />
          {/* Subtle animated light sweep */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-banner-shimmer" />
          
          <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8 flex items-center justify-between gap-4 text-xs sm:text-sm font-medium text-white/90">
            <div className="flex items-center gap-2 flex-1 justify-center">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/20 text-primary animate-pulse">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <p className="text-center">
                <span className="font-semibold text-white">Soft Launch Live:</span> Activate your code today and start earning up to infinity levels of commissions!{" "}
                <Link href="/register" className="underline hover:text-primary transition-colors font-bold ml-1 inline-flex items-center gap-0.5">
                  Get Started Now &rarr;
                </Link>
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
