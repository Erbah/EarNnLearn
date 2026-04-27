"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Star, Users, BookOpen, PlayCircle, ChevronDown, ChevronRight,
  Award, Clock, Zap, ArrowLeft, CheckCircle, Lock, ArrowUpRight
} from "lucide-react";

import { API_BASE_URL, api } from "@/lib/api";

const API = `${API_BASE_URL}/api/v1`;


interface VideoItem { id: string; title: string; youtube_id: string; duration: number; }
interface ModuleItem { id: string; title: string; position: number; videos: VideoItem[]; quizzes: any[]; }
interface ReviewItem { rating: number; text: string; user: string; date: string; }

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [feasibility, setFeasibility] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    api.get(`${API}/courses/${id}`)
      .then(res => {
        const data = res.data;
        setCourse(data.course);
        setModules(Array.isArray(data.modules) ? data.modules : []);
        setReviews(Array.isArray(data.reviews) ? data.reviews : []);
        if (Array.isArray(data.modules) && data.modules.length > 0) setExpandedModule(data.modules[0].id);
      })
      .catch(() => {
        setModules([]);
        setReviews([]);
      });
    // Check if already enrolled
    api.get(`${API}/learn/status/${id}`)
      .then(res => setPaymentStatus(res.data))
      .catch(() => {});
  }, [id]);

  async function checkFeasibility() {
    try {
      const res = await api.get(`${API}/learn/feasibility/${id}`);
      setFeasibility(res.data);
      setShowPaymentModal(true);
    } catch (e: any) {
      if (e.response?.status === 401) alert("Please login first");
      else alert("Failed to check feasibility");
    }
  }

  async function enroll(method: string) {
    setEnrolling(true);
    try {
      const res = await api.post(`${API}/learn/enroll/${id}`, { payment_method: method });
      setPaymentStatus({ enrolled: true, ...res.data });
      setShowPaymentModal(false);
    } catch (e: any) {
      alert(e.response?.data?.detail || "Enrollment failed");
    }
    setEnrolling(false);
  }

  async function handleDirectCheckout() {
    setEnrolling(true);
    try {
      const res = await api.post(`${API}/learn/checkout/${id}`);
      if (res.data.authorization_url) {
        window.location.href = res.data.authorization_url;
      } else {
        alert("Failed to initialize direct checkout");
      }
    } catch (e: any) {
      alert(e.response?.data?.detail || "Checkout failed");
    }
    setEnrolling(false);
  }

  const totalVideos = modules.reduce((s, m) => s + m.videos.length, 0);
  const isEnrolled = paymentStatus?.enrolled;

  if (!course) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12 pt-4 max-w-5xl">
      {/* Back */}
      <button onClick={() => router.push("/courses")} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to courses
      </button>

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary/15 via-blue-600/10 to-purple-600/10 border border-white/10 p-8"
      >
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/15 blur-[80px] rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs bg-white/10 px-3 py-1 rounded-full text-gray-300">{course.category}</span>
            <span className="text-xs bg-white/10 px-3 py-1 rounded-full text-gray-300">{course.skill_level}</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">{course.title}</h1>
          {course.description && <p className="text-gray-400 max-w-2xl mb-6">{course.description}</p>}

          <div className="flex items-center gap-6 mb-6">
            <span className="flex items-center gap-1.5 text-yellow-400">
              <Star className="w-5 h-5 fill-yellow-400" /> {course.avg_rating.toFixed(1)}
            </span>
            <span className="flex items-center gap-1.5 text-gray-400">
              <Users className="w-5 h-5" /> {course.enrollment_count} enrolled
            </span>
            <span className="flex items-center gap-1.5 text-gray-400">
              <PlayCircle className="w-5 h-5" /> {totalVideos} videos
            </span>
            <span className="flex items-center gap-1.5 text-gray-400">
              <BookOpen className="w-5 h-5" /> {modules.length} modules
            </span>
          </div>

          <div className="flex items-center gap-4">
            {isEnrolled ? (
              <button onClick={() => router.push(`/learn/${id}`)}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all flex items-center gap-2"
              >
                <PlayCircle className="w-5 h-5" /> Continue Learning
              </button>
            ) : (
              <button onClick={course.price > 0 ? checkFeasibility : () => enroll("upfront")}
                className="px-6 py-3 bg-gradient-to-r from-primary to-cyan-400 text-background font-bold rounded-xl hover:shadow-[0_0_20px_rgba(0,224,255,0.4)] transition-all flex items-center gap-2"
              >
                <Zap className="w-5 h-5" />
                {course.price > 0 ? `Enroll — ${course.price} GHS` : "Enroll Free"}
              </button>
            )}
            <span className="text-2xl font-bold text-primary">
              {course.price > 0 ? `${course.price} GHS` : "Free"}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Modules */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-xl font-bold text-white mb-4">Course Content</h2>
          {modules.map((mod, i) => (
            <motion.div key={mod.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden"
            >
              <button onClick={() => setExpandedModule(expandedModule === mod.id ? null : mod.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
              >
                <span className="text-white font-medium flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  {mod.title}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-sm">{mod.videos.length} videos</span>
                  {expandedModule === mod.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </div>
              </button>
              {expandedModule === mod.id && (
                <div className="border-t border-white/5">
                  {mod.videos.map((vid, j) => (
                    <div key={vid.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                      {isEnrolled ? (
                        <PlayCircle className="w-4 h-4 text-primary shrink-0" />
                      ) : (
                        <Lock className="w-4 h-4 text-gray-600 shrink-0" />
                      )}
                      <span className="text-gray-300 text-sm flex-1">{vid.title}</span>
                      {vid.duration > 0 && (
                        <span className="text-gray-600 text-xs">{Math.floor(vid.duration / 60)}m</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Payment Status */}
          {isEnrolled && paymentStatus.payment_method === "earn_to_learn" && (
            <div className="rounded-xl bg-white/[0.03] border border-primary/20 p-5">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Payment Progress
              </h3>
              <div className="w-full bg-white/10 rounded-full h-2 mb-2 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, (paymentStatus.amount_paid / paymentStatus.total_price) * 100)}%` }}
                  role="progressbar"
                  aria-valuenow={Math.round((paymentStatus.amount_paid / paymentStatus.total_price) * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <p className="text-gray-400 text-xs">
                {paymentStatus.amount_paid} / {paymentStatus.total_price} GHS paid
              </p>
            </div>
          )}

          {/* Reviews */}
          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400" /> Reviews
            </h3>
            {reviews.length === 0 ? (
              <p className="text-gray-500 text-sm">No reviews yet</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((r, i) => (
                  <div key={i} className="border-b border-white/5 pb-3 last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star key={s} className={`w-3 h-3 ${s < r.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-600"}`} />
                      ))}
                    </div>
                    {r.text && <p className="text-gray-400 text-sm">{r.text}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" 
          onClick={() => setShowPaymentModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-modal-title"
        >
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-sidebar border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            <h2 id="payment-modal-title" className="text-xl font-bold text-white mb-2">Choose Payment Method</h2>
            <p className="text-gray-400 text-sm mb-6">Course: {course.title} — {course.price} GHS</p>

            {feasibility && (
              <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/10">
                <p className="text-sm text-gray-300">
                  Balance: <span className="text-primary font-bold">{feasibility.balance?.toFixed(2)} GHS</span>
                </p>
                {feasibility.daily_earning > 0 && (
                  <p className="text-sm text-gray-400 mt-1">
                    Daily earnings: ~{feasibility.daily_earning} GHS · Est. {feasibility.estimated_days} days to complete
                  </p>
                )}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => enroll("upfront")}
                disabled={enrolling || (feasibility && !feasibility.can_pay_upfront)}
                className="w-full py-3 bg-white/5 border border-white/10 text-white font-medium rounded-xl hover:border-primary/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {enrolling ? "Processing..." : `Pay from Wallet — ${course.price} GHS`}
              </button>
              
              <button
                onClick={handleDirectCheckout}
                disabled={enrolling}
                className="w-full py-3 bg-gradient-to-r from-primary to-cyan-400 text-background font-bold rounded-xl hover:shadow-[0_0_20px_rgba(0,224,255,0.4)] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {enrolling ? "Processing..." : "Pay with Card / Momo"} <ArrowUpRight className="w-4 h-4 text-background" />
              </button>

              <button
                onClick={() => enroll("earn_to_learn")}
                disabled={enrolling}
                className="w-full py-3 bg-white/5 border border-white/10 text-gray-400 text-sm font-medium rounded-xl hover:border-primary/20 transition-all disabled:opacity-40"
              >
                {enrolling ? "Processing..." : "Pay from Earnings (PPC)"}
              </button>
            </div>

            <p className="text-gray-600 text-xs mt-4 text-center">
              Earn-to-learn deducts per video watched. Min 10% balance required.
            </p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
