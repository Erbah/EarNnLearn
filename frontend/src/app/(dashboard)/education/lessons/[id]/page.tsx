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
  Clock,
  Play,
  Pause,
  Square,
  Volume2
} from "lucide-react";
import LessonPlayer from "@/components/LessonPlayer";
import AITutorChat from "@/components/AITutorChat";
import { WhiteboardView } from "@/components/WhiteboardView";
import { pauseSpeech, resumeSpeech, stopSpeech, setSpeechVolume } from "@/lib/tts";
import { whiteboardManager } from "@/lib/whiteboard";

const API = "/api/v1";

interface Scene {
  id: string;
  type: "slide" | "quiz" | "interactive" | "discussion";
  title: string;
  content: string;
  order: number;
  completed: boolean;
  duration_minutes?: number;
  quiz_questions?: Array<{
    id: string;
    question: string;
    options: string[];
    correct_answer: string;
    explanation: string;
  }>;
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
}

export default function LessonPage() {
  const params = useParams();
  const id = params?.id as string;
  
  useEffect(() => {
    console.log("LessonPage mounted with ID:", id);
  }, [id]);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [expandedModule, setExpandedModule] = useState(0);
  const [showChat, setShowChat] = useState(false);

  // --- 🧹 CLEAR WHITEBOARD ON SCENE CHANGE ---
  useEffect(() => {
    whiteboardManager.clear();
  }, [currentSceneIndex]);

  // --- 🎙️ GLOBAL AUDIO PERSISTENCE (v17) ---
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
          console.log("Lesson data fetched successfully for ID:", id);
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
    <div className="min-h-screen bg-background pb-12 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/education"
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </Link>
        <div className="text-right">
          <h1 className="text-3xl font-bold text-white">{lesson.title}</h1>
          <p className="text-sm text-gray-400">
            {lesson.difficulty} • {lesson.style.charAt(0).toUpperCase() + lesson.style.slice(1)} Style
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-300">Progress</span>
          <span className="text-sm text-primary font-bold">{progressPercent}%</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Learning Workspace */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* 🧪 Visual Lab - Dedicated Illustration Board */}
          <div className="relative w-full aspect-video rounded-3xl border border-white/10 bg-slate-900/40 shadow-2xl overflow-hidden group ring-1 ring-white/5">
            <div className="absolute top-5 left-5 z-10 flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.6)]" />
              <span className="text-[10px] font-black text-secondary/70 tracking-[0.2em] uppercase">Visual Lab</span>
            </div>
            <WhiteboardView />
          </div>

          {/* 📖 Theory Zone - Balanced Reading Width */}
          <div className="max-w-4xl mx-auto w-full">
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

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Scene Navigator */}
          <div className="bg-card/70 border border-white/10 rounded-2xl p-6 glass">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Course Content
            </h3>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {lesson.scenes.map((scene, idx) => (
                <button
                  key={scene.id}
                  onClick={() => setCurrentSceneIndex(idx)}
                  className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 ${
                    idx === currentSceneIndex
                      ? "bg-primary/20 border border-primary/50"
                      : "bg-white/5 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  {scene.completed ? (
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  ) : idx === currentSceneIndex ? (
                    <Play className="w-4 h-4 text-primary flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-gray-600 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {scene.title}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {scene.type}
                      {scene.duration_minutes && ` • ${scene.duration_minutes} min`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-card/70 border border-white/10 rounded-2xl p-4 glass">
            <div className="flex items-center gap-2 text-sm text-gray-300 mb-3">
              <Clock className="w-4 h-4" />
              <span>Total Duration</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {lesson.total_duration_minutes} min
            </p>
          </div>

          {/* AI Tutor Button */}
          <button
            onClick={() => setShowChat(!showChat)}
            className={`w-full py-3 rounded-xl font-medium transition-all ${
              showChat
                ? "bg-secondary text-background"
                : "bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30"
            }`}
          >
            {showChat ? "Close AI Tutor" : "Ask AI Tutor 🤖"}
          </button>
        </div>
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
            {/* Play/Pause Toggle */}
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

            {/* Stop / Cancel */}
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

            {/* Vertical Divider */}
            <div className="h-8 w-px bg-white/10"></div>

            {/* Volume Control */}
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
                className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Tutor Chat */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mt-8"
          >
            <AITutorChat 
              lessonId={lesson.id} 
              currentSceneId={currentScene?.id}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
