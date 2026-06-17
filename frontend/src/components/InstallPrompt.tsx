"use client";

import React, { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => console.log("SW registration failed", err));
    }

    // Check if we should show the prompt (not dismissed before)
    const hasDismissed = localStorage.getItem("pwa_prompt_dismissed");
    
    // Also check if already installed
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;

    if (hasDismissed === "true" || isStandalone) {
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Wait a bit before showing to not overwhelm the user immediately on first load
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    setShowPrompt(false);
    deferredPrompt.prompt();
    
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
    } else {
      console.log("User dismissed the install prompt");
    }
    
    setDeferredPrompt(null);
    localStorage.setItem("pwa_prompt_dismissed", "true");
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa_prompt_dismissed", "true");
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm"
        >
          <div className="bg-background/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.6)] flex items-center gap-4">
            <div className="w-12 h-12 flex-shrink-0 bg-primary/10 rounded-xl flex items-center justify-center">
              <img src="/icon-192x192.png" alt="App Icon" className="w-8 h-8 object-contain" />
            </div>
            
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white">Install EarNnLearN</h3>
              <p className="text-xs text-gray-400 mt-0.5">Add to home screen for faster access.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleInstallClick}
                className="bg-primary/20 hover:bg-primary/30 text-primary p-2 rounded-lg transition-colors"
                aria-label="Install App"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={handleDismiss}
                className="text-gray-400 hover:text-white p-2 rounded-lg transition-colors bg-white/5 hover:bg-white/10"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
