"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, PlayCircle, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { api } from "@/lib/api";

interface EnrolledCourse {
  course_id: string;
  title: string;
  payment_method: string;
  status: string;
  progress: number;
  amount_paid: number;
  remaining: number;
}

export default function MyLearningPage() {
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchMyCourses = async () => {
      try {
        const res = await api.get("/api/v1/learn/my-courses");
        setCourses(res.data);
      } catch (err: any) {
        setError(err.response?.data?.detail || "Failed to load courses");
      } finally {
        setLoading(false);
      }
    };
    fetchMyCourses();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "text-green-400 bg-green-500/10 border-green-500/20";
      case "active":
        return "text-primary bg-primary/10 border-primary/20";
      case "paused":
        return "text-orange-400 bg-orange-500/10 border-orange-500/20";
      case "expired":
        return "text-red-400 bg-red-500/10 border-red-500/20";
      default:
        return "text-gray-400 bg-gray-500/10 border-gray-500/20";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      case "paused":
        return <AlertCircle className="w-4 h-4" />;
      case "expired":
        return <Clock className="w-4 h-4" />;
      default:
        return <PlayCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-12 pt-4">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">My Learning</h1>
        <p className="text-gray-400 mt-1">Track your progress and continue where you left off</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-white/5 animate-pulse border border-white/5" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400 font-medium">{error}</p>
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20 bg-white/[0.02] border border-white/5 rounded-2xl">
          <BookOpen className="w-12 h-12 text-primary/40 mx-auto mb-4" />
          <p className="text-white text-lg font-medium">No courses yet</p>
          <p className="text-gray-500 text-sm mt-1 mb-6">You haven't enrolled in any courses.</p>
          <Link
            href="/courses"
            className="px-6 py-3 bg-primary text-background font-bold rounded-xl hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(0,224,255,0.3)]"
          >
            Browse Courses
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence>
            {courses.map((course, i) => (
              <motion.div
                key={course.course_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group rounded-2xl bg-white/[0.03] border border-white/10 hover:border-primary/30 transition-all duration-300 overflow-hidden flex flex-col"
              >
                <div className="p-6 flex-1 flex flex-col">
                  {/* Status Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 uppercase tracking-wider ${getStatusColor(course.status)}`}>
                      {getStatusIcon(course.status)}
                      {course.status}
                    </span>
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wider bg-white/5 px-2 py-1 rounded-md">
                      {course.payment_method.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-white mb-6 group-hover:text-primary transition-colors line-clamp-2">
                    {course.title}
                  </h3>

                  {/* Progress & Payment Details */}
                  <div className="mt-auto space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-gray-400">Course Progress</span>
                        <span className="text-white font-medium">{course.progress}%</span>
                      </div>
                      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-black/20 rounded-xl border border-white/5 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Amount Paid</span>
                        <span className="text-white font-medium">{course.amount_paid.toFixed(2)} GHS</span>
                      </div>
                      {course.payment_method === 'earn_to_learn' && (
                        <div className="flex justify-between text-sm pt-2 border-t border-white/5">
                          <span className="text-gray-400">Remaining Cost</span>
                          <span className="text-orange-400 font-medium">{course.remaining.toFixed(2)} GHS</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="p-4 bg-black/40 border-t border-white/5">
                  <Link href={`/learn/${course.course_id}`} className="w-full">
                    <button 
                      disabled={course.status === 'expired'}
                      className="w-full py-3 bg-white/5 hover:bg-primary hover:text-background text-primary font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/5 disabled:hover:text-primary"
                    >
                      {course.status === 'expired' ? 'Course Expired' : 'Continue Learning'}
                    </button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
