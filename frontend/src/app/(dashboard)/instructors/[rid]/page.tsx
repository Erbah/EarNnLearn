"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, BookOpen, User, Star, Users, Briefcase, GraduationCap, Award
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

const API = `${API_BASE_URL}/api/v1`;

interface Instructor {
  user_rid: string;
  name: string;
  title: string | null;
  bio: string | null;
  credentials: string | null;
  avatar_url: string | null;
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  category: string | null;
  price: number;
}

export default function InstructorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const rid = params.rid as string;

  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rid) return;
    const controller = new AbortController();

    Promise.all([
      fetch(`${API}/instructors/${rid}`, { signal: controller.signal }).then(r => r.json()),
      fetch(`${API}/instructors/${rid}/courses`, { signal: controller.signal }).then(r => r.json())
    ])
    .then(([profileData, coursesData]) => {
      setInstructor(profileData);
      setCourses(Array.isArray(coursesData) ? coursesData : []);
    })
    .catch((err) => {
      if (err.name === 'AbortError') return;
    })
    .finally(() => setLoading(false));

    return () => controller.abort();
  }, [rid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
      </div>
    );
  }

  if (!instructor || instructor.name === undefined) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">Instructor not found.</p>
        <button onClick={() => router.back()} className="text-[#d4af37] mt-4">Go Back</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 pb-16 pt-4 max-w-5xl mx-auto">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-[#d4af37] transition-colors w-fit font-medium">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Faculty Profile Header */}
      <div className="bg-[#111827] border border-white/10 rounded-2xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#d4af37]/5 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="flex flex-col md:flex-row gap-10 items-start md:items-center relative z-10">
          <div className="w-32 h-32 md:w-48 md:h-48 shrink-0 rounded-2xl overflow-hidden border-2 border-[#d4af37]/40 shadow-[0_0_20px_rgba(212,175,55,0.2)] bg-[#1a2332] flex items-center justify-center">
            {instructor.avatar_url ? (
              <img src={instructor.avatar_url} alt={instructor.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-20 h-20 text-gray-500" />
            )}
          </div>

          <div className="flex-1">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2" style={{ fontFamily: "Georgia, serif" }}>
              {instructor.name}
            </h1>
            <p className="text-xl text-[#d4af37] font-medium mb-6">
              {instructor.title || "Faculty Member"}
            </p>

            {instructor.credentials && (
              <div className="flex items-start gap-3 mb-4 text-gray-300">
                <Award className="w-5 h-5 text-[#d4af37] shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed">{instructor.credentials}</p>
              </div>
            )}

            {instructor.bio && (
              <div className="flex items-start gap-3 text-gray-400">
                <BookOpen className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                <p className="text-base leading-relaxed">{instructor.bio}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-[#d4af37]/30 to-transparent my-2" />

      {/* Courses Taught */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3" style={{ fontFamily: "Georgia, serif" }}>
          <Briefcase className="w-6 h-6 text-[#d4af37]" /> Courses Taught by {instructor.name.split(' ')[0]}
        </h2>

        {courses.length === 0 ? (
          <div className="text-center py-12 bg-white/[0.02] rounded-xl border border-white/5">
            <p className="text-gray-400">No published courses available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course, i) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Link href={`/courses/${course.id}`}>
                  <div className="group rounded-xl bg-[#111827] border border-white/10 hover:border-[#d4af37]/40 transition-all duration-300 overflow-hidden hover:shadow-[0_8px_20px_rgba(0,0,0,0.5)]">
                    <div className="h-36 bg-[#1a2332] flex items-center justify-center relative overflow-hidden">
                      {course.thumbnail_url ? (
                        <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                      ) : (
                        <GraduationCap className="w-12 h-12 text-gray-600 group-hover:text-[#d4af37]/50 transition-colors" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#111827]" />
                      
                      {course.category && (
                        <span className="absolute top-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded uppercase tracking-wider border border-white/10 z-10">
                          {course.category}
                        </span>
                      )}
                    </div>

                    <div className="p-5">
                      <h3 className="text-white font-bold text-lg mb-2 group-hover:text-[#d4af37] transition-colors line-clamp-2" style={{ fontFamily: "Georgia, serif" }}>
                        {course.title}
                      </h3>
                      {course.description && (
                        <p className="text-gray-400 text-sm line-clamp-2 mb-4">{course.description}</p>
                      )}

                      <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <span className={`font-bold text-sm ${course.price > 0 ? "text-[#d4af37]" : "text-gray-300"}`}>
                          {course.price > 0 ? `${course.price} GHS` : "Free Audit"}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1 group-hover:text-gray-300 transition-colors">
                          View Syllabus <ArrowLeft className="w-3 h-3 rotate-180" />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
