"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { BookOpen, Check, Cpu } from "lucide-react";
import Link from "next/link";

// New Components
import ForgeIntake from "@/components/studio/ForgeIntake";
import BlueprintPreview from "@/components/studio/BlueprintPreview";
import SynthesisVisualization from "@/components/studio/SynthesisVisualization";

const API = "/api/v1";

type ForgeState = "INTAKE" | "BLUEPRINT" | "FORGING" | "COMPLETE";

import { Suspense } from "react";

function EducationStudioContent() {
  const [state, setState] = useState<ForgeState>("INTAKE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [topic, setTopic] = useState("");
  const [roadmap, setRoadmap] = useState<any>(null);
  const [generatedLessonId, setGeneratedLessonId] = useState<string | null>(null);
  const [generatedRoadmapId, setGeneratedRoadmapId] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isRearchitecting, setIsRearchitecting] = useState(false);

  const steps = [
    "Consulting Curriculum Architect...",
    "Parsing Knowledge Layers...",
    "Extracting Mastery Nodes...",
    "Validating Structural Integrity..."
  ];

  const searchParams = useSearchParams();

  // Effect to handle direct links to topics (e.g. from dashboard)
  useEffect(() => {
    const topicParam = searchParams.get("topic");
    if (topicParam && state === "INTAKE") {
      setTopic(topicParam);
      // Auto-trigger architect phase
      handleIntakeComplete({ topic: topicParam, difficulty: "intermediate", style: "interactive" });
    }
  }, [searchParams]);

  // Phase 1: Architect Blueprint
  const handleIntakeComplete = async (data: { topic: string; difficulty: string; style: string; source_id?: string }) => {
    setTopic(data.topic);
    if (data.source_id) {
      setSourceId(data.source_id);
    }
    setLoading(true);
    setError(null);
    setLoadingStep(0);

    // Progress Simulation for UX
    const stepInterval = setInterval(() => {
      setLoadingStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 1500);

    try {
      // Stage 1: Generate Roadmap
      let url = `${API}/education/roadmaps/generate?subject=${encodeURIComponent(data.topic)}`;
      if (data.source_id) {
        url += `&source_id=${data.source_id}`;
      }
      if (isRearchitecting) {
        url += `&force=true`;
      }
      const res = await api.post(url);
      setIsRearchitecting(false); // Reset after use
      clearInterval(stepInterval);
      setLoadingStep(3); // Complete
      if (res.status === 200 || res.status === 201) {
        // roadmap data is now structured with an ID
        const roadmapId = res.data.id;
        const roadmapData = res.data.roadmap_data || res.data;
        const rawUnits = roadmapData.units || res.data.units || [];
        
        setGeneratedRoadmapId(roadmapId);
        
        // Ensure every unit has a topics array to prevent BlueprintPreview crashes
        const validatedUnits = rawUnits.map((unit: any) => ({
          ...unit,
          id: unit.id || Math.random().toString(36).substr(2, 9),
          topics: Array.isArray(unit.topics) ? unit.topics : []
        }));

        setRoadmap({
          ...res.data,
          id: roadmapId,
          roadmap_data: roadmapData,
          units: validatedUnits
        });
        setState("BLUEPRINT");
      }
    } catch (err: any) {
      console.error("Architect Phase Error:", err);
      setError(err.response?.data?.detail || "Failed to architect roadmap. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Phase 2: Launch Forge (Generate Lesson)
  const handleLaunchForge = async () => {
    setState("FORGING");
    setLoading(true);
    setError(null);
    try {
      // Stage 2: Generate Deep Lesson using the roadmap
      const res = await api.post(`${API}/education/lessons/generate`, {
        title: `Mastering ${topic}`,
        topic: topic,
        difficulty: "intermediate",
        education_level: "Self-Learning / Independent Mastery Track",
        learner_goal: "Master the subject deeply",
        objectives: roadmap?.units?.map((u: any) => u.title) || ["Master the core concepts"],
        style: "interactive",
        target_duration_minutes: 45,
        roadmap_id: roadmap.id,
        source_id: sourceId
      });

      if (res.status === 200 || res.status === 201) {
        setGeneratedLessonId(res.data.lesson_id || res.data.id);
        setGeneratedRoadmapId(res.data.roadmap_id);
        setState("COMPLETE");
      }
    } catch (err: any) {
      console.error("Forge Phase Error:", err);
      setError(err.response?.data?.detail || "Synthesis failed. Please try again.");
      setState("BLUEPRINT");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e14] text-white overflow-x-hidden">
      {/* Immersive Background Grid */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Header (Minimalist) */}
      <div className="relative z-20 pt-8 px-8 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 group-hover:border-primary/60 transition-colors">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-[0.3em] text-primary uppercase block leading-none mb-1">Omni-Curriculum Engine</span>
            <span className="text-sm font-serif text-gray-400">Mastery Studio v2.0</span>
          </div>
        </Link>
      </div>

      <main className="relative z-10 px-6">
        <AnimatePresence mode="wait">
          {state === "INTAKE" && (
            <motion.div
              key="intake"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ForgeIntake onComplete={handleIntakeComplete} />
              {error && (
                <div className="max-w-md mx-auto mt-8 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm text-center">
                   {error}
                </div>
              )}
              {loading && (
                <div className="text-center mt-12">
                   <div className="flex flex-col items-center gap-4">
                      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold animate-pulse">
                         <Cpu className="w-4 h-4 animate-spin" />
                         {steps[loadingStep]}
                      </div>
                      <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
                         <motion.div 
                            className="h-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${((loadingStep + 1) / steps.length) * 100}%` }}
                         />
                      </div>
                   </div>
                </div>
              )}
            </motion.div>
          )}

          {state === "BLUEPRINT" && roadmap && (
            <motion.div
              key="blueprint"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <BlueprintPreview 
                roadmap={{
                  subject: roadmap.subject,
                  units: roadmap.units
                }} 
                onApprove={handleLaunchForge}
                onCancel={() => {
                  setIsRearchitecting(true);
                  setState("INTAKE");
                }}
              />
            </motion.div>
          )}

          {state === "FORGING" && (
            <motion.div
              key="forging"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <SynthesisVisualization />
              {error && (
                <div className="max-w-md mx-auto mt-8 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm text-center">
                   {error}
                </div>
              )}
            </motion.div>
          )}

          {state === "COMPLETE" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto py-32 text-center"
            >
              <div className="w-24 h-24 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-8">
                <Check className="w-12 h-12 text-green-400" />
              </div>
              <h2 className="text-4xl font-serif text-white mb-4">Synthesis Complete</h2>
              <p className="text-gray-400 mb-12 text-lg">Your elite learning path has been forged and is ready for immersion.</p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href={generatedLessonId
                    ? `/education/lessons/${generatedLessonId}`
                    : `/education/roadmap/${generatedRoadmapId}`
                  }
                  className="px-12 py-5 bg-primary text-background font-black rounded-2xl hover:bg-primary/90 transition-all text-xl shadow-[0_0_30px_rgba(0,224,255,0.4)]"
                >
                  Enter Workspace
                </Link>
                <button
                  onClick={() => setState("INTAKE")}
                  className="px-8 py-5 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all"
                >
                  Forge Another
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function EducationStudio() {
  return (
    <Suspense fallback={<div>Loading Education Studio...</div>}>
      <EducationStudioContent />
    </Suspense>
  );
}
