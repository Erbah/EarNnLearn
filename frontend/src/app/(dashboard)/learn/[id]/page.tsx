"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import YouTube, { YouTubeEvent, YouTubePlayer } from "react-youtube";
import {
  ArrowLeft, PlayCircle, CheckCircle, Lock, Zap, BookOpen,
  ChevronDown, ChevronRight, Award, AlertTriangle, Sparkles
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { API_BASE_URL, api } from "@/lib/api";

const API = `${API_BASE_URL}/api/v1`;

interface VideoItem { id: string; title: string; youtube_id: string; duration: number; }
interface ModuleItem { id: string; title: string; position: number; videos: VideoItem[]; quizzes: any[]; }

export default function LearnPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<any>(null);
  
  // Anti-Cheat State
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const [watchResult, setWatchResult] = useState<any>(null);
  const [maxTime, setMaxTime] = useState(0); 
  const playerRef = useRef<YouTubePlayer>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // AI Tutor State
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiChat, setAiChat] = useState<{q: string, a: string}[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // XP Animation
  const [showXpPop, setShowXpPop] = useState(false);

  const headers: any = { "Content-Type": "application/json" };

  // Find the exact video object logic
  const getAllVideos = (mods: ModuleItem[] = modules) => {
    let all: VideoItem[] = [];
    mods.forEach(m => all = [...all, ...m.videos]);
    return all;
  };

  useEffect(() => {
    if (!courseId) return;
    api.get(`${API}/courses/${courseId}`)
      .then(res => {
        const data = res.data;
        setCourse(data.course);
        setModules(data.modules || []);
        
        // Auto-select first un-watched or first overall
        if (data.modules?.length > 0) {
          const firstVid = data.modules[0].videos[0];
          setActiveVideo(firstVid);
          setMaxTime(0);
          setExpandedModule(data.modules[0].id);
        }
      });
    refreshStatus();
  }, [courseId]);

  async function refreshStatus() {
    try {
      const res = await api.get(`${API}/learn/status/${courseId}`);
      setPaymentStatus(res.data);
    } catch {}
  }

  // Handle YouTube Player Events
  const onPlayerReady = (event: YouTubeEvent) => {
    playerRef.current = event.target;
    // Force specific playback rates to prevent 2x speed cheating
    event.target.setPlaybackRate(1);
  };

  const onStateChange = (event: YouTubeEvent) => {
    // 1 (playing)
    if (event.data === 1) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(checkTimeAndProgress, 1000);
    } 
    // 2 (paused), 0 (ended)
    else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  // The core anti-cheat monitor loop (runs 1x per second)
  const checkTimeAndProgress = async () => {
    if (!playerRef.current || !activeVideo) return;
    
    const currentTime = await playerRef.current.getCurrentTime();
    
    // 1. Anti-Skip: if they jumped more than 2 seconds ahead of maxTime
    if (currentTime > maxTime + 2 && !watchedIds.has(activeVideo.id)) {
      playerRef.current.seekTo(maxTime);
      return; // Rewind and quit
    }
    
    // Update max time securely
    if (currentTime > maxTime) setMaxTime(currentTime);

    // 2. Tab out / focus checks
    if (document.hidden) {
      playerRef.current.pauseVideo();
    }

    // 3. Save progress back to server periodically (every 15s)
    if (Math.floor(currentTime) % 15 === 0) {
      syncProgress(activeVideo.id, currentTime, activeVideo.duration);
    }
  };

  // Sync to Backend
  async function syncProgress(videoId: string, watchTime: number, duration: number) {
    const resp = await api.post(`${API}/learn/watch/${courseId}`, {
      video_id: videoId,
      duration,
      watch_time: Math.floor(watchTime)
    });

    if (resp.status === 200) {
      const data = resp.data;
      
      if (data.status === "completed") {
        setWatchResult(data);
        setWatchedIds(prev => new Set(prev).add(videoId));
        
        // Trigger XP Animation
        setShowXpPop(true);
        setTimeout(() => setShowXpPop(false), 3000);
        
        refreshStatus();
        setTimeout(() => setWatchResult(null), 4000);
      }
    } else if (resp.status === 403) {
      playerRef.current?.pauseVideo();
      setWatchResult({ status: "paused", message: "Course paused — earn more to continue" });
    }
  }

  // Select video manually
  function selectVideo(video: VideoItem) {
    if (activeVideo?.id === video.id) return;
    
    // Sequential enforce frontend-side too
    const all = getAllVideos();
    const idx = all.findIndex(v => v.id === video.id);
    
    if (idx > 0) {
      const prev = all[idx - 1];
      if (!watchedIds.has(prev.id)) {
        alert("Please complete the previous video first.");
        return;
      }
    }

    setActiveVideo(video);
    setMaxTime(0);
  }

  async function requestCertificate() {
    const res = await api.post(`${API}/courses/${courseId}/certificate`);
    if (res.status === 200) {
      const data = res.data;
      alert(`🎓 Certificate issued: ${data.certificate_code}`);
    }
  }

  async function askAI() {
    if (!aiQuestion.trim() || !activeVideo || isAiLoading) return;
    setIsAiLoading(true);
    
    try {
      const res = await api.post(`${API}/ai/ask`, {
        video_id: activeVideo.id,
        question: aiQuestion
      });
      
      if (res.status === 200) {
        const data = res.data;
        setAiChat(prev => [...prev, { q: aiQuestion, a: data.answer }]);
        setAiQuestion("");
      } else {
        const err = res.data;
        alert(err.detail || "AI billing failed. Check your wallet.");
      }
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      let errMsg = "AI Assistant unavailable.";
      if (Array.isArray(detail)) {
        errMsg = detail.map((d: any) => d.msg || JSON.stringify(d)).join("; ");
      } else if (typeof detail === 'string') {
        errMsg = detail;
      } else if (detail) {
        errMsg = JSON.stringify(detail);
      }
      alert(errMsg);
    } finally {
      setIsAiLoading(false);
    }
  }

  const allVids = getAllVideos();
  const totalVideos = allVids.length;
  const progressPct = totalVideos > 0 ? Math.round((watchedIds.size / totalVideos) * 100) : 0;
  const isPaused = paymentStatus?.status === "paused";

  if (!course) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0 pb-12 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push(`/courses/${courseId}`)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {course.title}
        </button>
        {progressPct === 100 && (
          <button onClick={requestCertificate}
            className="px-5 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-background font-bold rounded-xl hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all text-sm flex items-center gap-2"
          >
            <Award className="w-4 h-4" /> Get Certificate
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Video Player & AI Panel */}
        <div className="lg:col-span-3 space-y-6">
          {activeVideo ? (
            <motion.div key={activeVideo.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl relative glass"
            >
              {isPaused && (
                <div className="absolute inset-0 bg-black/80 z-10 flex flex-col items-center justify-center p-6 text-center">
                  <Lock className="w-12 h-12 text-red-500 mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Platform Paused</h3>
                  <p className="text-gray-400 max-w-sm">
                    You have reached the unpaid threshold for this course. Please use the Wallet to view your earnings or pay for continued access.
                  </p>
                </div>
              )}

              {paymentStatus?.status === "expired" && (
                <div className="absolute inset-0 bg-black/80 z-10 flex flex-col items-center justify-center p-6 text-center">
                  <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Season Access Expired</h3>
                  <p className="text-gray-400 max-w-sm">
                    This enrollment has expired after 2 active seasons. Please re-enroll from the marketplace to continue learning.
                  </p>
                  <button onClick={() => router.push(`/courses/${courseId}`)}
                    className="mt-6 px-6 py-2 bg-amber-500 text-background font-bold rounded-xl"
                  >
                    Go to Marketplace
                  </button>
                </div>
              )}
              
              <div className="relative aspect-video pointer-events-auto">
                {/* 
                  Security params: 
                  controls=0 hides standard UI so they can't skip easily
                  modestbranding=1 
                  rel=0
                  disablekb=1
                */}
                <YouTube
                  videoId={activeVideo.youtube_id}
                  opts={{
                    width: "100%",
                    height: "100%",
                    playerVars: {
                      autoplay: 1, controls: 1, modestbranding: 1, rel: 0, disablekb: 1,
                      fs: 0, iv_load_policy: 3
                    }
                  }}
                  onReady={onPlayerReady}
                  onStateChange={onStateChange}
                  className="absolute inset-0 w-full h-full"
                  iframeClassName="w-full h-full"
                />

                {/* XP Pop-up Animation */}
                <AnimatePresence>
                  {showXpPop && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.5, y: -50 }}
                      className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
                    >
                      <div className="bg-primary/90 text-background px-8 py-4 rounded-full font-black text-3xl shadow-[0_0_50px_rgba(0,224,255,0.6)] backdrop-blur-md flex items-center gap-4">
                        <Sparkles className="w-10 h-10" />
                        <span>+50 XP</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="p-4 bg-[#111827] flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">{activeVideo.title}</h2>
                <div className="px-3 py-1 bg-white/10 rounded text-xs text-gray-300 font-mono">
                  Protected Player
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="aspect-video rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <PlayCircle className="w-16 h-16 text-gray-600" />
            </div>
          )}

          {/* PPC Notification */}
          {watchResult && watchResult.deduction > 0 && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-3 p-4 rounded-xl bg-gradient-to-r from-primary/20 to-cyan-500/10 border border-primary/30 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm text-gray-200 font-medium">Lesson Completed!</p>
                  <p className="text-xs text-gray-400">
                    <span className="text-primary font-bold">-{watchResult.deduction} GHS</span> deducted from earnings
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Remaining Balance</p>
                <p className="text-sm font-bold text-white">{watchResult.remaining} GHS</p>
              </div>
            </motion.div>
          )}

          {/* AI Tutor Placeholder */}
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 mt-6 glass">
            <h3 className="text-white font-semibold flex items-center gap-2 mb-3">
              🤖 AI Learning Assistant
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Ask questions about this lesson, request a summary, or generate a quick quiz. (AI Tokens apply)
            </p>
            
            {aiChat.length > 0 && (
              <div className="mb-4 space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {aiChat.map((msg, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-[10px] text-primary/70 font-bold uppercase">Question</p>
                    <p className="text-xs text-gray-300 bg-white/5 p-2 rounded-lg italic">"{msg.q}"</p>
                    <p className="text-[10px] text-cyan-400/70 font-bold uppercase mt-2">AI Answer</p>
                    <p className="text-xs text-white bg-primary/10 p-2 rounded-lg border-l-2 border-primary">{msg.a}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input 
                type="text" 
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && askAI()}
                placeholder="Explain the concept shown at 2:30..." 
                aria-label="Ask AI Tutor"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-primary/50 outline-none"
              />
              <button 
                onClick={askAI}
                disabled={isAiLoading || !aiQuestion.trim()}
                aria-label={isAiLoading ? "Asking AI..." : "Send question to AI"}
                className="px-5 py-2 bg-primary text-background font-bold rounded-xl text-sm disabled:opacity-50 transition-opacity"
              >
                {isAiLoading ? "..." : "Ask"}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar — Modules */}
        <div className="lg:col-span-1 space-y-4">
          {/* Progress */}
          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Progress</span>
              <span className="text-sm text-primary font-bold">{progressPct}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">{watchedIds.size}/{totalVideos} videos</p>
          </div>

          {/* Module List */}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {modules.map(mod => (
              <div key={mod.id} className="rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden">
                <button onClick={() => setExpandedModule(expandedModule === mod.id ? null : mod.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors text-left"
                >
                  <span className="text-white text-sm font-medium truncate">{mod.title}</span>
                  {expandedModule === mod.id ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                </button>
                
                {expandedModule === mod.id && (
                  <div className="border-t border-white/5">
                    {mod.videos.map(vid => {
                      const isActive = activeVideo?.id === vid.id;
                      const isWatched = watchedIds.has(vid.id);
                      
                      // Check if locked
                      const idx = allVids.findIndex(v => v.id === vid.id);
                      const prevWatched = idx === 0 || watchedIds.has(allVids[idx - 1].id);
                      const isLocked = !prevWatched && !isWatched;

                      return (
                        <button key={vid.id}
                          onClick={() => !isPaused && !isLocked && selectVideo(vid)}
                          disabled={isPaused || (isLocked && !isActive)}
                          className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors border-b border-white/5 last:border-0 ${
                            isActive ? "bg-primary/10 text-primary border-l-2 border-l-primary" :
                            isLocked ? "opacity-50 cursor-not-allowed" :
                            "hover:bg-white/5 text-gray-400 border-l-2 border-l-transparent"
                          }`}
                        >
                          {isWatched ? (
                            <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                          ) : isLocked ? (
                            <Lock className="w-4 h-4 text-gray-500 shrink-0" />
                          ) : isActive ? (
                            <PlayCircle className="w-4 h-4 text-primary shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-gray-500 shrink-0 flex items-center justify-center">
                              <PlayCircle className="w-2.5 h-2.5 text-gray-500 opacity-0" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate font-medium">{vid.title}</p>
                            <p className="text-[10px] opacity-70 mt-0.5 font-mono">
                              {Math.floor(vid.duration / 60)}:{(vid.duration % 60).toString().padStart(2, '0')}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
