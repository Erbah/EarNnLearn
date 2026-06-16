"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Users, Star, TrendingUp, Plus, Upload, Eye,
  BarChart3, Award, CheckCircle, XCircle, HelpCircle, Trash2, Save, MessageSquare
} from "lucide-react";
import axios from "axios";
import { API_BASE_URL, api } from "@/lib/api";

const API = "/api/v1";

export default function CreatorPage() {
  const [tab, setTab] = useState<"analytics" | "my-courses">("analytics");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ 
    title: "", 
    description: "", 
    creator_name: "",
    category: "General", 
    skill_level: "Beginner", 
    price: 0, 
    playlist_url: "",
    is_free: true 
  });
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newVideo, setNewVideo] = useState({ title: "", youtube_id: "", is_preview: false, module_id: "" });
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [newQuiz, setNewQuiz] = useState({ title: "", passing_score: 70, module_id: "" });
  const [editingQuiz, setEditingQuiz] = useState<any>(null);
  const [newQuestion, setNewQuestion] = useState({ 
    question_text: "", 
    options: [
      { option_text: "", is_correct: true },
      { option_text: "", is_correct: false }
    ] 
  });

  useEffect(() => {
    const controller = new AbortController();

    api.get(`${API}/courses/categories`, { signal: controller.signal })
      .then(res => setCategories(res.data))
      .catch((err) => {
        if (axios.isCancel(err)) return;
      });

    api.get(`${API}/courses/creator/analytics`, { signal: controller.signal })
      .then(res => {
        const data = res.data;
        setAnalytics(data);
        setMyCourses(data.courses || []);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
      });

    return () => {
      controller.abort();
    };
  }, []);

  async function createCourse() {
    setCreating(true);
    try {
      const res = await api.post(`${API}/courses/create`, form);
      if (res.status === 200 || res.status === 201) {
        const course = res.data;
        setMyCourses(prev => [...prev, { 
          id: course.id, 
          title: course.title, 
          enrollments: 0, 
          rating: 0, 
          published: false,
          approval_status: "pending" 
        }]);
        setForm({ title: "", description: "", creator_name: "", category: "General", skill_level: "Beginner", price: 0, playlist_url: "", is_free: true });
        setShowCreateForm(false);
        setTab("my-courses");
      }
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to create course");
    }
    setCreating(false);
  }

  async function handleUrlBlur() {
    if (!form.playlist_url || (!form.title && !form.description && !form.creator_name)) {
      if (form.playlist_url) {
        setFetchingMetadata(true);
        try {
          const res = await api.post(`${API}/marketplace/youtube-metadata`, { url: form.playlist_url });
          setForm(prev => ({
            ...prev,
            title: prev.title || res.data.title || "",
            description: prev.description || res.data.description || "",
            creator_name: prev.creator_name || res.data.creator_name || ""
          }));
        } catch (e) {
          console.error("Failed to fetch metadata", e);
        }
        setFetchingMetadata(false);
      }
    }
  }

  async function togglePublish(courseId: string, published: boolean) {
    try {
      await api.put(`${API}/courses/${courseId}`, { is_published: !published });
      setMyCourses(prev => prev.map(c => c.id === courseId ? { ...c, published: !published } : c));
    } catch (e) {}
  }

  async function manageContent(course: any) {
    setEditingCourse(course);
    setLoadingModules(true);
    try {
      const res = await api.get(`${API}/courses/${course.id}`);
      setModules(res.data.modules || []);
      // Fetch quizzes
      const quizRes = await api.get(`/api/v1/engagement/quizzes/course/${course.id}`);
      setQuizzes(quizRes.data || []);
    } catch (e) {
      alert("Failed to load course content");
    }
    setLoadingModules(false);
  }

  async function addQuiz(moduleId: string) {
    if (!newQuiz.title) return;
    try {
      const res = await api.post(`/api/v1/engagement/quizzes`, { 
        ...newQuiz, 
        course_id: editingCourse.id, 
        module_id: moduleId 
      });
      setQuizzes([...quizzes, { ...res.data, questions: [] }]);
      setNewQuiz({ title: "", passing_score: 70, module_id: "" });
    } catch (e) {
      alert("Failed to add quiz");
    }
  }

  async function addQuestionToQuiz() {
    if (!editingQuiz || !newQuestion.question_text) return;
    try {
      const res = await api.post(`/api/v1/engagement/quizzes/${editingQuiz.id}/questions`, [newQuestion]);
      setQuizzes(prev => prev.map(q => q.id === editingQuiz.id ? res.data : q));
      setEditingQuiz(res.data);
      setNewQuestion({ 
        question_text: "", 
        options: [
          { option_text: "", is_correct: true },
          { option_text: "", is_correct: false }
        ] 
      });
    } catch (e) {
      alert("Failed to add question");
    }
  }

  async function addModule() {
    if (!newModuleTitle || !editingCourse) return;
    try {
      const res = await api.post(`${API}/courses/${editingCourse.id}/modules`, { title: newModuleTitle, position: modules.length + 1 });
      setModules([...modules, { ...res.data, videos: [] }]);
      setNewModuleTitle("");
    } catch (e) {
      alert("Failed to add module");
    }
  }

  async function addVideoToModule(moduleId: string) {
    if (!newVideo.title || !newVideo.youtube_id) return;
    try {
      const res = await api.post(`${API}/courses/modules/${moduleId}/videos`, { 
        ...newVideo, 
        position: (modules.find(m => m.id === moduleId)?.videos.length || 0) + 1 
      });
      setModules(prev => prev.map(m => m.id === moduleId ? { ...m, videos: [...m.videos, res.data] } : m));
      setNewVideo({ title: "", youtube_id: "", is_preview: false, module_id: "" });
    } catch (e) {
      alert("Failed to add video");
    }
  }

  const tabs = [
    { key: "analytics", label: "Analytics", icon: BarChart3 },
    { key: "my-courses", label: "My Courses", icon: BookOpen },
  ] as const;

  return (
    <div className="flex flex-col gap-8 pb-12 pt-4">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Creator Studio</h1>
        <p className="text-gray-400 mt-1">Publish courses, track students, and earn revenue</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${
              tab === t.key
                ? "text-primary border-primary"
                : "text-gray-500 border-transparent hover:text-gray-300"
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Analytics Tab */}
      {tab === "analytics" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {analytics ? (
            <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-4 h-full">
              {/* Main Revenue Card */}
              <motion.div 
                whileHover={{ y: -5 }}
                className="md:col-span-2 md:row-span-2 p-8 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl relative overflow-hidden flex flex-col justify-between group"
              >
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                  <TrendingUp className="w-32 h-32 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
                      <BarChart3 className="w-6 h-6 text-primary" />
                    </div>
                    <span className="text-gray-400 font-medium font-outfit uppercase tracking-widest text-xs">Total Revenue</span>
                  </div>
                  <h2 className="text-5xl font-bold text-white tracking-tighter">
                    <span className="text-primary mr-2">GHS</span>
                    {analytics.total_revenue.toLocaleString()}
                  </h2>
                </div>
                <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">Growth Rate</span>
                    <span className="text-green-400 font-bold flex items-center gap-1">+12.5% <TrendingUp className="w-3 h-3" /></span>
                  </div>
                  <div className="flex -space-x-3">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="w-10 h-10 rounded-full border-2 border-background bg-zinc-800 flex items-center justify-center text-[10px] text-gray-400 font-bold">
                        U{i}
                      </div>
                    ))}
                    <div className="w-10 h-10 rounded-full border-2 border-background bg-primary text-background flex items-center justify-center text-[10px] font-bold">
                      +{analytics.total_enrollments}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Stats Cards */}
              {[
                { label: "Course Reach", value: analytics.total_enrollments, sub: "Student enrolled", icon: Users, color: "text-blue-400", bg: "bg-blue-400/10" },
                { label: "Community Trust", value: analytics.avg_rating.toFixed(1), sub: "Avg Rating", icon: Star, color: "text-yellow-400", bg: "bg-yellow-400/10" },
                { label: "Global Impact", value: analytics.referral_growth, sub: "Network Growth", icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-400/10" },
                { label: "Efficiency", value: `${analytics.completion_rate}%`, sub: "Completion Rate", icon: Award, color: "text-emerald-400", bg: "bg-emerald-400/10" },
              ].map((stat, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -5, borderColor: "rgba(255,255,255,0.2)" }}
                  className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-md flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2 rounded-xl ${stat.bg} ${stat.color}`}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{stat.label}</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white tracking-tight">{stat.value}</p>
                    <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest">{stat.sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white/[0.02] border border-dashed border-white/10 rounded-3xl">
              <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-4 animate-pulse" />
              <p className="text-gray-500 font-outfit">Synchronizing creator analytics...</p>
            </div>
          )}
        </motion.div>
      )}

      {/* My Courses Tab */}
      {tab === "my-courses" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <BookOpen className="text-primary" size={20} />
              {editingCourse ? `Managing: ${editingCourse.title}` : "Managing Your Curriculum"}
            </h3>
            <div className="flex gap-4">
              {editingCourse && (
                <button 
                  onClick={() => setEditingCourse(null)}
                  className="px-6 py-2.5 rounded-2xl font-bold uppercase tracking-widest text-[10px] bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 transition-all"
                >
                  Back to List
                </button>
              )}
              {!editingCourse && (
                <button 
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className={`px-6 py-2.5 rounded-2xl font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all ${
                    showCreateForm 
                      ? "bg-white/5 text-gray-400 border border-white/10" 
                      : "bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30"
                  }`}
                >
                  {showCreateForm ? <XCircle size={14} /> : <Plus size={14} />}
                  {showCreateForm ? "Cancel Creation" : "Add New Course"}
                </button>
              )}
            </div>
          </div>

          {showCreateForm && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto w-full space-y-6 mb-8"
            >
              <div className="rounded-3xl bg-white/[0.03] border border-primary/20 p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Upload className="w-32 h-32 text-primary" />
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3 tracking-tighter">
                  <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  Launch New Experience
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 block">Foundational Title</label>
                      <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                        placeholder="e.g. AI Marketing Masterclass"
                        className="w-full px-5 py-4 bg-white/[0.02] border border-white/10 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 focus:bg-white/[0.04] transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 block">Core Description</label>
                      <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                        placeholder="Capture the essence of what students will achieve..."
                        rows={4}
                        className="w-full px-5 py-4 bg-white/[0.02] border border-white/10 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 focus:bg-white/[0.04] transition-all resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 block">Content Creator / Youtuber Name</label>
                      <input value={form.creator_name} onChange={e => setForm({ ...form, creator_name: e.target.value })}
                        placeholder="e.g. FreeCodeCamp, Marques Brownlee"
                        className="w-full px-5 py-4 bg-white/[0.02] border border-white/10 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 focus:bg-white/[0.04] transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-6">


                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 block">Pricing Model</label>
                        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                          <button 
                            type="button"
                            onClick={() => setForm({ ...form, is_free: true, price: 0 })}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${form.is_free ? "bg-primary text-background" : "text-gray-500 hover:text-white"}`}
                          >
                            Free
                          </button>
                          <button 
                            type="button"
                            onClick={() => setForm({ ...form, is_free: false })}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${!form.is_free ? "bg-primary text-background" : "text-gray-500 hover:text-white"}`}
                          >
                            Priced
                          </button>
                        </div>
                      </div>
                      <div className={`transition-all duration-300 ${form.is_free ? "opacity-30 pointer-events-none" : "opacity-100"}`}>
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 block">Price (GHS)</label>
                        <input 
                          type="number" 
                          value={form.price} 
                          onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                          title="Price in GHS"
                          disabled={form.is_free}
                          className="w-full px-5 py-4 bg-white/[0.02] border border-white/10 rounded-2xl text-white focus:outline-none focus:border-primary/50 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 block flex items-center gap-2">
                        Playlist Integration 
                        {fetchingMetadata && <span className="text-primary normal-case tracking-normal">Auto-populating...</span>}
                      </label>
                      <input value={form.playlist_url} 
                        onChange={e => setForm({ ...form, playlist_url: e.target.value })}
                        onBlur={handleUrlBlur}
                        placeholder="YouTube URL"
                        className="w-full px-5 py-4 bg-white/[0.02] border border-white/10 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:border-primary/50"
                      />
                    </div>

                    <motion.button 
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={createCourse} 
                      disabled={creating || !form.title}
                      className="w-full py-5 bg-gradient-to-r from-primary to-cyan-400 text-background font-black rounded-2xl shadow-[0_20px_40px_rgba(0,224,255,0.2)] hover:shadow-[0_25px_50px_rgba(0,224,255,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-widest text-xs mt-4"
                    >
                      {creating ? "Synchronizing..." : "Initiate Deployment"}
                    </motion.button>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-gray-600 text-[10px] uppercase tracking-[0.2em]">
                <Star className="w-3 h-3" />
                <span>High integrity course publishing enabled</span>
                <Star className="w-3 h-3" />
              </div>
            </motion.div>
          )}

          {!editingCourse ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {myCourses.map((c, i) => (
                <motion.div 
                  key={c.id} 
                  initial={{ opacity: 0, x: -20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -5, borderColor: "rgba(255,255,255,0.2)" }}
                  className="flex flex-col p-6 rounded-3xl bg-white/[0.03] border border-white/10 shadow-xl backdrop-blur-md group"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-black bg-primary/20 text-primary px-2 py-0.5 rounded uppercase tracking-tighter">Level {i+1}</span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">GHS {c.price || 0}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter ${
                          c.approval_status === "approved" ? "bg-green-500/20 text-green-400" :
                          c.approval_status === "rejected" ? "bg-red-500/20 text-red-400" :
                          "bg-yellow-500/20 text-yellow-400"
                        }`}>
                          {c.approval_status || "pending"}
                        </span>
                      </div>
                       <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-primary transition-colors">{c.title}</h3>
                       {c.approval_status === "rejected" && c.approval_remarks && (
                         <div className="mt-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                           <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Feedback from Admin</p>
                           <p className="text-xs text-gray-300 leading-relaxed italic">"{c.approval_remarks}"</p>
                         </div>
                       )}
                    </div>
                    <div className={`p-3 rounded-2xl ${c.published ? "bg-green-500/10 text-green-400" : "bg-zinc-800 text-gray-500"} border border-white/5`}>
                      <BookOpen className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="text-center p-3 rounded-2xl bg-white/5 border border-white/5">
                      <p className="text-xs font-bold text-white">{c.enrollments}</p>
                      <p className="text-[8px] text-gray-500 uppercase font-medium">Students</p>
                    </div>
                    <div className="text-center p-3 rounded-2xl bg-white/5 border border-white/5">
                      <p className="text-xs font-bold text-white">★ {c.rating.toFixed(1)}</p>
                      <p className="text-[8px] text-gray-500 uppercase font-medium">Rating</p>
                    </div>
                    <div className="text-center p-3 rounded-2xl bg-white/5 border border-white/5">
                      <p className="text-xs font-bold text-white">{c.revenue ? `GHS ${c.revenue}` : "GHS 0"}</p>
                      <p className="text-[8px] text-gray-500 uppercase font-medium">Earnings</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => manageContent(c)}
                      className="flex-1 py-3 bg-white/5 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2 border border-white/5"
                    >
                      <BarChart3 className="w-3.5 h-3.5" /> Manage Content
                    </button>
                    <button 
                      onClick={() => togglePublish(c.id, c.published)}
                      disabled={c.approval_status !== "approved"}
                      className={`px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                        c.published
                          ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                          : c.approval_status === "approved"
                            ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                            : "bg-gray-500/10 text-gray-500 border border-white/5 cursor-not-allowed"
                      }`}
                    >
                      {c.published ? "Unpublish" : (c.approval_status === "approved" ? "Go Live" : "Awaiting Approval")}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {/* Module Creation */}
              <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 flex items-center gap-4">
                <input 
                  value={newModuleTitle} 
                  onChange={e => setNewModuleTitle(e.target.value)}
                  placeholder="New Module Title (e.g. Introduction)"
                  className="flex-1 px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-primary/50"
                />
                <button 
                  onClick={addModule}
                  className="px-6 py-3 bg-primary text-background rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"
                >
                  Add Module
                </button>
              </div>

              {/* Modules List */}
              <div className="space-y-6">
                {modules.map((m, idx) => (
                  <div key={m.id} className="p-6 rounded-3xl bg-white/[0.03] border border-white/10">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-lg font-bold text-white flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs font-black text-primary border border-primary/20">{idx + 1}</span>
                        {m.title}
                      </h4>
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{m.videos.length} Videos</span>
                    </div>

                    <div className="space-y-3 mb-6">
                      {m.videos.map((v: any, vIdx: number) => (
                        <div key={v.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 group hover:bg-white/5 transition-all">
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-medium text-gray-600">{vIdx + 1}.</span>
                            <div>
                              <p className="text-sm font-bold text-gray-200">{v.title}</p>
                              <p className="text-[10px] text-gray-500 font-mono">{v.youtube_id}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {v.is_preview ? (
                              <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-[8px] font-black uppercase tracking-tighter border border-green-500/30">Free Preview</span>
                            ) : (
                              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[8px] font-black uppercase tracking-tighter border border-primary/20">Priced</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add Video to Module Form */}
                    <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 flex flex-wrap gap-4 items-end">
                      <div className="flex-1 min-w-[200px]">
                        <label className="text-[8px] text-gray-600 font-bold uppercase mb-1 block">Video Title</label>
                        <input 
                          value={newVideo.module_id === m.id ? newVideo.title : ""} 
                          onChange={e => setNewVideo({ ...newVideo, title: e.target.value, module_id: m.id })}
                          placeholder="Video Title"
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white"
                        />
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <label className="text-[8px] text-gray-600 font-bold uppercase mb-1 block">YouTube ID</label>
                        <input 
                          value={newVideo.module_id === m.id ? newVideo.youtube_id : ""} 
                          onChange={e => setNewVideo({ ...newVideo, youtube_id: e.target.value, module_id: m.id })}
                          placeholder="e.g. dQw4w9WgXcQ"
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white"
                        />
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <input 
                          type="checkbox" 
                          id={`free-${m.id}`}
                          checked={newVideo.module_id === m.id ? newVideo.is_preview : false}
                          onChange={e => setNewVideo({ ...newVideo, is_preview: e.target.checked, module_id: m.id })}
                          className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary focus:ring-0 cursor-pointer"
                        />
                        <label htmlFor={`free-${m.id}`} className="text-[10px] text-gray-400 font-bold uppercase tracking-widest cursor-pointer select-none">Free Preview</label>
                      </div>
                      <button 
                        onClick={() => addVideoToModule(m.id)}
                        className="px-4 py-2 bg-white/10 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-white/20 transition-all border border-white/10"
                      >
                        Add Video
                      </button>
                    </div>

                    {/* Quizzes List */}
                    <div className="mt-8 space-y-3 pt-6 border-t border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest px-1">Module Quizzes</p>
                        <span className="text-[8px] text-primary/50 font-black uppercase tracking-widest">Assessment Layer</span>
                      </div>
                      
                      {quizzes.filter(q => q.module_id === m.id).map((q, qIdx) => (
                        <div key={q.id} className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/10 group hover:bg-primary/10 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
                              <HelpCircle className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white tracking-tight">{q.title}</p>
                              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{q.questions?.length || 0} Questions • Passing: {q.passing_score}%</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => setEditingQuiz(q)}
                            className="px-4 py-2 bg-primary/20 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/30 transition-all border border-primary/20 shadow-[0_5px_15px_rgba(0,224,255,0.1)]"
                          >
                            Edit Questions
                          </button>
                        </div>
                      ))}
                      
                      {/* Add Quiz Form */}
                      <div className="p-4 rounded-2xl bg-primary/[0.02] border border-primary/10 flex flex-wrap gap-4 items-end mt-4">
                        <div className="flex-1 min-w-[200px]">
                          <label className="text-[8px] text-gray-600 font-bold uppercase mb-1 block">Quiz Title</label>
                          <input 
                            value={newQuiz.module_id === m.id ? newQuiz.title : ""} 
                            onChange={e => setNewQuiz({ ...newQuiz, title: e.target.value, module_id: m.id })}
                            placeholder="e.g. Module Proficiency Test"
                            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:border-primary/50 outline-none"
                          />
                        </div>
                        <div className="w-32">
                          <label className="text-[8px] text-gray-600 font-bold uppercase mb-1 block">Pass Score %</label>
                          <input 
                            type="number"
                            value={newQuiz.module_id === m.id ? newQuiz.passing_score : 70} 
                            onChange={e => setNewQuiz({ ...newQuiz, passing_score: parseInt(e.target.value) || 70, module_id: m.id })}
                            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:border-primary/50 outline-none"
                          />
                        </div>
                        <button 
                          onClick={() => addQuiz(m.id)}
                          className="px-6 py-2.5 bg-primary text-background rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-[0_10px_20px_rgba(0,224,255,0.2)]"
                        >
                          Add Quiz
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Question Editor Modal */}
      <AnimatePresence>
        {editingQuiz && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-4xl max-h-[90vh] bg-[#111827] border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tighter flex items-center gap-3">
                    <HelpCircle className="text-primary" />
                    Quiz Editor: {editingQuiz.title}
                  </h2>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Refining the assessment experience</p>
                </div>
                <button onClick={() => setEditingQuiz(null)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                  <XCircle className="w-8 h-8 text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
                {/* Existing Questions */}
                <div className="space-y-6">
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Current Questions ({editingQuiz.questions?.length || 0})
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    {editingQuiz.questions?.map((q: any, idx: number) => (
                      <div key={q.id} className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 relative group">
                        <span className="absolute top-6 right-8 text-primary/20 font-black text-4xl group-hover:text-primary/40 transition-colors">{idx + 1}</span>
                        <p className="text-white font-bold mb-4 pr-12">{q.question_text}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {q.options?.map((o: any) => (
                            <div key={o.id} className={`p-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest border ${o.is_correct ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-white/5 border-white/5 text-gray-500"}`}>
                              {o.option_text}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add New Question Form */}
                <div className="p-8 rounded-[2rem] bg-primary/[0.03] border border-primary/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Plus className="w-24 h-24 text-primary" />
                  </div>
                  <h3 className="text-lg font-black text-white mb-8 flex items-center gap-3 tracking-tight">
                    <div className="p-2 rounded-xl bg-primary/20 border border-primary/30">
                      <Plus className="w-5 h-5 text-primary" />
                    </div>
                    Inject New Knowledge Check
                  </h3>

                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 block">Question Prompt</label>
                      <textarea 
                        value={newQuestion.question_text}
                        onChange={e => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
                        placeholder="What is the primary objective of..."
                        className="w-full px-5 py-4 bg-white/[0.05] border border-white/10 rounded-2xl text-white focus:border-primary/50 outline-none resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {newQuestion.options.map((opt, oIdx) => (
                        <div key={oIdx} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Option {String.fromCharCode(65 + oIdx)}</label>
                            <button 
                              onClick={() => {
                                const next = [...newQuestion.options];
                                next.forEach((o, i) => o.is_correct = (i === oIdx));
                                setNewQuestion({ ...newQuestion, options: next });
                              }}
                              className={`text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full border transition-all ${opt.is_correct ? "bg-green-500 text-background border-green-500" : "text-gray-500 border-white/10 hover:text-white"}`}
                            >
                              {opt.is_correct ? "Correct Choice" : "Mark as Correct"}
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <input 
                              value={opt.option_text}
                              onChange={e => {
                                const next = [...newQuestion.options];
                                next[oIdx].option_text = e.target.value;
                                setNewQuestion({ ...newQuestion, options: next });
                              }}
                              placeholder={`Option ${oIdx + 1}`}
                              className="flex-1 px-4 py-3 bg-white/[0.02] border border-white/10 rounded-xl text-sm text-white focus:border-primary/50 outline-none"
                            />
                            {newQuestion.options.length > 2 && (
                              <button 
                                onClick={() => setNewQuestion({ ...newQuestion, options: newQuestion.options.filter((_, i) => i !== oIdx) })}
                                className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-4 mt-8">
                      <button 
                        onClick={() => setNewQuestion({ ...newQuestion, options: [...newQuestion.options, { option_text: "", is_correct: false }] })}
                        className="px-6 py-4 bg-white/5 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all border border-white/10"
                      >
                        Add Option
                      </button>
                      <button 
                        onClick={addQuestionToQuiz}
                        disabled={!newQuestion.question_text || newQuestion.options.some(o => !o.option_text)}
                        className="flex-1 py-4 bg-primary text-background rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-[0_15px_30px_rgba(0,224,255,0.3)] disabled:opacity-30"
                      >
                        Commit Question to Quiz
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
