"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, BookOpen, GraduationCap, ShieldCheck, ChevronRight, PlayCircle
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

const API = `${API_BASE_URL}/api/v1`;

interface TrackCourse {
  id: string;
  course_id: string;
  position: number;
  course_title: string;
  course_thumbnail: string | null;
}

interface Track {
  id: string;
  title: string;
  description: string | null;
  badge_name: string | null;
  courses: TrackCourse[];
}

export default function TrackDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [track, setTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    fetch(`${API}/tracks/${id}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        setTrack(data);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
      </div>
    );
  }

  if (!track) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">Track not found.</p>
        <button onClick={() => router.push("/tracks")} className="text-[#d4af37] mt-4">Return to Majors</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 pb-16 pt-4 max-w-4xl mx-auto">
      <button onClick={() => router.push("/tracks")} className="flex items-center gap-2 text-gray-400 hover:text-[#d4af37] transition-colors w-fit font-medium">
        <ArrowLeft className="w-4 h-4" /> Back to All Majors
      </button>

      {/* Track Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center p-4 bg-[#d4af37]/10 rounded-full mb-6 border border-[#d4af37]/20">
          <GraduationCap className="w-10 h-10 text-[#d4af37]" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight" style={{ fontFamily: "Georgia, serif" }}>
          {track.title}
        </h1>
        {track.description && (
          <p className="text-gray-300 text-lg max-w-2xl mx-auto leading-relaxed">
            {track.description}
          </p>
        )}
        
        {track.badge_name && (
          <div className="mt-8 flex justify-center">
            <div className="flex items-center gap-2 px-5 py-2.5 bg-[#111827] border border-[#d4af37]/30 rounded-lg text-[#d4af37] font-semibold uppercase tracking-widest text-sm shadow-[0_0_15px_rgba(212,175,55,0.1)]">
              <ShieldCheck className="w-5 h-5" />
              Upon Completion: {track.badge_name}
            </div>
          </div>
        )}
      </div>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-[#d4af37]/30 to-transparent my-4" />

      {/* Curriculum Roadmap */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-8 text-center" style={{ fontFamily: "Georgia, serif" }}>
          Curriculum Roadmap
        </h2>

        <div className="relative pl-6 md:pl-8 border-l border-[#d4af37]/20 space-y-12">
          {track.courses && track.courses.map((tc, index) => (
            <motion.div 
              key={tc.id} 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.15 }}
              className="relative"
            >
              {/* Timeline dot */}
              <div className="absolute -left-[31px] md:-left-[39px] top-6 w-4 h-4 rounded-full bg-[#111827] border-2 border-[#d4af37] shadow-[0_0_10px_rgba(212,175,55,0.4)]" />
              
              <Link href={`/courses/${tc.course_id}`}>
                <div className="group bg-white/[0.02] border border-white/10 rounded-xl p-6 hover:bg-[#111827] hover:border-[#d4af37]/40 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 block">
                  <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                    
                    <div className="w-full md:w-48 h-32 bg-[#1a2332] rounded-lg border border-white/5 flex items-center justify-center shrink-0 overflow-hidden relative">
                      {tc.course_thumbnail ? (
                        <img src={tc.course_thumbnail} alt={tc.course_title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                      ) : (
                        <BookOpen className="w-10 h-10 text-gray-600 group-hover:text-[#d4af37] transition-colors" />
                      )}
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded">
                        Step {tc.position}
                      </div>
                    </div>

                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#d4af37] transition-colors" style={{ fontFamily: "Georgia, serif" }}>
                        {tc.course_title}
                      </h3>
                      <div className="flex items-center gap-4 mt-4">
                        <span className="flex items-center gap-1.5 text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                          <PlayCircle className="w-4 h-4" /> Go to Course
                        </span>
                      </div>
                    </div>

                    <div className="hidden md:flex shrink-0">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#d4af37]/20 transition-colors">
                        <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-[#d4af37]" />
                      </div>
                    </div>

                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
