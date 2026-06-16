"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { 
  CheckCircle, XCircle, BrainCircuit, Loader2, BookOpen, 
  Tag, DollarSign, Clock, AlertTriangle, PlayCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const API = "/api/v1";

interface PendingCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  approval_status: string;
  created_at: string;
}

export default function AdminContentDashboard() {
  const [courses, setCourses] = useState<PendingCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Rejection Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [courseToReject, setCourseToReject] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // AI Review State
  const [aiReviewData, setAiReviewData] = useState<{ [key: string]: any }>({});
  const [aiReviewLoading, setAiReviewLoading] = useState<string | null>(null);

  const fetchPendingCourses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`${API}/admin/courses/pending`);
      setCourses(res.data);
    } catch (e) {
      console.error("Failed to fetch pending courses:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingCourses();
  }, [fetchPendingCourses]);

  const handleApprove = async (courseId: string) => {
    try {
      setActionLoading(courseId);
      await api.post(`${API}/admin/courses/${courseId}/approve`);
      setCourses(prev => prev.filter(c => c.id !== courseId));
    } catch (e) {
      console.error("Failed to approve course:", e);
      alert("Failed to approve course.");
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectModal = (courseId: string) => {
    setCourseToReject(courseId);
    setRejectReason("");
    setRejectModalOpen(true);
  };

  const handleRejectSubmit = async () => {
    if (!courseToReject || !rejectReason.trim()) return;
    try {
      setActionLoading(courseToReject);
      setRejectModalOpen(false);
      await api.post(`${API}/admin/courses/${courseToReject}/reject`, {
        reason: rejectReason
      });
      setCourses(prev => prev.filter(c => c.id !== courseToReject));
    } catch (e) {
      console.error("Failed to reject course:", e);
      alert("Failed to reject course.");
    } finally {
      setActionLoading(null);
      setCourseToReject(null);
    }
  };

  const handleAIReview = async (courseId: string) => {
    try {
      setAiReviewLoading(courseId);
      const res = await api.post(`${API}/admin/courses/${courseId}/ai-review`);
      setAiReviewData(prev => ({ ...prev, [courseId]: res.data }));
    } catch (e) {
      console.error("AI Review failed:", e);
      alert("AI Review failed to process.");
    } finally {
      setAiReviewLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Content Management</h1>
        <p className="text-gray-400 mt-1">Review and approve newly submitted courses.</p>
      </div>

      {courses.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <BookOpen className="w-16 h-16 text-gray-500 mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-bold text-white mb-2">No Pending Courses</h2>
          <p className="text-gray-400">All creator submissions have been reviewed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {courses.map(course => (
            <motion.div 
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden flex flex-col md:flex-row relative"
            >
              <div className="p-6 md:w-2/3 border-b md:border-b-0 md:border-r border-white/10">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">{course.title}</h3>
                    <div className="flex flex-wrap gap-3 text-xs font-semibold">
                      <span className="bg-primary/20 text-primary px-3 py-1 rounded-full flex items-center gap-1">
                        <Tag className="w-3 h-3" /> {course.category || "Uncategorized"}
                      </span>
                      <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> {course.price} GHS
                      </span>
                      <span className="bg-white/10 text-gray-300 px-3 py-1 rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(course.created_at))} ago
                      </span>
                    </div>
                  </div>
                </div>
                
                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                  {course.description || "No description provided."}
                </p>

                {/* AI Review Section */}
                <div className="bg-black/50 rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-widest">
                      <BrainCircuit className="w-4 h-4" /> AI Tutor Assessment
                    </div>
                    {!aiReviewData[course.id] && (
                      <button 
                        onClick={() => handleAIReview(course.id)}
                        disabled={aiReviewLoading === course.id}
                        className="text-xs bg-primary/20 hover:bg-primary/30 text-primary px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        {aiReviewLoading === course.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlayCircle className="w-3 h-3" />}
                        Run Review
                      </button>
                    )}
                  </div>
                  
                  {aiReviewData[course.id] ? (
                    <div className="mt-4 text-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-white">Quality Score:</span>
                        <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                          aiReviewData[course.id].score > 80 ? 'bg-emerald-500/20 text-emerald-400' : 
                          aiReviewData[course.id].score > 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {aiReviewData[course.id].score}/100
                        </span>
                      </div>
                      <p className="text-gray-300 mb-2"><span className="text-gray-500">Feedback:</span> {aiReviewData[course.id].advice}</p>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-xs italic">
                      Run the AI review to get automated feedback on course content, pricing, and category alignment.
                    </p>
                  )}
                </div>
              </div>

              <div className="p-6 md:w-1/3 bg-white/5 flex flex-col justify-center gap-4">
                <button
                  onClick={() => handleApprove(course.id)}
                  disabled={actionLoading === course.id}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading === course.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                  Approve Course
                </button>
                <button
                  onClick={() => openRejectModal(course.id)}
                  disabled={actionLoading === course.id}
                  className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <XCircle className="w-5 h-5" />
                  Reject Course
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Rejection Modal */}
      <AnimatePresence>
        {rejectModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl relative"
            >
              <div className="flex items-center gap-3 text-red-400 mb-4">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-xl font-bold text-white">Reject Course</h3>
              </div>
              
              <p className="text-gray-400 text-sm mb-6">
                Please provide a reason for rejecting this course. The creator will receive this feedback.
              </p>

              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Course description is too short, or content violates guidelines..."
                className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-red-500/50 min-h-[120px] mb-6 resize-none"
              />

              <div className="flex gap-4">
                <button 
                  onClick={() => setRejectModalOpen(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleRejectSubmit}
                  disabled={!rejectReason.trim()}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  Confirm Reject
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
