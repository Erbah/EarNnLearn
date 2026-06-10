"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import YouTube, { YouTubeEvent, YouTubePlayer } from "react-youtube";
import {
  ArrowLeft, PlayCircle, CheckCircle, Lock, Zap, BookOpen,
  ChevronDown, ChevronRight, Award, AlertTriangle, Sparkles,
  HelpCircle, MessageSquare, Send, FileText, CheckSquare, XCircle, User
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import axios from "axios";
import { API_BASE_URL, api } from "@/lib/api";

const API = `${API_BASE_URL}/api/v1`;

interface VideoItem { id: string; title: string; youtube_id: string; duration: number; }
interface ModuleItem { id: string; title: string; position: number; videos: VideoItem[]; quizzes: any[]; }

export default function LearnPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const courseId = params.id as string;
  const targetVideoId = searchParams.get("v");
  const targetTab = searchParams.get("tab");
  const targetQuizId = searchParams.get("quiz");

  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<any>(null);
  
  // Anti-Cheat State
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const [watchResult, setWatchResult] = useState<any>(null);
  const [maxTimeState, setMaxTimeState] = useState(0); // For trigger re-render if needed, though not currently used in UI
  const maxTimeRef = useRef(0);
  const playerRef = useRef<YouTubePlayer>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // AI Tutor State
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiChat, setAiChat] = useState<{q: string, a: string}[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // XP Animation
  const [showXpPop, setShowXpPop] = useState(false);

  // Engagement State
  const [activeTab, setActiveTab] = useState<"ai-tutor" | "qa" | "quizzes">("ai-tutor");
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [courseQuizzes, setCourseQuizzes] = useState<any[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<any>(null);
  const [newQuestionTitle, setNewQuestionTitle] = useState("");
  const [newQuestionContent, setNewQuestionContent] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");

  const headers: any = { "Content-Type": "application/json" };

  // Find the exact video object logic
  const getAllVideos = useCallback((mods: ModuleItem[]) => {
    let all: VideoItem[] = [];
    mods.forEach(m => all = [...all, ...m.videos]);
    return all;
  }, []);

  const refreshStatus = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await api.get(`${API}/learn/status/${courseId}`, { signal });
      setPaymentStatus(res.data);
      if (res.data.watched_video_ids) {
        setWatchedIds(new Set(res.data.watched_video_ids));
      }
    } catch (err: any) {
      if (axios.isCancel(err)) return;
    }
  }, [courseId]);

  useEffect(() => {
    if (!courseId) return;
    const controller = new AbortController();

    api.get(`${API}/courses/${courseId}`, { signal: controller.signal })
      .then(res => {
        const data = res.data;
        setCourse(data.course);
        setModules(data.modules || []);
        
        // Auto-select first un-watched or first overall
        if (data.modules?.length > 0) {
          const all = getAllVideos(data.modules);
          const target = targetVideoId ? all.find(v => v.id === targetVideoId) : null;
          const firstVid = target || all[0];
          
          setActiveVideo(firstVid);
          setMaxTimeState(0);
          
          // Expand the module containing the active video
          const parentMod = data.modules.find((m: any) => m.videos.some((v: any) => v.id === firstVid.id));
          if (parentMod) setExpandedModule(parentMod.id);
        }

        // Deep link to tab
        if (targetTab === "quizzes") {
          setActiveTab("quizzes");
        } else if (targetTab === "qa") {
          setActiveTab("qa");
        }
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
      });
    
    // Fetch Engagement Data
    api.get(`/api/v1/engagement/quizzes/course/${courseId}`, { signal: controller.signal }).then(res => {
      setCourseQuizzes(res.data);
      // Auto-open quiz if deep linked
      if (targetQuizId && res.data) {
        const q = res.data.find((qz: any) => qz.id === targetQuizId);
        if (q) setActiveQuiz(q);
      }
    }).catch((err) => {
      if (axios.isCancel(err)) return;
    });
    api.get(`/api/v1/engagement/discussions/course/${courseId}`, { signal: controller.signal }).then(res => setDiscussions(res.data)).catch((err) => {
      if (axios.isCancel(err)) return;
    });
    
    refreshStatus(controller.signal);

    return () => {
      controller.abort();
    };
  }, [courseId, targetVideoId, targetTab, targetQuizId, getAllVideos, refreshStatus]);

  async function postQuestion() {
    if (!newQuestionTitle || !newQuestionContent) return;
    try {
      const res = await api.post(`/api/v1/engagement/discussions`, {
        course_id: courseId,
        video_id: activeVideo?.id,
        title: newQuestionTitle,
        content: newQuestionContent
      });
      setDiscussions([res.data, ...discussions]);
      setNewQuestionTitle("");
      setNewQuestionContent("");
    } catch (e) {
      alert("Failed to post question");
    }
  }

  async function postReply(discussionId: string) {
    if (!replyContent) return;
    try {
      const res = await api.post(`/api/v1/engagement/discussions/${discussionId}/replies`, {
        content: replyContent
      });
      setDiscussions(prev => prev.map(d => d.id === discussionId ? { ...d, replies: [...(d.replies || []), res.data] } : d));
      setReplyContent("");
      setReplyingTo(null);
    } catch (e) {
      alert("Failed to post reply");
    }
  }

  async function submitQuiz() {
    if (!activeQuiz) return;
    setSubmittingQuiz(true);
    try {
      const answersList = Object.entries(quizAnswers).map(([q_id, o_id]) => ({
        question_id: q_id,
        option_id: o_id
      }));
      const res = await api.post(`/api/v1/engagement/quizzes/${activeQuiz.id}/submit`, {
        answers: answersList
      });
      setQuizResult(res.data);
    } catch (e) {
      alert("Failed to submit quiz");
    }
    setSubmittingQuiz(false);
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
    if (currentTime > maxTimeRef.current + 2 && !watchedIds.has(activeVideo.id)) {
      playerRef.current.seekTo(maxTimeRef.current);
      return; // Rewind and quit
    }
    
    // Update max time securely
    if (currentTime > maxTimeRef.current) {
      maxTimeRef.current = currentTime;
      setMaxTimeState(currentTime);
    }

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
    const all = getAllVideos(modules);
    const idx = all.findIndex(v => v.id === video.id);
    
    if (idx > 0) {
      const prev = all[idx - 1];
      if (!watchedIds.has(prev.id)) {
        alert("Please complete the previous video first.");
        return;
      }
    }

    setActiveVideo(video);
    maxTimeRef.current = 0;
    setMaxTimeState(0);
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

  const allVids = getAllVideos(modules);
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
                      autoplay: 1, 
                      controls: 1, 
                      modestbranding: 1, 
                      rel: 0, 
                      disablekb: 0,
                      fs: 1, 
                      iv_load_policy: 3,
                      origin: typeof window !== 'undefined' ? window.location.origin : undefined
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

          {/* Engagement Tabs */}
          <div className="rounded-[2rem] bg-white/[0.02] border border-white/10 mt-8 overflow-hidden glass shadow-2xl">
            <div className="flex bg-white/[0.03] border-b border-white/10 p-2">
              {[
                { id: "ai-tutor", label: "AI Tutor", icon: Sparkles },
                { id: "qa", label: "Q&A", icon: MessageSquare },
                { id: "quizzes", label: "Quizzes", icon: HelpCircle },
              ].map(t => (
                <button 
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === t.id 
                      ? "bg-primary text-background shadow-[0_5px_15px_rgba(0,224,255,0.3)]" 
                      : "text-gray-500 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <t.icon size={14} />
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-8 min-h-[300px]">
              {/* AI Tutor Tab */}
              {activeTab === "ai-tutor" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black text-white tracking-tighter">AI Learning Assistant</h3>
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">On-demand cognitive support</p>
                    </div>
                    <Sparkles className="text-primary w-8 h-8 opacity-20" />
                  </div>

                  {aiChat.length > 0 ? (
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {aiChat.map((msg, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                              <User size={14} className="text-gray-400" />
                            </div>
                            <p className="text-sm text-gray-300 bg-white/5 p-4 rounded-3xl rounded-tl-none leading-relaxed italic">"{msg.q}"</p>
                          </div>
                          <div className="flex items-start gap-3 justify-end">
                            <p className="text-sm text-white bg-primary/10 p-4 rounded-3xl rounded-tr-none border border-primary/20 leading-relaxed shadow-[0_5px_15px_rgba(0,224,255,0.05)]">{msg.a}</p>
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30">
                              <Sparkles size={14} className="text-primary" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center bg-white/[0.01] rounded-3xl border border-dashed border-white/10">
                      <Sparkles className="w-12 h-12 text-gray-600 mx-auto mb-4 animate-pulse" />
                      <p className="text-gray-500 text-sm italic">Ask anything about the current lesson...</p>
                    </div>
                  )}

                  <div className="flex gap-3 bg-white/5 p-2 rounded-2xl border border-white/10">
                    <input 
                      type="text" 
                      value={aiQuestion}
                      onChange={(e) => setAiQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && askAI()}
                      placeholder="e.g. Explain the math at 05:20..." 
                      className="flex-1 bg-transparent border-none focus:ring-0 px-4 text-sm text-white outline-none"
                    />
                    <button 
                      onClick={askAI}
                      disabled={isAiLoading || !aiQuestion.trim()}
                      className="p-3 bg-primary text-background rounded-xl transition-all hover:scale-105 disabled:opacity-30 shadow-lg"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Q&A Tab */}
              {activeTab === "qa" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black text-white tracking-tighter">Course Discussion</h3>
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Connect with the community</p>
                    </div>
                    <button 
                      onClick={() => setReplyingTo(replyingTo === "new" ? null : "new")}
                      className="px-6 py-2.5 bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all border border-white/10"
                    >
                      Ask Question
                    </button>
                  </div>

                  {replyingTo === "new" && (
                    <div className="p-6 rounded-3xl bg-primary/5 border border-primary/20 space-y-4">
                      <input 
                        value={newQuestionTitle}
                        onChange={e => setNewQuestionTitle(e.target.value)}
                        placeholder="Question Title (e.g. Confused about ROI)"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none"
                      />
                      <textarea 
                        value={newQuestionContent}
                        onChange={e => setNewQuestionContent(e.target.value)}
                        placeholder="Detailed explanation..."
                        rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none resize-none"
                      />
                      <div className="flex justify-end gap-3">
                        <button onClick={() => setReplyingTo(null)} className="text-xs text-gray-500 font-bold uppercase">Cancel</button>
                        <button onClick={postQuestion} className="px-5 py-2 bg-primary text-background rounded-lg text-[10px] font-black uppercase shadow-lg">Post Question</button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {discussions.length > 0 ? discussions.map(d => (
                      <div key={d.id} className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                              <User size={18} className="text-gray-400" />
                            </div>
                            <div>
                              <h4 className="text-white font-bold tracking-tight">{d.title}</h4>
                              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{d.user_rid} • {new Date(d.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">{d.content}</p>
                        
                        {/* Replies */}
                        {d.replies?.map((r: any) => (
                          <div key={r.id} className={`ml-8 p-4 rounded-2xl ${r.is_instructor_reply ? "bg-primary/5 border border-primary/10" : "bg-white/5 border border-white/5"}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] font-black uppercase tracking-tighter text-primary">{r.user_rid}</span>
                              {r.is_instructor_reply && <span className="text-[8px] bg-primary text-background px-2 py-0.5 rounded-full font-black uppercase">Instructor</span>}
                            </div>
                            <p className="text-xs text-gray-300">{r.content}</p>
                          </div>
                        ))}

                        <div className="pt-2">
                          {replyingTo === d.id ? (
                            <div className="flex gap-2">
                              <input 
                                value={replyContent}
                                onChange={e => setReplyContent(e.target.value)}
                                placeholder="Add a reply..."
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none"
                              />
                              <button onClick={() => postReply(d.id)} className="p-2 bg-primary text-background rounded-xl"><Send size={14} /></button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setReplyingTo(d.id)}
                              className="text-[10px] text-primary font-bold uppercase tracking-widest flex items-center gap-2 hover:opacity-70 transition-opacity"
                            >
                              <MessageSquare size={12} /> Reply
                            </button>
                          )}
                        </div>
                      </div>
                    )) : (
                      <div className="py-12 text-center">
                        <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4 opacity-20" />
                        <p className="text-gray-500 text-sm">No discussions yet. Be the first to ask!</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Quizzes Tab */}
              {activeTab === "quizzes" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black text-white tracking-tighter">Knowledge Checks</h3>
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Validate your progress</p>
                    </div>
                    <HelpCircle className="text-primary w-8 h-8 opacity-20" />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {courseQuizzes.length > 0 ? courseQuizzes.map(q => (
                      <div key={q.id} className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-between group hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-all">
                            <FileText className="text-primary w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-white font-bold tracking-tight">{q.title}</h4>
                            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{q.questions?.length || 0} Questions • Pass: {q.passing_score}%</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setActiveQuiz(q)}
                          className="px-6 py-3 bg-primary/20 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary text-background transition-all border border-primary/30 shadow-[0_5px_15px_rgba(0,224,255,0.1)]"
                        >
                          Start Quiz
                        </button>
                      </div>
                    )) : (
                      <div className="py-12 text-center bg-white/[0.01] rounded-3xl border border-dashed border-white/10">
                        <HelpCircle className="w-12 h-12 text-gray-600 mx-auto mb-4 opacity-20" />
                        <p className="text-gray-500 text-sm">No quizzes available for this course yet.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
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
      {/* Quiz Player Modal */}
      <AnimatePresence>
        {activeQuiz && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-2xl bg-[#111827] border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
            >
              {!quizResult ? (
                <>
                  <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                    <div>
                      <h2 className="text-2xl font-black text-white tracking-tighter">{activeQuiz.title}</h2>
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Passing Score: {activeQuiz.passing_score}%</p>
                    </div>
                    <button onClick={() => setActiveQuiz(null)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                      <XCircle className="w-8 h-8 text-gray-500" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    {activeQuiz.questions?.map((q: any, idx: number) => (
                      <div key={q.id} className="space-y-4">
                        <div className="flex gap-4">
                          <span className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-black shrink-0">{idx + 1}</span>
                          <p className="text-white font-bold leading-relaxed">{q.question_text}</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 ml-12">
                          {q.options?.map((o: any) => (
                            <button 
                              key={o.id}
                              onClick={() => setQuizAnswers({ ...quizAnswers, [q.id]: o.id })}
                              className={`p-4 rounded-2xl text-left text-xs font-bold uppercase tracking-widest border transition-all ${
                                quizAnswers[q.id] === o.id 
                                  ? "bg-primary text-background border-primary shadow-[0_5px_15px_rgba(0,224,255,0.3)]" 
                                  : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                              }`}
                            >
                              {o.option_text}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-8 border-t border-white/10 bg-white/[0.02]">
                    <button 
                      onClick={submitQuiz}
                      disabled={submittingQuiz || Object.keys(quizAnswers).length < (activeQuiz.questions?.length || 0)}
                      className="w-full py-5 bg-primary text-background rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-[0_20px_40px_rgba(0,224,255,0.3)] hover:scale-[1.02] transition-all disabled:opacity-30"
                    >
                      {submittingQuiz ? "Evaluating..." : "Submit Assessment"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-12 text-center space-y-8">
                  <div className="flex justify-center">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center border-4 ${quizResult.passed ? "bg-green-500/10 border-green-500 text-green-500" : "bg-red-500/10 border-red-500 text-red-500"}`}>
                      {quizResult.passed ? <CheckCircle size={48} /> : <XCircle size={48} />}
                    </div>
                  </div>
                  <div>
                    <h2 className={`text-4xl font-black tracking-tighter ${quizResult.passed ? "text-green-500" : "text-red-500"}`}>
                      {quizResult.passed ? "Assessment Passed!" : "Assessment Failed"}
                    </h2>
                    <p className="text-gray-400 mt-2 font-bold uppercase tracking-widest">
                      Your Score: {Math.round((quizResult.score / quizResult.total_points) * 100)}%
                    </p>
                  </div>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
                    {quizResult.passed 
                      ? "Congratulations! You have demonstrated mastery of this module's core concepts." 
                      : "Don't worry. Review the lessons and try again to improve your score."}
                  </p>
                  <button 
                    onClick={() => {
                      setActiveQuiz(null);
                      setQuizResult(null);
                      setQuizAnswers({});
                    }}
                    className="w-full py-4 bg-white/10 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white/20 transition-all"
                  >
                    Close Result
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
