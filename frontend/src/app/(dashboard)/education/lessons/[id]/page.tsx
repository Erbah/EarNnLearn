"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  BookOpen,
  CheckCircle,
  Play,
  Pause,
  Clock,
  Square,
  Volume2,
  GraduationCap,
  Info,
  X,
  Cpu,
  CheckCircle2
} from "lucide-react";
import LessonPlayer from "@/components/LessonPlayer";
import AITutorChat from "@/components/AITutorChat";
import { pauseSpeech, resumeSpeech, stopSpeech, setSpeechVolume } from "@/lib/tts";

import { LessonSceneWithActions } from "@/types/lesson";

const API = "/api/v1";

interface Scene extends LessonSceneWithActions {
  duration_minutes?: number;
  uai?: string;
}

interface Lesson {
  id: string;
  title: string;
  topic: string;
  difficulty: string;
  style: string;
  description: string;
  created_at: string;
  scenes: Scene[];
  total_duration_minutes: number;
  completed_scenes: number;
  curriculum_metadata?: any;
  roadmap_id?: string;
}

export default function LessonPage() {
  const params = useParams();
  const id = params?.id as string;
  
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [showSyllabus, setShowSyllabus] = useState(false);

  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    if (!id) return;

    const fetchLesson = async () => {
      try {
        setLoading(true);
        const res = await api.get(`${API}/education/lessons/${id}`);
        if (res.status === 200) {
          const data = res.data;
          setLesson({
            ...data,
            scenes: data.scenes || [],
            completed_scenes: data.progress?.completed_scenes || 0,
          });
        }
      } catch (err: any) {
        const detail = err.response?.data?.detail;
        setError(
          typeof detail === "string" ? detail : "Failed to load lesson"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchLesson();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
        <p className="text-red-400 mb-4">{error || "Lesson not found"}</p>
        <Link
          href="/education"
          className="px-6 py-2 bg-primary text-background font-bold rounded-lg hover:scale-105 transition-transform inline-block"
        >
          Back to Lessons
        </Link>
      </div>
    );
  }

  const currentScene = lesson.scenes[currentSceneIndex];
  const progressPercent =
    lesson.scenes.length > 0
      ? Math.round((lesson.completed_scenes / lesson.scenes.length) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-[#0a0e14] -mt-8 -mx-8 flex flex-col h-screen overflow-hidden">
      {/* 🏛️ 1. Conceptual Bridge Banner (Top) */}
      <div className="bg-[#111827] border-b border-white/5 p-4 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
           <div className="flex items-center gap-4">
              <Link href={lesson.roadmap_id ? `/education/roadmap/${lesson.roadmap_id}` : '/education'} className="p-2 hover:bg-white/5 rounded-lg text-gray-500 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="h-8 w-px bg-white/5 mx-2" />
              <div>
                <span className="text-[9px] font-black tracking-widest text-primary uppercase">Conceptual Bridge</span>
                <p className="text-xs text-gray-400 font-medium italic">
                   "Previously: You mastered foundations. Today: We bridge core mechanics to applied logic."
                </p>
              </div>
           </div>
           
           <div className="flex items-center gap-6">
              <div className="text-right hidden md:block">
                 <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{lesson.title}</p>
                 <p className="text-[10px] font-mono text-primary/60 uppercase">{currentScene?.uai || 'MOD-ID'}</p>
              </div>
              <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-white/5">
                <span className="text-[10px] font-black text-primary">{progressPercent}%</span>
              </div>
           </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 📚 2. Focus Mode Workspace (Main Center) */}
        <main className="flex-1 overflow-y-auto bg-[#0a0e14] relative">
           <div className="max-w-4xl mx-auto p-8 md:p-12">
             <div className="prose prose-invert max-w-none">
                {currentScene && (
                  <LessonPlayer
                    scene={currentScene}
                    lessonId={lesson.id}
                    isAudioPlaying={isAudioPlaying}
                    setIsAudioPlaying={setIsAudioPlaying}
                    isAudioPaused={isAudioPaused}
                    volume={volume}
                    onSceneComplete={() => {
                      if (currentSceneIndex < lesson.scenes.length - 1) {
                        setCurrentSceneIndex(currentSceneIndex + 1);
                      }
                    }}
                    onTutorHelp={() => setShowChat(true)}
                  />
                )}
             </div>
           </div>
        </main>

        {/* 🏛️ 3. Mastery & Assessment HUD (Right Sidebar) */}
        <aside className="w-96 bg-[#111827]/50 border-l border-white/5 flex flex-col overflow-hidden">
           <div className="p-6 border-b border-white/5">
              <div className="flex items-center justify-between mb-6">
                 <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Mastery HUD</h3>
                 <button onClick={() => setShowSyllabus(true)} className="p-2 hover:bg-white/5 rounded-lg text-primary transition-colors">
                    <GraduationCap className="w-4 h-4" />
                 </button>
              </div>

              <div className="space-y-4">
                 <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                    <div className="flex items-center justify-between text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">
                       <span>Retention</span>
                       <span>Active</span>
                    </div>
                    <div className="w-full h-1 bg-emerald-500/20 rounded-full overflow-hidden">
                       <div className="w-[85%] h-full bg-emerald-500" />
                    </div>
                 </div>
              </div>
           </div>

           <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <section>
                 <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-4">Module Navigation</h4>
                 <div className="space-y-2">
                    {lesson.scenes.map((scene, idx) => (
                      <button
                        key={scene.id}
                        onClick={() => setCurrentSceneIndex(idx)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-3 ${
                          idx === currentSceneIndex
                            ? "bg-primary/10 border-primary/30"
                            : "bg-white/5 border-white/5 hover:bg-white/10"
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${scene.completed ? 'bg-emerald-500' : idx === currentSceneIndex ? 'bg-primary' : 'bg-gray-700'}`} />
                        <span className={`text-xs font-bold ${idx === currentSceneIndex ? 'text-white' : 'text-gray-500'}`}>{scene.title}</span>
                      </button>
                    ))}
                 </div>
              </section>

              <section className="h-[400px] flex flex-col">
                 <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-4">Quick Quiz / Scratchpad</h4>
                 <div className="flex-1 bg-white/5 border border-white/5 rounded-2xl p-4 overflow-y-auto">
                    {showChat ? (
                       <AITutorChat 
                        lessonId={lesson.id} 
                        currentSceneId={currentScene?.id}
                      />
                    ) : (
                       <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                          <Cpu className="w-8 h-8 text-gray-600" />
                          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Active Tools Ready</p>
                          <button 
                            onClick={() => setShowChat(true)}
                            className="px-4 py-2 bg-primary text-background text-[10px] font-black uppercase tracking-widest rounded-lg"
                          >
                            Ask Architect
                          </button>
                       </div>
                    )}
                 </div>
              </section>
           </div>
        </aside>
      </div>

      {/* PRIMARY: Global Floating Bottom Audio Control Bar */}
      <AnimatePresence>
        {isAudioPlaying && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-6 px-6 py-3 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl z-[100] md:min-w-[320px]"
          >
            <button 
              onClick={() => {
                if (isAudioPaused) {
                  resumeSpeech();
                  setIsAudioPaused(false);
                } else {
                  pauseSpeech();
                  setIsAudioPaused(true);
                }
              }}
              className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-background hover:scale-105 active:scale-95 transition-transform"
            >
              {isAudioPaused ? <Play className="w-5 h-5 ml-1" /> : <Pause className="w-5 h-5" />}
            </button>

            <button
              onClick={() => {
                stopSpeech();
                setIsAudioPlaying(false);
              }}
              className="p-2 text-gray-400 hover:text-red-400 transition-colors"
              title="Stop Audio"
            >
              <Square className="w-5 h-5 fill-current" />
            </button>

            <div className="h-8 w-px bg-white/10"></div>

            <div className="flex items-center gap-3 flex-1">
              <Volume2 className="w-4 h-4 text-gray-400" />
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05"
                value={volume}
                aria-label="Volume Control"
                title="Volume Control"
                onChange={(e) => {
                  const newVol = parseFloat(e.target.value);
                  setVolume(newVol);
                  setSpeechVolume(newVol);
                }}
                className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🎓 Academic Framework Modal */}
      <AnimatePresence>
        {showSyllabus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-8"
          >
            <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={() => setShowSyllabus(false)} />
            
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl max-h-[90vh] bg-card border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <GraduationCap className="w-8 h-8 text-primary" />
                    Academic Curriculum Framework
                  </h2>
                  <p className="text-sm text-gray-400">Deep structural specifications as per LessonAi Protocol</p>
                </div>
                <button 
                  onClick={() => setShowSyllabus(false)}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8">
                {lesson.curriculum_metadata ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Left Column: Foundation */}
                    <div className="space-y-8">
                      <section>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-4">Section A: Course Foundation</h3>
                        <div className="space-y-4">
                          {[
                            { label: "Title", value: lesson.curriculum_metadata.section_a?.title || lesson.title },
                            { label: "Level", value: lesson.curriculum_metadata.section_a?.academic_level || lesson.difficulty },
                            { label: "Purpose", value: lesson.curriculum_metadata.section_a?.purpose || 'Comprehensive subject mastery' },
                            { label: "Duration", value: lesson.curriculum_metadata.section_a?.study_duration || `${lesson.target_duration_minutes} min` }
                          ].map((item, i) => (
                            <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/5">
                              <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">{item.label}</p>
                              <p className="text-sm text-gray-200">{item.value}</p>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section>
                         <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-4">Professional Path</h3>
                         <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl">
                           <p className="text-sm text-primary/80 leading-relaxed italic">
                             {lesson.curriculum_metadata.section_h?.career_path}
                           </p>
                         </div>
                      </section>
                    </div>

                    {/* Middle Column: Learning Path */}
                    <div className="space-y-8">
                      <section>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-secondary mb-4">Section C: Roadmap Timeline</h3>
                        <div className="space-y-3">
                          {lesson.curriculum_metadata.section_c?.phases?.map((phase: any, i: number) => (
                            <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/5">
                              <p className="text-xs font-bold text-white mb-2">{phase.phase} Phase</p>
                              <p className="text-[10px] text-gray-400 mb-2 leading-relaxed">{phase.learned}</p>
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-secondary" />
                                <p className="text-[10px] font-bold text-secondary uppercase">{phase.competencies}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                      
                      <section>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 mb-4">Mastery Definition</h3>
                        <p className="text-sm text-gray-400 bg-white/5 p-4 rounded-2xl border border-white/5">
                          {lesson.curriculum_metadata.section_f?.mastery_definition}
                        </p>
                      </section>
                    </div>

                    {/* Right Column: Outcomes & Systems */}
                    <div className="space-y-8">
                      <section>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-green-400 mb-4">Learning Outcomes</h3>
                        <div className="space-y-2">
                          {lesson.curriculum_metadata.section_a?.outcomes?.map((out: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-gray-400">
                              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                              <span>{out}</span>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section>
                         <h3 className="text-xs font-black uppercase tracking-[0.2em] text-orange-400 mb-4">Assessment Plan</h3>
                         <div className="flex flex-wrap gap-2">
                           {lesson.curriculum_metadata.section_d?.assessment_plan?.map((plan: string, i: number) => (
                             <span key={i} className="px-3 py-1 bg-orange-400/10 border border-orange-400/20 text-orange-400 text-[10px] font-bold rounded-full">
                               {plan}
                             </span>
                           ))}
                         </div>
                      </section>

                      <section>
                         <h3 className="text-xs font-black uppercase tracking-[0.2em] text-blue-400 mb-4">Core Resources</h3>
                         <div className="space-y-2">
                           {lesson.curriculum_metadata.section_g?.resources?.map((res: string, i: number) => (
                             <div key={i} className="flex items-center gap-2 text-sm text-gray-400 bg-white/5 p-3 rounded-xl">
                               <BookOpen className="w-4 h-4 text-blue-400" />
                               <span>{res}</span>
                             </div>
                           ))}
                         </div>
                      </section>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Info className="w-12 h-12 text-gray-600 mb-4" />
                    <p className="text-gray-500">Academic framework metadata is being synthesized for this lesson.</p>
                  </div>
                )}
              </div>

              <div className="p-6 bg-white/5 border-t border-white/5 flex justify-center">
                 <div className="text-[10px] font-mono text-gray-600 tracking-widest uppercase">
                   Protocol: LessonAi v2.0 • Academic Rigor Certified
                 </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
