"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronDown, ChevronUp, Lock, CheckCircle2, Play, 
  Circle, Clock, BarChart3, GraduationCap, ArrowLeft,
  Settings2, HelpCircle
} from "lucide-react";
import { api } from "@/lib/api";
import Link from "next/link";

export default function RoadmapPage() {
  const { id } = useParams();
  const router = useRouter();
  const [roadmap, setRoadmap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({ "Unit 1": true });

  useEffect(() => {
    async function fetchRoadmap() {
      try {
        setLoading(true);
        const res = await api.get(`/api/v1/education/roadmaps/${id}`);
        setRoadmap(res.data);
        // Expand first unit by default
        if (res.data.roadmap_data?.units?.length > 0) {
          setExpandedUnits({ [res.data.roadmap_data.units[0].title]: true });
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || "Failed to load roadmap");
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchRoadmap();
  }, [id]);

  const toggleUnit = (title: string) => {
    setExpandedUnits(prev => ({ ...prev, [title]: !prev[title] }));
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      <p className="text-gray-400 font-medium animate-pulse">Synthesizing your learning path...</p>
    </div>
  );

  if (error || !roadmap) return (
    <div className="p-8 text-center bg-red-500/10 border border-red-500/20 rounded-3xl max-w-2xl mx-auto mt-12">
      <h3 className="text-xl font-bold text-red-400 mb-2">Error Loading Course</h3>
      <p className="text-gray-400 mb-6">{error}</p>
      <button onClick={() => router.back()} className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
        Go Back
      </button>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {/* Navigation */}
      <button 
        onClick={() => router.push("/education")}
        className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-8 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Learning Hub
      </button>

      {/* Course Header */}
      <header className="relative bg-card/40 border border-white/5 rounded-[32px] p-8 md:p-12 overflow-hidden mb-12">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-secondary/10 blur-[100px] rounded-full" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-primary/10 border border-primary/20 text-primary text-[10px] font-black tracking-widest uppercase rounded">
              AI-Curated Course
            </span>
            <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
              {roadmap.difficulty} Level
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">
            {roadmap.subject}
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400 font-medium">Overall Progress</span>
                <span className="text-primary font-bold">{roadmap.progress_percent}%</span>
              </div>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${roadmap.progress_percent}%` }}
                  className="h-full bg-gradient-to-r from-primary to-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-6 md:justify-center border-l border-white/10 pl-8">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Topics</p>
                <p className="text-xl font-black text-white">{roadmap.completed_topics}/{roadmap.total_topics}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Goal</p>
                <p className="text-xl font-black text-white capitalize">{roadmap.goal || "Mastery"}</p>
              </div>
            </div>

            <div className="flex justify-end">
               <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all text-gray-300">
                 <Settings2 className="w-4 h-4" />
                 {roadmap.guided_mode ? "Guided Mode On" : "Free Mode"}
               </button>
            </div>
          </div>
        </div>
      </header>

      {/* Course Content (Units) */}
      <div className="space-y-6">
        {roadmap.roadmap_data?.units?.map((unit: any, uIdx: number) => (
          <div key={uIdx} className="bg-card/20 border border-white/5 rounded-3xl overflow-hidden transition-all hover:bg-card/30">
            <button 
              onClick={() => toggleUnit(unit.title)}
              className="w-full flex items-center justify-between p-6 md:p-8 text-left"
            >
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-black text-gray-500 border border-white/10">
                  {uIdx + 1}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">{unit.title}</h3>
                  <p className="text-sm text-gray-500">
                    {unit.topics?.length} Chapters • {unit.description || "Foundational concepts"}
                  </p>
                </div>
              </div>
              {expandedUnits[unit.title] ? <ChevronUp className="w-6 h-6 text-gray-600" /> : <ChevronDown className="w-6 h-6 text-gray-600" />}
            </button>

            <AnimatePresence>
              {expandedUnits[unit.title] && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-white/5 bg-black/20"
                >
                  <div className="p-4 md:p-6 space-y-3">
                    {unit.topics?.map((topic: any, tIdx: number) => {
                      const progress = roadmap.progress_data?.[topic.id] || {};
                      const isCompleted = progress.status === "completed" || progress.verified;
                      const isLocked = roadmap.guided_mode && tIdx > 0 && !(roadmap.progress_data?.[unit.topics[tIdx-1].id]?.status === "completed");
                      
                      return (
                        <div 
                          key={topic.id}
                          className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                            isLocked 
                              ? "bg-transparent border-transparent opacity-40 grayscale pointer-events-none" 
                              : "bg-white/5 border-white/5 hover:border-primary/30 hover:bg-white/[0.07] group"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                              isCompleted 
                                ? "bg-green-500/20 border-green-500/40 text-green-500" 
                                : "bg-white/5 border-white/10 text-gray-500"
                            }`}>
                              {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : isLocked ? <Lock className="w-4 h-4" /> : <Circle className="w-2 h-2 fill-current" />}
                            </div>
                            <div>
                              <h4 className="font-bold text-white group-hover:text-primary transition-colors">
                                {topic.title}
                              </h4>
                              <div className="flex items-center gap-3 text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">
                                <span className={topic.difficulty === 'advanced' ? 'text-red-400' : 'text-gray-500'}>
                                  {topic.difficulty}
                                </span>
                                {isCompleted && progress.score && (
                                  <span className="text-green-500">Score: {progress.score}%</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            {!isCompleted && !isLocked && (
                               <Link 
                                 href={`/education/studio?topic=${encodeURIComponent(topic.title)}&subject=${encodeURIComponent(roadmap.subject)}`}
                                 className="flex items-center gap-2 px-4 py-2 bg-primary text-background text-xs font-black rounded-lg hover:scale-105 transition-transform"
                               >
                                 <Play className="w-3 h-3 fill-current" />
                                 Start Lesson
                               </Link>
                            )}
                            {isCompleted && (
                               <button className="text-[10px] text-gray-500 font-bold uppercase tracking-widest hover:text-white transition-colors">
                                 Review
                               </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <div className="mt-12 p-8 bg-gradient-to-r from-secondary/5 to-primary/5 border border-white/10 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
            <GraduationCap className="w-6 h-6 text-secondary" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-white">Need a dynamic tutor for this course?</h4>
            <p className="text-sm text-gray-400">Ask our AI for specific deep-dives anytime.</p>
          </div>
        </div>
        <button className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-white transition-all">
          Chat with Tutor
        </button>
      </div>
    </div>
  );
}
