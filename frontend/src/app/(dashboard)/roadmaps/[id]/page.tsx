"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Play, 
  ChevronRight, 
  CheckCircle2, 
  Lock, 
  Circle, 
  Sparkles, 
  BookOpen, 
  Clock, 
  BarChart3,
  ToggleLeft as Toggle,
  AlertCircle,
  ArrowRight,
  RefreshCcw,
  Trophy,
  History
} from "lucide-react";
import { api } from "@/lib/api";
import { SubjectRoadmapDetails, TopicProgress } from "@/types/roadmap";
import RoadblockModal from "@/components/RoadblockModal";

export default function RoadmapPage() {
  const { id } = useParams();
  const router = useRouter();
  const [roadmap, setRoadmap] = useState<SubjectRoadmapDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const [guidedMode, setGuidedMode] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<{ id: string; title: string; prereqId: string; prereqTitle: string; soft: boolean } | null>(null);

  useEffect(() => {
    loadRoadmap();
  }, [id]);

  async function loadRoadmap() {
    try {
      const res = await api.get(`/api/v1/education/roadmaps/${id}`);
      setRoadmap(res.data);
      setGuidedMode(res.data.guided_mode);
      
      // Auto-expand first incomplete unit
      const firstIncompleteUnit = res.data.unit_stats.findIndex((u: any) => !u.is_completed);
      if (firstIncompleteUnit !== -1) {
        setExpandedUnits({ [res.data.roadmap_data.units[firstIncompleteUnit].title]: true });
      } else {
        // Expand first unit by default
        setExpandedUnits({ [res.data.roadmap_data.units[0].title]: true });
      }
    } catch (err) {
      console.error("Failed to load roadmap:", err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleGuidedMode() {
    const newMode = !guidedMode;
    setGuidedMode(newMode);
    try {
      await api.patch(`/api/v1/education/roadmaps/${id}/config`, { guided_mode: newMode });
    } catch (err) {
      console.error("Failed to update guided mode:", err);
    }
  }

  const toggleUnit = (title: string) => {
    setExpandedUnits(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const isLocked = (topicId: string) => {
    if (!guidedMode || !roadmap) return false;
    const prereqs = roadmap.dependency_graph[topicId] || [];
    return prereqs.some(pId => {
       const pStatus = roadmap.progress[pId]?.status || "not_started";
       return pStatus !== "completed";
    });
  };

  const isSoftLocked = (topicId: string) => {
     if (!guidedMode || !roadmap) return false;
     const prereqs = roadmap.dependency_graph[topicId] || [];
     return prereqs.some(pId => {
        const pProgress = roadmap.progress[pId];
        return pProgress?.status === "completed" && (pProgress.score || 0) < 60;
     });
  };

  const handleTopicClick = (topicId: string, mode: string = "normal") => {
     const locked = isLocked(topicId);
     const softLocked = isSoftLocked(topicId);
     
     if (locked || (softLocked && guidedMode)) {
        // Find the first blocking prerequisite
        const prereqId = roadmap?.dependency_graph[topicId]?.[0] || "";
        let prereqTitle = "Foundation Topic";
        if (roadmap) {
           for (const unit of roadmap.roadmap_data.units) {
              const found = unit.topics.find((t: any) => t.id === prereqId);
              if (found) { prereqTitle = found.title; break; }
           }
        }
        
        setSelectedTopic({ 
           id: topicId, 
           title: "Prerequisite Required", 
           prereqId, 
           prereqTitle, 
           soft: softLocked && !locked 
        });
        setModalOpen(true);
        return;
     }
     
     router.push(`/education/lesson/${topicId}?mode=${mode}`);
  };

  if (loading) return <RoadmapSkeleton />;
  if (!roadmap) return <div className="p-8 text-center text-gray-500">Roadmap not found.</div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Course Header */}
        <section className="relative p-8 rounded-[2.5rem] bg-gradient-to-br from-blue-900/20 to-purple-900/10 border border-white/5 overflow-hidden glass">
             <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Sparkles className="w-32 h-32 text-primary" />
             </div>
             
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                   <div className="flex items-center gap-2 text-primary">
                      <BookOpen className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">AI Personalized Course</span>
                   </div>
                   <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                      {roadmap.subject}
                   </h1>
                   <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> ~{Math.round(roadmap.roadmap_data.units.length * 45)} min left</span>
                      <span className="flex items-center gap-1.5"><BarChart3 className="w-4 h-4" /> {roadmap.roadmap_data.units.length} Units</span>
                   </div>

                   {/* Elite: Smart Recommendation Reasoning */}
                   {roadmap.recommendation_reason && (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl bg-primary/10 border border-primary/20 max-w-md mt-2"
                      >
                         <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                         <p className="text-[11px] font-medium text-primary leading-tight">
                            {roadmap.recommendation_reason}
                         </p>
                      </motion.div>
                   )}
                </div>

                <div className="flex flex-wrap gap-3">
                   <button 
                      onClick={() => router.push(`/education/lesson/${roadmap.recommended_topic_id || roadmap.resume_topic_id}`)}
                      className="px-6 py-3 rounded-2xl bg-primary text-black font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-lg shadow-primary/20"
                   >
                      <Play className="w-4 h-4 fill-current" />
                      {roadmap.overall_progress > 0 ? "Continue Journey" : "Start Adventure"}
                   </button>
                   
                   <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10">
                      <span className="text-xs font-medium text-gray-400">Guided Mode</span>
                      <button 
                        onClick={toggleGuidedMode} 
                        className="text-primary hover:opacity-80 transition-opacity"
                        aria-label={guidedMode ? "Disable Guided Mode" : "Enable Guided Mode"}
                      >
                         <Toggle className={`w-8 h-8 ${guidedMode ? "" : "rotate-180 opacity-40 text-gray-400"}`} />
                      </button>
                   </div>
                </div>
             </div>

             {/* Progress Bar with Milestone Markers */}
             <div className="mt-8 space-y-3">
                <div className="flex justify-between items-end">
                   <span className="text-lg font-black">{roadmap.overall_progress}% <span className="text-sm font-normal text-gray-500">Completed</span></span>
                   <span className="text-xs font-medium text-gray-400">Topics: {roadmap.unit_stats.reduce((a, b) => a + b.completed_topics, 0)} / {roadmap.unit_stats.reduce((a, b) => a + b.total_topics, 0)}</span>
                </div>
                <div className="relative h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                   <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${roadmap.overall_progress}%` }}
                      className="h-full bg-gradient-to-r from-primary via-blue-500 to-purple-500"
                   />
                   {/* Milestone Markers */}
                   <div className="absolute top-0 bottom-0 w-px bg-white/5 left-1/4" />
                   <div className="absolute top-0 bottom-0 w-px bg-white/5 left-2/4" />
                   <div className="absolute top-0 bottom-0 w-px bg-white/5 left-3/4" />
                </div>
             </div>
        </section>

        {/* Curriculum Units */}
        <div className="space-y-4">
           {roadmap.roadmap_data.units.map((unit, uIdx) => (
             <UnitAccordion 
                key={unit.title}
                unit={unit}
                stats={roadmap.unit_stats[uIdx]}
                isExpanded={!!expandedUnits[unit.title]}
                onToggle={() => toggleUnit(unit.title)}
                progress={roadmap.progress}
                isLocked={isLocked}
                isSoftLocked={isSoftLocked}
                onSelectTopic={handleTopicClick}
             />
           ))}
        </div>

        {selectedTopic && (
          <RoadblockModal 
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            topicTitle={selectedTopic.title}
            prerequisiteTitle={selectedTopic.prereqTitle}
            prerequisiteId={selectedTopic.prereqId}
            isSoftLock={selectedTopic.soft}
          />
        )}

      </div>
    </div>
  );
}

function UnitAccordion({ unit, stats, isExpanded, onToggle, progress, isLocked, isSoftLocked, onSelectTopic }: any) {
   return (
      <div className={`rounded-3xl border transition-all ${isExpanded ? 'bg-white/5 border-white/10' : 'bg-transparent border-white/5 hover:border-white/10'}`}>
         <button 
            onClick={onToggle}
            className="w-full flex items-center justify-between p-6 cursor-pointer"
         >
            <div className="flex items-center gap-4">
               <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${stats.is_completed ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                  {stats.is_completed ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-sm font-bold">{unit.title.match(/\d+/) || 'U'}</span>}
               </div>
               <div className="text-left">
                  <h3 className="font-bold text-white leading-tight">{unit.title}</h3>
                  <p className="text-xs text-gray-500">{stats.completed_topics}/{stats.total_topics} Topics Complete</p>
               </div>
            </div>
            <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
         </button>
         
         <AnimatePresence>
            {isExpanded && (
               <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-white/5"
               >
                  <div className="p-2 space-y-1">
                     {unit.topics.map((topic: any) => {
                        const status = progress[topic.id]?.status || "not_started";
                        const locked = isLocked(topic.id);
                        const softLocked = isSoftLocked(topic.id);
                        
                        return (
                           <div 
                              key={topic.id}
                              onClick={() => !locked && onSelectTopic(topic.id)}
                              className={`group relative flex items-center justify-between p-4 rounded-2xl transition-all cursor-pointer ${locked ? 'opacity-40 grayscale pointer-events-none' : 'hover:bg-white/5'}`}
                           >
                              <div className="flex items-center gap-4">
                                 <div className="flex flex-col items-center">
                                    {status === "completed" ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : 
                                     status === "in_progress" ? <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" /> :
                                     locked ? <Lock className="w-4 h-4 text-gray-500" /> :
                                     <Circle className="w-5 h-5 text-gray-600" />}
                                 </div>
                                 <div className="space-y-0.5">
                                    <h4 className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">{topic.title}</h4>
                                    <div className="flex items-center gap-3 text-[10px] text-gray-500 font-medium">
                                       <span className="bg-white/5 px-1.5 py-0.5 rounded uppercase tracking-wider">{topic.difficulty}</span>
                                       <span>~12 min</span>
                                    </div>
                                 </div>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                 {status === "completed" ? (
                                    <div className="flex items-center gap-2">
                                       <button 
                                          title="Review Mode (Refresh)"
                                          onClick={(e) => { e.stopPropagation(); onSelectTopic(topic, 'review'); }}
                                          className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all"
                                       >
                                          <RefreshCcw className="w-4 h-4" />
                                       </button>
                                       <button 
                                          title="Challenge Mode"
                                          onClick={(e) => { e.stopPropagation(); onSelectTopic(topic, 'challenge'); }}
                                          className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-white transition-all"
                                       >
                                          <Trophy className="w-4 h-4" />
                                       </button>
                                    </div>
                                 ) : (
                                    <>
                                       {softLocked && (
                                          <div className="group/warn relative">
                                             <AlertCircle className="w-4 h-4 text-orange-500 cursor-help" />
                                             <div className="absolute bottom-full right-0 mb-2 w-48 p-2 rounded-lg bg-orange-950/90 border border-orange-500/20 text-[10px] text-orange-200 opacity-0 group-hover/warn:opacity-100 transition-opacity pointer-events-none z-50">
                                                Low confidence in prerequisite. Mastery recommended.
                                             </div>
                                          </div>
                                       )}
                                       <button 
                                          aria-label={`Start topic ${topic.title}`}
                                          className={`p-2 rounded-lg border transition-all ${status === "completed" ? "bg-white/5 border-white/10 opacity-50" : "bg-primary/10 border-primary/20 text-primary group-hover:bg-primary group-hover:text-black"}`}
                                       >
                                          <ArrowRight className="w-4 h-4" />
                                       </button>
                                    </>
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
   );
}

function RoadmapSkeleton() {
   return (
      <div className="p-8 max-w-6xl mx-auto space-y-8 animate-pulse">
         <div className="h-64 bg-white/5 rounded-[2.5rem]" />
         <div className="space-y-4">
            <div className="h-20 bg-white/5 rounded-3xl" />
            <div className="h-20 bg-white/5 rounded-3xl" />
            <div className="h-20 bg-white/5 rounded-3xl" />
         </div>
      </div>
   );
}
