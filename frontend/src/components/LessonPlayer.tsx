"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { CheckCircle2, AlertCircle, HelpCircle, Volume2, Pause, Play, Square } from "lucide-react";
import { LessonOrchestrator } from "@/lib/orchestration";
import { effectsManager } from "@/lib/effects";
import { SpotlightOverlay, LaserPointer, HighlightBox } from "@/components/VisualEffects";
import { VisualEffects } from "@/components/VisualEffects";
import type { AgentAction, LessonSceneWithActions, QuizQuestion } from "@/types/openmaic";
import confetti from "canvas-confetti";
import { AriaOrb } from "@/components/AriaOrb";
import { cleanLessonContent } from "@/lib/content";
import { pauseSpeech, resumeSpeech, stopSpeech, setSpeechVolume } from "@/lib/tts";

interface Scene extends LessonSceneWithActions {
  semantic_type?: "title" | "explanation" | "deep_dive" | "examples" | "key_takeaways" | "bridge";
}

interface LessonPlayerProps {
  scene: Scene;
  lessonId: string;
  isAudioPlaying: boolean;
  setIsAudioPlaying: (val: boolean) => void;
  isAudioPaused: boolean;
  volume: number;
  onSceneComplete: () => void;
  onTutorHelp: () => void;
}

type QuizAnswers = {
  [questionId: string]: string;
};

