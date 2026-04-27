"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ArrowRight, Play, Award } from "lucide-react";
import { api } from "@/lib/api";
import Link from "next/link";

export function ResumeLearningWidget() {
  const [resumeData, setResumeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResume() {
      try {
        const res = await api.get("/api/v1/education/resume");
        if (res.data.can_resume) {
          setResumeData(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch resume state:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchResume();
  }, []);

  if (loading || !resumeData) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative group overflow-hidden"
    >
      {/* Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative bg-background/60 border border-white/20 rounded-2xl p-6 backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/30">
            <BookOpen className="w-7 h-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded">
                Continue Learning
              </span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                {resumeData.progress_percent}% Complete
              </span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              {resumeData.title}
            </h3>
            <p className="text-sm text-gray-400">
              Topic: <span className="text-gray-300 font-medium">{resumeData.topic}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Simple Progress Bar */}
          <div className="hidden lg:block w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${resumeData.progress_percent}%` }}
              className="h-full bg-primary shadow-[0_0_10px_rgba(0,224,255,0.5)]"
            />
          </div>

          <Link
            href={`/education/lessons/${resumeData.lesson_id}`}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-primary text-background font-black rounded-xl hover:bg-primary/80 transition-all shadow-xl group/btn"
          >
            <span>Resume Lesson</span>
            <Play className="w-4 h-4 fill-current group-hover/btn:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
