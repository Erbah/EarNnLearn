"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AriaOrb } from "./AriaOrb";
import { api } from "@/lib/api";
import { X, ArrowRight } from "lucide-react";
import Link from "next/link";

export function AriaWelcomeToast() {
  const [show, setShow] = useState(false);
  const [resumeData, setResumeData] = useState<{
    lesson_id: string;
    title: string;
    topic: string;
  } | null>(null);

  useEffect(() => {
    const checkResume = async () => {
      try {
        const res = await api.get("/api/v1/education/resume");
        if (res.data && res.data.can_resume) {
          setResumeData(res.data);
          // Show after a short delay
          setTimeout(() => setShow(true), 1500);
          // Auto-hide after 10s
          setTimeout(() => setShow(false), 11500);
        }
      } catch (err) {
        console.error("Failed to fetch resume state:", err);
      }
    };

    // Check once per session (roughly)
    const lastGreet = sessionStorage.getItem("aria_greet_last");
    const now = Date.now();
    if (!lastGreet || now - parseInt(lastGreet) > 3600000) { // 1 hour cooldown
      checkResume();
      sessionStorage.setItem("aria_greet_last", now.toString());
    }
  }, []);

  return (
    <AnimatePresence>
      {show && resumeData && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          className="fixed top-24 right-6 z-[100] max-w-sm w-full"
        >
          <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl overflow-hidden relative group">
            {/* Ambient Background Glow */}
            <div className="absolute -top-12 -right-12 w-24 h-24 bg-primary/20 rounded-full blur-[40px] -z-10" />
            
            <button 
              onClick={() => setShow(false)}
              className="absolute top-2 right-2 p-1 text-gray-500 hover:text-white transition-colors"
              aria-label="Dismiss welcome toast"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex gap-4 items-center">
              <div className="flex-shrink-0">
                <AriaOrb state="speaking" size={48} />
              </div>
              <div className="flex-1">
                <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-1 opacity-60">Aria Assistant</p>
                <div className="text-sm text-white leading-relaxed">
                  Welcome back! Shall we pick up where we left off with <span className="text-primary font-bold">{resumeData.topic}</span>?
                </div>
                <div className="mt-3 flex items-center justify-end">
                  <Link 
                    href={`/education/lessons/${resumeData.lesson_id}`}
                    onClick={() => setShow(false)}
                    className="flex items-center gap-2 text-xs font-bold text-primary hover:text-primary/80 transition-all bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20"
                  >
                    Resume Lesson
                    <ArrowRight className="w-3 h-3 text-primary animate-pulse" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Scanning line effect */}
            <motion.div 
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 10, ease: "linear" }}
              className="absolute bottom-0 left-0 h-[2px] bg-primary/50 origin-left"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