export default function LessonPlayer({
  scene,
  lessonId,
  isAudioPlaying,
  setIsAudioPlaying,
  isAudioPaused,
  volume,
  onSceneComplete,
  onTutorHelp,
}: LessonPlayerProps) {
  // --- 🎨 SEMANTIC UI MAPPING (v17) ---
  const semanticConfig = {
    title: { label: "Introduction", icon: "💎", color: "text-blue-400" },
    explanation: { label: "First Principles", icon: "🧠", color: "text-indigo-400" },
    deep_dive: { label: "Elite Deep Dive", icon: "🔬", color: "text-purple-400", bg: "bg-purple-500/5 border-purple-500/20" },
    examples: { label: "Case Studies", icon: "💡", color: "text-amber-400", bg: "bg-amber-500/5 border-amber-500/20" },
    key_takeaways: { label: "Mastery Points", icon: "🏆", color: "text-green-400", bg: "bg-green-500/5 border-green-500/20" },
    bridge: { label: "Coming Up Next", icon: "🌉", color: "text-cyan-400" },
  };

  const config = scene.semantic_type ? semanticConfig[scene.semantic_type] : null;

  // --- 🧠 SMART TITLE EXTRACTION ---
  const displayTitle = scene.semantic_type === "title" 
    ? scene.content.split("\n")[0].replace(/^#+\s*/, "").trim()
    : (() => {
        // Find first sentence that isn't a header
        const cleanBody = scene.content.replace(/^#+\s*.*$/gm, "").trim();
        const firstSentence = cleanBody.split(/[.!?]/)[0].trim();
        return firstSentence.length > 2 && firstSentence.length < 70 
          ? firstSentence 
          : (config?.label || scene.title);
      })();

  const [completed, setCompleted] = useState(scene.completed);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswers>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [effectsState, setEffectsState] = useState<any>(null);

  const lastActionSceneRef = useRef<string | null>(null);
  const quizStartTimeRef = useRef<string | null>(null);
  const orchestratorRef = useRef<LessonOrchestrator | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastConfettiRef = useRef<number>(0);

  // --- 🚨 Hardening: Persistence Layer ---
  useEffect(() => {
    const cached = localStorage.getItem(`lesson_cache_${lessonId}_${scene.id}`);
    if (cached) {
      try {
        const { answers, submitted, score } = JSON.parse(cached);
        setQuizAnswers(answers);
        setQuizSubmitted(submitted);
        setQuizScore(score);
        if (score >= 60) setCompleted(true);
      } catch (e) { console.error("Cache load failed", e); }
    }
  }, [lessonId, scene.id]);

  useEffect(() => {
    if (scene.type === "quiz" && Object.keys(quizAnswers).length > 0) {
      localStorage.setItem(`lesson_cache_${lessonId}_${scene.id}`, JSON.stringify({
        answers: quizAnswers,
        submitted: quizSubmitted,
        score: quizScore
      }));
    }
  }, [quizAnswers, quizSubmitted, quizScore, lessonId, scene.id]);

  // Track start time for confidence scoring
  useEffect(() => {
    if (scene.type === "quiz" && !quizStartTimeRef.current) {
      quizStartTimeRef.current = new Date().toISOString();
    }
  }, [scene.type]);

  // Initialize orchestrator and subscribe to effects
  useEffect(() => {
    orchestratorRef.current = new LessonOrchestrator();

    // Subscribe to effects state changes
    const unsubscribe = effectsManager.subscribe((state) => {
      setEffectsState(state);
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribe();
      effectsManager.clearAll();
    };
  }, []);

  // Execute scene actions if provided and not yet playing
  useEffect(() => {
    // Only run if we have actions, the orchestrator is ready, and we haven't run them for this scene instance
    if (scene.actions && scene.actions.length > 0 && !isAudioPlaying && lastActionSceneRef.current !== scene.id && orchestratorRef.current) {
      const executeSceneActions = async () => {
        lastActionSceneRef.current = scene.id;
        setIsAudioPlaying(true);
        
        // Safety timer to ensure scene eventually completes even if actions hang
        const forceCompleteTimer = setTimeout(() => {
          console.warn("Scene action execution taking too long, enabling manual skip");
          setCompleted(true); // Allow manual transition if stuck
        }, 30000); // 30 second safety margin

        try {
          for (const action of scene.actions!) {
            // Respect component unmount or scene change
            if (lastActionSceneRef.current !== scene.id) break;
            
            await orchestratorRef.current!.executeAction(action, {
              onTutorHelp,
            });
          }

          // After all actions complete, wait 2 seconds then mark scene complete
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Mark slide as complete in backend
          try {
            await api.post(`/api/v1/education/lessons/${lessonId}/progress`, {
              scene_id: scene.id,
              completed: true,
            });
          } catch (err: any) {
            console.error("Failed to mark scene complete on backend, continuing locally:", err);
            // We continue locally so the user isn't stuck
          }
          
          clearTimeout(forceCompleteTimer);
          setCompleted(true);
          onSceneComplete();
        } catch (err) {
          console.error("Error executing scene actions:", err);
          clearTimeout(forceCompleteTimer);
          setCompleted(true); // Fallback to allowing manual progression
        } finally {
          setIsAudioPlaying(false);
        }
      };

      executeSceneActions();
    }
  }, [scene.actions, isAudioPlaying, setIsAudioPlaying, completed, onTutorHelp, scene.id, lessonId, onSceneComplete]);

  // Mark slide as complete after 5 seconds (only if no actions)
  useEffect(() => {
    if (scene.type === "slide" && !completed && !scene.actions?.length) {
      const timer = setTimeout(async () => {
        try {
          await api.post(`/api/v1/education/lessons/${lessonId}/progress`, {
            scene_id: scene.id,
            completed: true,
          });
          setCompleted(true);
          onSceneComplete();
        } catch (err: any) {
          console.error("Failed to mark scene complete:", err);
        }
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [scene.id, scene.type, lessonId, completed, onSceneComplete, scene.actions]);

  const handleQuizSubmit = async () => {
    if (Object.keys(quizAnswers).length < (scene.quiz_questions?.length || 0)) {
      setFeedback("Please answer all questions before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(
        `/api/v1/education/lessons/${lessonId}/scenes/${scene.id}/quiz/submit`,
        { 
          answers: quizAnswers,
          start_time: quizStartTimeRef.current 
        }
      );

      if (res.status === 200) {
        const score = res.data.score;
        setQuizScore(score);
        setQuizSubmitted(true);

        const isVerified = score >= 60;
        
        if (isVerified) {
          setCompleted(true);
          
          // --- ✨ ELITE CELEBRATION (v15) ---
          const now = Date.now();
          if (now - lastConfettiRef.current > 5000) {
            if (score >= 90) {
              // Full Mastery Celebration
              confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#06b6d4', '#ffffff', '#3b82f6']
              });
            } else if (score >= 80) {
              // Light Success Burst
              confetti({
                particleCount: 40,
                spread: 50,
                origin: { y: 0.7 },
                colors: ['#06b6d4', '#3b82f6']
              });
            }
            lastConfettiRef.current = now;
          }

          // --- 🧠 SUCCESS REFLECTION (v15) ---
          const reflection = `Excellent! You scored ${Math.round(score)}%. You've just mastered the fundamentals of ${scene.title}.`;
          setFeedback(reflection);
        } else {
          setFeedback(`You scored ${Math.round(score)}%. A minimum of 60% is required. Take a moment to review the explanations and try again!`);
        }
      }
    } catch (err: any) {
      setFeedback("Failed to verify. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  const retryQuiz = () => {
    setQuizSubmitted(false);
    setQuizScore(null);
    setFeedback(null);
    // Keep current answers but allow changing them
  };

  const handleAnswerChange = (questionId: string, selectedOption: string) => {
    setQuizAnswers({
      ...quizAnswers,
      [questionId]: selectedOption,
    });
  };

  return (
    <>
      {/* Visual Effects Layer */}
      <VisualEffects state={effectsState} />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className={`border rounded-2xl p-8 glass min-h-[400px] flex flex-col relative transition-all duration-500 ${
          config?.bg || "bg-card/70 border-white/10"
        }`}
      >
      {/* Header - Layered Rendering (Always show title first) */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-4">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-4"
          >
            <AriaOrb 
              state={quizSubmitted && (quizScore || 0) >= 80 ? 'success' : isAudioPlaying && !isAudioPaused ? 'speaking' : 'idle'} 
              size={64} 
              className="hidden md:flex"
            />
            
            {/* SECONDARY: Header Mini Control (Contextual) removed to global bar */}

            <div className="ml-2">
              <div className="flex items-center gap-2 mb-1">
                {config && (
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ${config.color}`}>
                    {config.icon} {config.label}
                  </span>
                )}
                {scene.type === "quiz" && (
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400">
                    Challenge
                  </span>
                )}
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-white leading-tight tracking-tight">
                {displayTitle}
              </h2>
            </div>
          </motion.div>
          {completed && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2 text-green-400 bg-green-400/10 px-3 py-1 rounded-full border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.2)]"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-black uppercase tracking-tight">Mastered</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 mb-6">
        {(scene.type !== "quiz") && (
          <div className="prose prose-invert max-w-none">
            <div
              className="text-gray-100 leading-relaxed text-lg lg:text-xl"
              dangerouslySetInnerHTML={{ __html: cleanLessonContent(scene.content) }}
            />
            {(scene.type === "interactive") && (
              <div className="mt-6 text-center">
                <button
                  onClick={onTutorHelp}
                  className="px-6 py-2 bg-secondary text-background font-bold rounded-lg hover:scale-105 transition-transform"
                >
                  Get AI Assistance
                </button>
              </div>
            )}
            {(scene.type === "discussion") && (
              <div className="mt-6">
                <button
                  onClick={onTutorHelp}
                  className="w-full px-4 py-2 bg-primary/20 border border-primary/50 text-primary font-medium rounded-lg hover:bg-primary/30 transition-colors"
                >
                  Join Discussion
                </button>
              </div>
            )}
          </div>
        )}

        {scene.type === "quiz" && scene.quiz_questions && (
          <div className="space-y-6">
            {scene.quiz_questions.map((question, idx) => (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white/5 border border-white/10 rounded-xl p-4"
              >
                <p className="text-white font-medium mb-4">{question.question}</p>

                <div className="flex flex-col gap-3">
                  {question.options?.map((option, optIdx) => (
                    <motion.label
                      key={optIdx}
                      whileHover={!quizSubmitted ? { scale: 1.01, x: 4 } : {}}
                      whileTap={!quizSubmitted ? { scale: 0.98 } : {}}
                      animate={
                        quizSubmitted
                          ? option === question.correct_answer
                            ? { scale: [1, 1.02, 1], transition: { repeat: 1 } }
                            : quizAnswers[question.id] === option
                            ? { x: [-1, 1, -1, 1, 0], transition: { duration: 0.4 } }
                            : {}
                          : {}
                      }
                      className={`flex items-center gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all min-h-[56px] focus-within:ring-2 focus-within:ring-primary/50 ${
                        quizAnswers[question.id] === option
                          ? "border-primary bg-primary/15 shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]"
                          : "border-white/5 hover:border-white/20 hover:bg-white/5"
                      } ${
                        quizSubmitted
                          ? option === question.correct_answer
                            ? "border-green-500 bg-green-500/20"
                            : quizAnswers[question.id] === option &&
                              option !== question.correct_answer
                            ? "border-red-500 bg-red-500/20"
                            : "opacity-40"
                          : ""
                      }`}
                    >
                      <input
                        type="radio"
                        id={`${question.id}-${optIdx}`}
                        name={question.id}
                        value={option}
                        checked={quizAnswers[question.id] === option}
                        onChange={(e) =>
                          handleAnswerChange(question.id, e.target.value)
                        }
                        disabled={quizSubmitted}
                        title={`Option: ${option}`}
                        aria-label={`Select option: ${option}`}
                        className="w-6 h-6 accent-primary" 
                      />
                      <span className="text-gray-100 font-semibold text-lg">{option}</span>
                    </motion.label>
                  ))}
                </div>

                {quizSubmitted && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-xl"
                  >
                    <div className="flex items-start gap-3">
                      <HelpCircle className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="text-sm text-primary font-bold mb-1">Explanation</p>
                        <p className="text-sm text-gray-300 leading-relaxed">
                          {question.explanation}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
                
                {!quizSubmitted && quizAnswers[question.id] && question.hint && (
                  <p className="mt-3 text-xs text-secondary/70 flex items-center gap-2 italic">
                    <AlertCircle className="w-3 h-3" />
                    Hint: {question.hint}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>


      {/* Feedback */}
      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-4 p-4 rounded-lg border flex items-center gap-3 ${
            feedback.includes("Great") || feedback.includes("scored") && !feedback.includes("Try")
              ? "bg-green-500/10 border-green-500/30 text-green-300"
              : feedback.includes("Try")
              ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-300"
              : "bg-blue-500/10 border-blue-500/30 text-blue-300"
          }`}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{feedback}</span>
        </motion.div>
      )}

      {/* AUDIO BAR MOVED TO PARENT (LessonPage.tsx) */}

      {/* Fixed Mobile Navigation Footer (v14) */}
      <div className="md:hidden h-20" /> {/* Spacer */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-white/10 z-50 transition-transform ${completed || (scene.type === "quiz" && !quizSubmitted) ? 'translate-y-0' : 'translate-y-[100%]'}`}>
        {scene.type === "quiz" && !quizSubmitted ? (
          <button
            onClick={handleQuizSubmit}
            disabled={submitting || Object.keys(quizAnswers).length < (scene.quiz_questions?.length || 0)}
            className="w-full py-4 bg-primary text-background font-black rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-transform"
          >
            {submitting ? "VERIFYING..." : "SUBMIT ANSWERS"}
          </button>
        ) : completed && (
          <button
            onClick={onSceneComplete}
            className="w-full py-4 bg-primary text-background font-black rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-transform"
          >
            NEXT SCENE →
          </button>
        )}
      </div>

      {/* Desktop Desktop Actions (existing hidden on mobile) */}
      <div className="hidden md:block">
        {scene.type === "quiz" && !quizSubmitted && (
          <button
            onClick={handleQuizSubmit}
            disabled={submitting || Object.keys(quizAnswers).length < (scene.quiz_questions?.length || 0)}
            className="w-full py-4 bg-primary text-background font-black rounded-2xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Verifying..." : "Submit Quiz"}
          </button>
        )}

        {scene.type === "quiz" && quizSubmitted && quizScore !== null && (
          <div className="flex gap-4">
            {quizScore < 60 && (
              <button
                onClick={retryQuiz}
                className="flex-1 py-4 bg-white/5 border border-white/20 text-white rounded-2xl font-bold hover:bg-white/10 transition-all"
              >
                Try Again
              </button>
            )}
            <button
              onClick={onSceneComplete}
              disabled={quizScore < 60}
              className={`flex-[2] py-4 rounded-2xl font-black transition-all ${
                quizScore < 60 
                  ? "bg-white/5 text-gray-500 cursor-not-allowed" 
                  : "bg-primary text-background hover:bg-primary/80 shadow-xl shadow-primary/20"
              }`}
            >
              {quizScore < 60 ? "Score 60% to Continue" : "Continue to Next Scene"}
            </button>
          </div>
        )}

        {scene.type === "slide" && completed && (
          <div className="flex justify-center">
            <button
              onClick={onSceneComplete}
              className="px-12 py-4 bg-primary text-background rounded-2xl font-black hover:scale-105 transition-transform shadow-xl shadow-primary/20"
            >
              CONTINUE →
            </button>
          </div>
        )}
      </div>
    </motion.div>
    </>
  );
}
