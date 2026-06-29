"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import YouTube, { YouTubeEvent, YouTubePlayer } from "react-youtube";
import {
  ArrowLeft, PlayCircle, CheckCircle, Lock, Zap, BookOpen,
  ChevronDown, ChevronRight, Award, AlertTriangle, Sparkles,
  HelpCircle, MessageSquare, Send, FileText, CheckSquare, XCircle, User, Headphones
} from "lucide-react";
import axios from "axios";
import { API_BASE_URL, api } from "@/lib/api";

const API = `${API_BASE_URL}/api/v1`;

interface VideoItem { id: string; title: string; youtube_id: string; duration: number; }
interface ModuleItem { id: string; title: string; position: number; videos: VideoItem[]; quizzes: any[]; }

const extractYouTubeID = (urlOrId: string) => {
  if (!urlOrId) return "";
  const trimmed = urlOrId.trim();
  if (trimmed.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/(?:v=|\/embed\/|\/v\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return (match && match[1]) ? match[1] : trimmed;
};

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
  
  // Audio-Only Mode
  const [audioOnly, setAudioOnly] = useState(false);

  // Anti-Cheat State
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const [watchResult, setWatchResult] = useState<any>(null);
  const [maxTimeState, setMaxTimeState] = useState(0); 
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
        
        if (data.modules?.length > 0) {
          const all = getAllVideos(data.modules);
          const target = targetVideoId ? all.find(v => v.id === targetVideoId) : null;
          const firstVid = target || all[0];
          
          setActiveVideo(firstVid);
          setMaxTimeState(0);
          
          const parentMod = data.modules.find((m: any) => m.videos.some((v: any) => v.id === firstVid.id));
          if (parentMod) setExpandedModule(parentMod.id);
        }

        if (targetTab === "quizzes") setActiveTab("quizzes");
        else if (targetTab === "qa") setActiveTab("qa");
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
      });
    
    api.get(`/api/v1/engagement/quizzes/course/${courseId}`, { signal: controller.signal }).then(res => {
      setCourseQuizzes(res.data);
      if (targetQuizId && res.data) {
        const q = res.data.find((qz: any) => qz.id === targetQuizId);
        if (q) setActiveQuiz(q);
      }
    }).catch((err) => { if (axios.isCancel(err)) return; });
    
    api.get(`/api/v1/engagement/discussions/course/${courseId}`, { signal: controller.signal })
      .then(res => setDiscussions(res.data))
      .catch((err) => { if (axios.isCancel(err)) return; });
    
    refreshStatus(controller.signal);

    return () => controller.abort();
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
    } catch (e) { alert("Failed to post question"); }
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
    } catch (e) { alert("Failed to post reply"); }
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
    } catch (e) { alert("Failed to submit quiz"); }
    setSubmittingQuiz(false);
  }

  const onPlayerReady = (event: YouTubeEvent) => {
    playerRef.current = event.target;
    event.target.setPlaybackRate(1);
  };

  const onStateChange = (event: YouTubeEvent) => {
    if (event.data === 1) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(checkTimeAndProgress, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  const checkTimeAndProgress = async () => {
    if (!playerRef.current || !activeVideo) return;
    
    const currentTime = await playerRef.current.getCurrentTime();
    if (currentTime > maxTimeRef.current + 2 && !watchedIds.has(activeVideo.id)) {
      playerRef.current.seekTo(maxTimeRef.current);
      return; 
    }
    
    if (currentTime > maxTimeRef.current) {
      maxTimeRef.current = currentTime;
      setMaxTimeState(currentTime);
    }

    if (document.hidden) playerRef.current.pauseVideo();

    if (Math.floor(currentTime) % 15 === 0) {
      syncProgress(activeVideo.id, currentTime, activeVideo.duration);
    }
  };

  async function syncProgress(videoId: string, watchTime: number, duration: number) {
    try {
      const resp = await api.post(`${API}/learn/watch/${courseId}`, {
        video_id: videoId, duration, watch_time: Math.floor(watchTime)
      });
      if (resp.status === 200 && resp.data.status === "completed") {
        setWatchResult(resp.data);
        setWatchedIds(prev => new Set(prev).add(videoId));
        setShowXpPop(true);
        setTimeout(() => setShowXpPop(false), 3000);
        refreshStatus();
        setTimeout(() => setWatchResult(null), 4000);
      }
    } catch (err: any) {
      if (err.response && err.response.status === 403) {
        playerRef.current?.pauseVideo();
        setWatchResult({ status: "paused", message: err.response.data?.detail || "Course paused — earn more to continue" });
      }
    }
  }

  function selectVideo(video: VideoItem) {
    if (activeVideo?.id === video.id) return;
    const all = getAllVideos(modules);
    const idx = all.findIndex(v => v.id === video.id);
    
    if (idx > 0) {
      const prev = all[idx - 1];
      if (!watchedIds.has(prev.id)) {
        alert("Please complete the previous video first.");
        return;
      }
    }

    // Stop active quiz if any
    setActiveQuiz(null);
    setQuizResult(null);

    setActiveVideo(video);
    maxTimeRef.current = 0;
    setMaxTimeState(0);
  }

  async function requestCertificate() {
    try {
      const res = await api.post(`${API}/courses/${courseId}/certificate`);
      if (res.status === 200) alert(`🎓 Certificate issued: ${res.data.certificate_code}`);
    } catch (err: any) { alert(err.response?.data?.detail || "Failed to issue certificate"); }
  }

  async function askAI() {
    if (!aiQuestion.trim() || !activeVideo || isAiLoading) return;
    setIsAiLoading(true);
    try {
      const res = await api.post(`${API}/ai/ask`, { video_id: activeVideo.id, question: aiQuestion });
      if (res.status === 200) {
        setAiChat(prev => [...prev, { q: aiQuestion, a: res.data.answer }]);
        setAiQuestion("");
      } else {
        alert(res.data.detail || "AI billing failed. Check your wallet.");
      }
    } catch (e: any) {
      let errMsg = "AI Assistant unavailable.";
      const detail = e.response?.data?.detail;
      if (Array.isArray(detail)) errMsg = detail.map((d: any) => d.msg || JSON.stringify(d)).join("; ");
      else if (typeof detail === 'string') errMsg = detail;
      else if (detail) errMsg = JSON.stringify(detail);
      alert(errMsg);
    } finally { setIsAiLoading(false); }
  }

  const allVids = getAllVideos(modules);
  const totalVideos = allVids.length;
  const progressPct = totalVideos > 0 ? Math.round((watchedIds.size / totalVideos) * 100) : 0;
  const isPaused = paymentStatus?.status === "paused";

  if (!course) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0 pb-12 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push(`/courses/${courseId}`)}
          className="flex items-center gap-2 text-gray-400 hover:text-[#d4af37] transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> {course.title}
        </button>
        {progressPct === 100 && (
          <button onClick={requestCertificate}
            className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-amber-500 text-[#111827] font-bold rounded-lg shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all text-sm flex items-center gap-2 uppercase tracking-wide"
          >
            <Award className="w-4 h-4" /> Get Certificate
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Active Quiz Area (Replaces Video) */}
          {activeQuiz ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#111827] border border-[#d4af37]/30 rounded-2xl shadow-[0_8px_30px_rgba(212,175,55,0.1)] overflow-hidden">
              {!quizResult ? (
                <>
                  <div className="p-8 border-b border-white/10 flex items-center justify-between bg-[#d4af37]/5">
                    <div>
                      <h2 className="text-3xl font-bold text-white" style={{ fontFamily: "Georgia, serif" }}>{activeQuiz.title}</h2>
                      <p className="text-sm text-[#d4af37] font-semibold tracking-wider uppercase mt-2">Passing Score: {activeQuiz.passing_score}%</p>
                    </div>
                    <button onClick={() => setActiveQuiz(null)} className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white">
                      <XCircle className="w-8 h-8" />
                    </button>
                  </div>

                  <div className="p-8 space-y-10 custom-scrollbar max-h-[60vh] overflow-y-auto">
                    {activeQuiz.questions?.map((q: any, idx: number) => (
                      <div key={q.id} className="space-y-5">
                        <div className="flex gap-4">
                          <span className="w-8 h-8 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/50 text-[#d4af37] flex items-center justify-center text-sm font-bold shrink-0">{idx + 1}</span>
                          <p className="text-white font-medium text-lg leading-relaxed">{q.question_text}</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 ml-12">
                          {q.options?.map((o: any) => (
                            <button 
                              key={o.id}
                              onClick={() => setQuizAnswers({ ...quizAnswers, [q.id]: o.id })}
                              className={`p-4 rounded-xl text-left text-sm font-medium transition-all ${
                                quizAnswers[q.id] === o.id 
                                  ? "bg-[#d4af37] text-[#111827] border border-[#d4af37] shadow-lg" 
                                  : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-[#d4af37]/50"
                              }`}
                            >
                              {o.option_text}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-8 border-t border-white/10 bg-[#d4af37]/5">
                    <button 
                      onClick={submitQuiz}
                      disabled={submittingQuiz || Object.keys(quizAnswers).length < (activeQuiz.questions?.length || 0)}
                      className="w-full py-4 bg-[#d4af37] text-[#111827] rounded-xl font-bold uppercase tracking-widest text-sm shadow-[0_10px_30px_rgba(212,175,55,0.3)] hover:scale-[1.01] transition-all disabled:opacity-30 disabled:hover:scale-100"
                    >
                      {submittingQuiz ? "Evaluating Assessment..." : "Submit Assessment"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-16 text-center space-y-8 bg-[#1a2332]">
                  <div className="flex justify-center">
                    <div className={`w-28 h-28 rounded-full flex items-center justify-center border-4 ${quizResult.passed ? "bg-green-500/10 border-green-500 text-green-500" : "bg-red-500/10 border-red-500 text-red-500"}`}>
                      {quizResult.passed ? <CheckCircle size={56} /> : <XCircle size={56} />}
                    </div>
                  </div>
                  <div>
                    <h2 className={`text-4xl font-bold ${quizResult.passed ? "text-green-500" : "text-red-500"}`} style={{ fontFamily: "Georgia, serif" }}>
                      {quizResult.passed ? "Assessment Passed" : "Assessment Failed"}
                    </h2>
                    <p className="text-white mt-4 font-bold text-xl">
                      Score: <span className={quizResult.passed ? "text-green-500" : "text-red-500"}>{Math.round((quizResult.score / quizResult.total_points) * 100)}%</span>
                    </p>
                  </div>
                  <p className="text-lg text-gray-400 max-w-lg mx-auto">
                    {quizResult.passed 
                      ? "Congratulations. You have demonstrated mastery of this module's core concepts." 
                      : "Review the preceding lectures and attempt the assessment again."}
                  </p>
                  <button 
                    onClick={() => {
                      setActiveQuiz(null);
                      setQuizResult(null);
                      setQuizAnswers({});
                    }}
                    className="mt-6 px-8 py-3 bg-white/10 text-white border border-white/20 rounded-lg font-bold uppercase tracking-wider text-sm hover:bg-white/20 transition-all"
                  >
                    Return to Course
                  </button>
                </div>
              )}
            </motion.div>
          ) : activeVideo ? (
            /* Video Player Area */
            <motion.div key={activeVideo.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl relative"
            >
              {isPaused && (
                <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center p-6 text-center">
                  <Lock className="w-12 h-12 text-red-500 mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "Georgia, serif" }}>Platform Access Paused</h3>
                  <p className="text-gray-400 max-w-sm">
                    You have reached the unpaid threshold for this course. Please use the Wallet to view your earnings or pay for continued access.
                  </p>
                </div>
              )}

              {paymentStatus?.status === "expired" && (
                <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center p-6 text-center">
                  <AlertTriangle className="w-12 h-12 text-[#d4af37] mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "Georgia, serif" }}>Season Access Expired</h3>
                  <p className="text-gray-400 max-w-sm">
                    This enrollment has expired after 2 active seasons. Please re-enroll from the marketplace to continue learning.
                  </p>
                  <button onClick={() => router.push(`/courses/${courseId}`)}
                    className="mt-6 px-6 py-2 bg-[#d4af37] text-[#111827] font-bold rounded-lg"
                  >
                    Go to Marketplace
                  </button>
                </div>
              )}
              
              <div className="relative aspect-video pointer-events-auto bg-[#1a2332]">
                {/* The iframe is always present so audio plays, but visually hidden if audioOnly is true */}
                <div className={`absolute inset-0 w-full h-full ${audioOnly ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                  <YouTube
                    videoId={extractYouTubeID(activeVideo.youtube_id)}
                    opts={{
                      width: "100%", height: "100%",
                      playerVars: {
                        autoplay: 1, controls: 1, modestbranding: 1, rel: 0, disablekb: 0, fs: 1, iv_load_policy: 3,
                        origin: typeof window !== 'undefined' ? window.location.origin : undefined
                      }
                    }}
                    onReady={onPlayerReady}
                    onStateChange={onStateChange}
                    className="w-full h-full"
                    iframeClassName="w-full h-full"
                  />
                </div>

                {/* Audio-Only Overlay */}
                {audioOnly && (
                  <div className="absolute inset-0 bg-[#0f172a] flex flex-col items-center justify-center border border-[#d4af37]/20 z-10">
                    <div className="w-32 h-32 rounded-full bg-[#1e293b] flex items-center justify-center border-4 border-[#d4af37]/30 shadow-[0_0_50px_rgba(212,175,55,0.15)] mb-6 relative">
                       <Headphones className="w-12 h-12 text-[#d4af37]" />
                       {/* Simulate waveform */}
                       <div className="absolute inset-0 rounded-full border border-[#d4af37]/20 animate-ping" style={{ animationDuration: '3s' }} />
                    </div>
                    <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "Georgia, serif" }}>{activeVideo.title}</h2>
                    <p className="text-[#d4af37] font-medium tracking-widest uppercase text-sm mt-2">Audio-Only Mode Active</p>
                  </div>
                )}

                <AnimatePresence>
                  {showXpPop && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.5, y: -50 }}
                      className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
                    >
                      <div className="bg-[#d4af37] text-[#111827] px-8 py-4 rounded-full font-black text-3xl shadow-[0_0_50px_rgba(212,175,55,0.6)] flex items-center gap-4 border-2 border-white/50">
                        <Award className="w-10 h-10" />
                        <span>Lesson Complete</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="p-5 bg-[#111827] flex justify-between items-center border-t border-white/5">
                <h2 className="text-xl font-bold text-white" style={{ fontFamily: "Georgia, serif" }}>{activeVideo.title}</h2>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setAudioOnly(!audioOnly)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-semibold transition-colors ${audioOnly ? 'bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30' : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'}`}
                  >
                    <Headphones className="w-4 h-4" />
                    {audioOnly ? "Audio Only" : "Video Mode"}
                  </button>
                  <div className="px-3 py-1 bg-white/5 rounded text-xs text-gray-400 font-medium tracking-wider uppercase">
                    Secured Player
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="aspect-video rounded-2xl bg-[#111827] border border-white/10 flex items-center justify-center">
              <PlayCircle className="w-16 h-16 text-gray-600" />
            </div>
          )}

          {/* Engagement Tabs */}
          {!activeQuiz && (
            <div className="rounded-2xl bg-[#111827] border border-white/10 mt-8 overflow-hidden shadow-xl">
              <div className="flex bg-[#1a2332] border-b border-white/10 p-1">
                {[
                  { id: "ai-tutor", label: "AI Tutor", icon: Sparkles },
                  { id: "qa", label: "Discussions", icon: MessageSquare },
                  { id: "quizzes", label: "Assessments", icon: BookOpen },
                ].map(t => (
                  <button 
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                      activeTab === t.id 
                        ? "bg-[#d4af37]/10 text-[#d4af37] border-b-2 border-[#d4af37]" 
                        : "text-gray-500 hover:text-gray-300 border-b-2 border-transparent"
                    }`}
                  >
                    <t.icon size={16} />
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
                        <h3 className="text-2xl font-bold text-white" style={{ fontFamily: "Georgia, serif" }}>AI Learning Assistant</h3>
                        <p className="text-sm text-gray-400 mt-1">Get immediate clarification on the current lesson.</p>
                      </div>
                      <Sparkles className="text-[#d4af37] w-8 h-8 opacity-40" />
                    </div>

                    {aiChat.length > 0 ? (
                      <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {aiChat.map((msg, i) => (
                          <div key={i} className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                                <User size={14} className="text-gray-400" />
                              </div>
                              <p className="text-base text-gray-200 bg-[#1a2332] p-4 rounded-xl rounded-tl-none leading-relaxed border border-white/5">{msg.q}</p>
                            </div>
                            <div className="flex items-start gap-3 justify-end">
                              <p className="text-base text-white bg-[#d4af37]/10 p-4 rounded-xl rounded-tr-none border border-[#d4af37]/20 leading-relaxed shadow-sm">{msg.a}</p>
                              <div className="w-8 h-8 rounded-full bg-[#d4af37]/20 flex items-center justify-center shrink-0 border border-[#d4af37]/30">
                                <Sparkles size={14} className="text-[#d4af37]" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center bg-white/[0.01] rounded-2xl border border-dashed border-white/10">
                        <Sparkles className="w-12 h-12 text-gray-600 mx-auto mb-4 animate-pulse" />
                        <p className="text-gray-400 text-sm">Ask any question related to this lecture...</p>
                      </div>
                    )}

                    <div className="flex gap-3 bg-[#1a2332] p-2 rounded-xl border border-white/10">
                      <input 
                        type="text" 
                        value={aiQuestion}
                        onChange={(e) => setAiQuestion(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && askAI()}
                        placeholder="Type your question here..." 
                        className="flex-1 bg-transparent border-none focus:ring-0 px-4 text-sm text-white outline-none"
                      />
                      <button 
                        onClick={askAI}
                        disabled={isAiLoading || !aiQuestion.trim()}
                        className="px-6 py-2 bg-[#d4af37] text-[#111827] rounded-lg font-bold transition-all disabled:opacity-30"
                      >
                        Ask
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Discussions Tab */}
                {activeTab === "qa" && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-bold text-white" style={{ fontFamily: "Georgia, serif" }}>Course Discussions</h3>
                        <p className="text-sm text-gray-400 mt-1">Engage with fellow students and faculty.</p>
                      </div>
                      <button 
                        onClick={() => setReplyingTo(replyingTo === "new" ? null : "new")}
                        className="px-6 py-2 bg-white/10 text-white rounded-lg text-sm font-semibold hover:bg-white/20 transition-all border border-white/10"
                      >
                        New Topic
                      </button>
                    </div>

                    {replyingTo === "new" && (
                      <div className="p-6 rounded-2xl bg-[#1a2332] border border-[#d4af37]/30 space-y-4">
                        <input 
                          value={newQuestionTitle}
                          onChange={e => setNewQuestionTitle(e.target.value)}
                          placeholder="Topic Subject"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-[#d4af37]/50 outline-none"
                        />
                        <textarea 
                          value={newQuestionContent}
                          onChange={e => setNewQuestionContent(e.target.value)}
                          placeholder="Detail your question or thought..."
                          rows={4}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-[#d4af37]/50 outline-none resize-none"
                        />
                        <div className="flex justify-end gap-3">
                          <button onClick={() => setReplyingTo(null)} className="text-sm text-gray-400 font-medium hover:text-white">Cancel</button>
                          <button onClick={postQuestion} className="px-6 py-2 bg-[#d4af37] text-[#111827] rounded-lg text-sm font-bold shadow-md">Post Topic</button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                      {discussions.length > 0 ? discussions.map(d => (
                        <div key={d.id} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                                <User size={18} className="text-gray-400" />
                              </div>
                              <div>
                                <h4 className="text-white font-bold">{d.title}</h4>
                                <p className="text-xs text-[#d4af37] font-medium tracking-wide mt-1">{d.user_rid} • {new Date(d.created_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-gray-300 leading-relaxed">{d.content}</p>
                          
                          {d.replies?.map((r: any) => (
                            <div key={r.id} className={`ml-8 p-4 rounded-xl border ${r.is_instructor_reply ? "bg-[#d4af37]/5 border-[#d4af37]/20" : "bg-white/5 border-white/5"}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-bold text-[#d4af37]">{r.user_rid}</span>
                                {r.is_instructor_reply && <span className="text-[10px] bg-[#d4af37] text-[#111827] px-2 py-0.5 rounded uppercase font-bold tracking-wider">Faculty</span>}
                              </div>
                              <p className="text-sm text-gray-200">{r.content}</p>
                            </div>
                          ))}

                          <div className="pt-2">
                            {replyingTo === d.id ? (
                              <div className="flex gap-2">
                                <input 
                                  value={replyContent}
                                  onChange={e => setReplyContent(e.target.value)}
                                  placeholder="Type your reply..."
                                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-[#d4af37]/50"
                                />
                                <button onClick={() => postReply(d.id)} className="px-4 bg-[#d4af37] text-[#111827] rounded-lg font-bold text-sm">Reply</button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setReplyingTo(d.id)}
                                className="text-xs text-gray-400 hover:text-white font-medium flex items-center gap-2 transition-colors"
                              >
                                <MessageSquare size={14} /> Reply to this
                              </button>
                            )}
                          </div>
                        </div>
                      )) : (
                        <div className="py-12 text-center">
                          <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4 opacity-30" />
                          <p className="text-gray-400 text-sm">No discussions yet. Start a new topic!</p>
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
                        <h3 className="text-2xl font-bold text-white" style={{ fontFamily: "Georgia, serif" }}>Assessments</h3>
                        <p className="text-sm text-gray-400 mt-1">Test your mastery of the material.</p>
                      </div>
                      <BookOpen className="text-[#d4af37] w-8 h-8 opacity-40" />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {courseQuizzes.length > 0 ? courseQuizzes.map(q => (
                        <div key={q.id} className="p-6 rounded-2xl bg-[#1a2332] border border-white/10 flex items-center justify-between group hover:border-[#d4af37]/40 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-[#d4af37]/10 group-hover:border-[#d4af37]/30 transition-all">
                              <FileText className="text-gray-400 group-hover:text-[#d4af37] w-6 h-6 transition-colors" />
                            </div>
                            <div>
                              <h4 className="text-white font-bold text-lg" style={{ fontFamily: "Georgia, serif" }}>{q.title}</h4>
                              <p className="text-xs text-gray-400 font-medium tracking-wide mt-1">
                                {q.questions?.length || 0} Questions &bull; Pass: {q.passing_score}%
                              </p>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              setActiveVideo(null); // Pause video & swap view
                              setActiveQuiz(q);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="px-6 py-2.5 bg-white/5 text-white rounded-lg text-sm font-bold hover:bg-[#d4af37] hover:text-[#111827] transition-all border border-white/10 shadow-sm"
                          >
                            Begin
                          </button>
                        </div>
                      )) : (
                        <div className="py-12 text-center bg-white/[0.01] rounded-2xl border border-dashed border-white/10">
                          <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4 opacity-30" />
                          <p className="text-gray-400 text-sm">No assessments available for this course.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar — Syllabus */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4" style={{ fontFamily: "Georgia, serif" }}>Syllabus</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">Progress</span>
                <span className="text-xs text-[#d4af37] font-bold">{progressPct}%</span>
              </div>
              <div className="w-full bg-[#1a2332] rounded-full h-1.5 overflow-hidden">
                <div 
                  className="h-full bg-[#d4af37]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">{watchedIds.size} of {totalVideos} completed</p>
            </div>

            <div className="w-full h-px bg-white/5 my-6" />

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {modules.map(mod => (
                <div key={mod.id} className="rounded-xl border border-white/5 overflow-hidden bg-[#1a2332]">
                  <button onClick={() => setExpandedModule(expandedModule === mod.id ? null : mod.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
                  >
                    <span className="text-white text-sm font-bold" style={{ fontFamily: "Georgia, serif" }}>{mod.title}</span>
                    {expandedModule === mod.id ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                  </button>
                  
                  {expandedModule === mod.id && (
                    <div className="border-t border-white/5 bg-[#111827]">
                      {mod.videos.map(vid => {
                        const isActive = activeVideo?.id === vid.id;
                        const isWatched = watchedIds.has(vid.id);
                        const idx = allVids.findIndex(v => v.id === vid.id);
                        const prevWatched = idx === 0 || watchedIds.has(allVids[idx - 1].id);
                        const isLocked = !prevWatched && !isWatched;

                        return (
                          <button key={vid.id}
                            onClick={() => !isPaused && !isLocked && selectVideo(vid)}
                            disabled={isPaused || (isLocked && !isActive)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-2 ${
                              isActive ? "bg-[#d4af37]/10 text-white border-l-[#d4af37]" :
                              isLocked ? "opacity-40 cursor-not-allowed border-l-transparent" :
                              "hover:bg-white/5 text-gray-400 border-l-transparent hover:border-l-white/20"
                            }`}
                          >
                            {isWatched ? (
                              <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                            ) : isLocked ? (
                              <Lock className="w-4 h-4 text-gray-500 shrink-0" />
                            ) : isActive ? (
                              <PlayCircle className="w-4 h-4 text-[#d4af37] shrink-0" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-gray-600 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs truncate ${isActive ? "font-bold text-[#d4af37]" : "font-medium"}`}>{vid.title}</p>
                              <p className="text-[10px] opacity-70 mt-1 font-mono">
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
    </div>
  );
}
