"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BookOpen, Users, Star, TrendingUp, Plus, Upload, Eye,
  BarChart3, Award, CheckCircle, XCircle
} from "lucide-react";
import { API_BASE_URL, api } from "@/lib/api";

const API = "/api/v1";

export default function CreatorPage() {
  const [tab, setTab] = useState<"analytics" | "my-courses">("analytics");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "General", skill_level: "Beginner", price: 0, playlist_url: "" });
  const [categories, setCategories] = useState<any[]>([]);
  const [myCourses, setMyCourses] = useState<any[]>([]);

  useEffect(() => {
    api.get(`${API}/courses/categories`).then(res => setCategories(res.data)).catch(() => {});
    api.get(`${API}/courses/creator/analytics`).then(res => {
      const data = res.data;
      setAnalytics(data);
      setMyCourses(data.courses || []);
    }).catch(() => {});
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
        setForm({ title: "", description: "", category: "General", skill_level: "Beginner", price: 0, playlist_url: "" });
        setShowCreateForm(false);
        setTab("my-courses");
      }
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to create course");
    }
    setCreating(false);
  }

  async function togglePublish(courseId: string, published: boolean) {
    try {
      await api.put(`${API}/courses/${courseId}`, { is_published: !published });
      setMyCourses(prev => prev.map(c => c.id === courseId ? { ...c, published: !published } : c));
    } catch (e) {}
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
              Managing Your Curriculum
            </h3>
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
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 block">Category</label>
                        <div className="relative">
                          <select 
                            value={form.category} 
                            onChange={e => setForm({ ...form, category: e.target.value })}
                            title="Course Category"
                            className="w-full px-5 py-4 bg-white/[0.02] border border-white/10 rounded-2xl text-white focus:outline-none focus:border-primary/50 appearance-none outline-none cursor-pointer"
                          >
                            {categories.map(c => <option key={c.id} value={c.name} className="bg-zinc-900">{c.icon} {c.name}</option>)}
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                            <TrendingUp className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 block">Complexity</label>
                        <select 
                          value={form.skill_level} 
                          onChange={e => setForm({ ...form, skill_level: e.target.value })}
                          title="Skill Level"
                          className="w-full px-5 py-4 bg-white/[0.02] border border-white/10 rounded-2xl text-white focus:outline-none focus:border-primary/50 appearance-none outline-none cursor-pointer"
                        >
                          <option className="bg-zinc-900">Beginner</option>
                          <option className="bg-zinc-900">Intermediate</option>
                          <option className="bg-zinc-900">Advanced</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 block">Price (GHS)</label>
                        <input 
                          type="number" 
                          value={form.price} 
                          onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                          title="Price in GHS"
                          className="w-full px-5 py-4 bg-white/[0.02] border border-white/10 rounded-2xl text-white focus:outline-none focus:border-primary/50 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 block">Playlist Integration</label>
                        <input value={form.playlist_url} onChange={e => setForm({ ...form, playlist_url: e.target.value })}
                          placeholder="YouTube URL"
                          className="w-full px-5 py-4 bg-white/[0.02] border border-white/10 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:border-primary/50"
                        />
                      </div>
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

          {myCourses.length === 0 ? (
            <div className="text-center py-20 bg-white/[0.01] border border-dashed border-white/10 rounded-3xl">
              <BookOpen className="w-12 h-12 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">Your course vault is empty</p>
              <button onClick={() => setShowCreateForm(true)}
                className="mt-6 px-8 py-3 bg-white/5 text-white border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-xs font-bold uppercase tracking-widest"
              >
                Create your first course
              </button>
            </div>
          ) : (
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
                    <button className="flex-1 py-3 bg-white/5 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2 border border-white/5">
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
          )}
        </motion.div>
      )}
    </div>
  );
}
