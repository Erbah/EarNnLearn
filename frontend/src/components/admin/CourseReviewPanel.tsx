'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, ExternalLink, Zap, Sparkles } from 'lucide-react';
import { API_BASE_URL, api } from '@/lib/api';
import axios from 'axios';

const API = `${API_BASE_URL}/api/v1/admin`;

interface CourseReviewCardProps {
  course: any;
  isReviewing: boolean;
  aiReview: any;
  onAIReview: (id: string) => void;
  onAction: (id: string, action: 'approve' | 'reject') => void;
}

const CourseReviewCard = React.memo(function CourseReviewCard({
  course,
  isReviewing,
  aiReview,
  onAIReview,
  onAction,
}: CourseReviewCardProps) {
  const handleAIReviewClick = useCallback(() => {
    onAIReview(course.id);
  }, [course.id, onAIReview]);

  const handleApproveClick = useCallback(() => {
    onAction(course.id, 'approve');
  }, [course.id, onAction]);

  const handleRejectClick = useCallback(() => {
    onAction(course.id, 'reject');
  }, [course.id, onAction]);

  const aiProgressStyle = React.useMemo(() => {
    return aiReview ? { width: `${aiReview.health_score}%` } : { width: '0%' };
  }, [aiReview]);

  const descriptionSlice = React.useMemo(() => {
    return course.description?.slice(0, 150) + '...';
  }, [course.description]);

  return (
    <div className="bg-card/70 border border-white/10 rounded-3xl p-6 space-y-4 hover:border-primary/30 transition-all group">
      <div>
        <span className="text-[10px] font-black bg-primary/20 text-primary px-2 py-0.5 rounded uppercase tracking-tighter mb-2 inline-block">{course.category}</span>
        <h4 className="text-xl font-bold text-white group-hover:text-primary transition-colors">{course.title}</h4>
        <p className="text-xs text-gray-500 mt-1">By Creator: <span className="font-mono text-primary/70">{course.creator_rid}</span></p>
      </div>

      <div className="bg-white/5 rounded-2xl p-4 text-xs text-gray-400 leading-relaxed border border-white/5">
        {descriptionSlice}
      </div>

      <div className="flex items-center justify-between py-2 border-y border-white/5">
        <span className="text-[10px] font-bold text-gray-500 uppercase">Price: GHS {course.price}</span>
        <a href={course.playlist_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary font-bold text-[10px] uppercase hover:underline">
          <ExternalLink size={12} /> Review Content
        </a>
      </div>

      {/* AI Insight Section */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 relative overflow-hidden">
        {!aiReview ? (
          <button 
            onClick={handleAIReviewClick}
            disabled={isReviewing}
            className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-primary flex items-center justify-center gap-2 hover:bg-primary/10 transition-all rounded-lg"
          >
            {isReviewing ? (
              <span className="flex items-center gap-2 animate-pulse">
                <Zap className="w-3 h-3 animate-spin" /> Deep Scanning...
              </span>
            ) : (
              <>
                <Sparkles className="w-3 h-3" /> Get AI Specialist Review
              </>
            )}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-primary flex items-center gap-1 italic">
                <Zap className="w-3 h-3" /> AI Recommendation: {aiReview.recommendation}
              </span>
              <div className="h-1.5 w-16 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${aiReview.health_score > 70 ? 'bg-emerald-500' : 'bg-orange-500'}`} 
                  style={aiProgressStyle} 
                />
              </div>
            </div>
            <ul className="space-y-1">
              {aiReview.suggestions?.map((s: string, idx: number) => (
                <li key={idx} className="text-[10px] text-gray-400 flex items-start gap-1.5 leading-tight">
                  <span className="mt-1 w-1 h-1 rounded-full bg-primary/40 shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={handleApproveClick} className="flex-1 py-3 bg-emerald-500 text-white font-bold rounded-xl text-[11px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/10">
          Approve Course
        </button>
        <button onClick={handleRejectClick} className="flex-1 py-3 bg-red-500/10 text-red-500 border border-red-500/20 font-bold rounded-xl text-[11px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
          Reject
        </button>
      </div>
    </div>
  );
});

export const CourseReviewPanel = React.memo(function CourseReviewPanel() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiReviews, setAiReviews] = useState<Record<string, any>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const loadPending = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    api.get(`${API}/courses/pending`, { signal })
      .then(res => setCourses(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        if (axios.isCancel(err)) return;
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadPending(controller.signal);
    return () => controller.abort();
  }, [loadPending]);

  const handleAIReview = useCallback(async (id: string) => {
    setReviewingId(id);
    try {
      const res = await api.post(`${API}/courses/${id}/ai-review`);
      setAiReviews(prev => ({ ...prev, [id]: res.data }));
    } catch (e) {
      alert("AI Scan failed");
    }
    setReviewingId(null);
  }, []);

  const handleAction = useCallback(async (id: string, action: 'approve' | 'reject') => {
    const reason = action === 'reject' ? prompt("Rejection Reason:") : null;
    if (action === 'reject' && !reason) return;

    try {
      await api.post(`${API}/courses/${id}/${action}`, action === 'reject' ? { reason } : {});
      alert(`Course ${action}d successfully`);
      loadPending();
    } catch (e) {}
  }, [loadPending]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <CheckCircle2 className="text-primary" size={20} />
        Course Review Queue
      </h3>

      {loading ? (
        <div className="p-10 text-center text-gray-500">Scanning for submissions...</div>
      ) : courses.length === 0 ? (
        <div className="p-10 text-center text-gray-500 border border-dashed border-white/10 rounded-2xl italic">No courses awaiting review</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {courses.map(c => (
            <CourseReviewCard
              key={c.id}
              course={c}
              isReviewing={reviewingId === c.id}
              aiReview={aiReviews[c.id]}
              onAIReview={handleAIReview}
              onAction={handleAction}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default CourseReviewPanel;
