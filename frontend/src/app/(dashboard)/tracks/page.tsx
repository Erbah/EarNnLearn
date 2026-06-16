"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  GraduationCap, ChevronRight, BookOpen, Star, Sparkles, University, ShieldCheck
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

const API = `${API_BASE_URL}/api/v1`;

interface Track {
  id: string;
  title: string;
  description: string | null;
  badge_name: string | null;
  is_published: boolean;
}

export default function TracksPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/tracks`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setTracks(data);
        else setTracks([]);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setTracks([]);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  return (
    <div className="flex flex-col gap-8 pb-12 pt-4">
      {/* Institutional Header */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#1a2332] to-[#0f172a] border border-[#d4af37]/20 p-10 flex flex-col items-center text-center shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent opacity-50" />
        <University className="w-16 h-16 text-[#d4af37] mb-4 drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]" />
        <h1 className="text-4xl font-bold text-white tracking-tight mb-3" style={{ fontFamily: "Georgia, serif" }}>
          Academic Majors & Tracks
        </h1>
        <p className="text-gray-300 max-w-2xl text-lg leading-relaxed">
          Embark on a comprehensive educational journey. Our structured majors provide a rigorous, fully-integrated curriculum designed to forge true mastery in your chosen field.
        </p>
      </div>

      {/* Tracks Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[1,2].map(i => (
            <div key={i} className="h-64 rounded-xl bg-white/5 animate-pulse border border-white/5" />
          ))}
        </div>
      ) : tracks.length === 0 ? (
        <div className="text-center py-20 bg-white/[0.02] rounded-xl border border-white/5">
          <GraduationCap className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">No academic tracks available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
          <AnimatePresence>
            {tracks.map((track, i) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Link href={`/tracks/${track.id}`}>
                  <div className="group flex flex-col h-full rounded-xl bg-[#111827] border border-white/10 hover:border-[#d4af37]/50 transition-all duration-500 hover:shadow-[0_8px_30px_rgba(212,175,55,0.1)] overflow-hidden">
                    
                    <div className="h-3 bg-[#d4af37] w-0 group-hover:w-full transition-all duration-700 ease-in-out" />
                    
                    <div className="p-8 flex-1 flex flex-col">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-white/5 rounded-lg border border-white/10 group-hover:bg-[#d4af37]/10 group-hover:border-[#d4af37]/30 transition-colors">
                          <BookOpen className="w-6 h-6 text-[#d4af37]" />
                        </div>
                        {track.badge_name && (
                          <span className="flex items-center gap-1.5 px-3 py-1 bg-[#d4af37]/10 text-[#d4af37] text-xs font-semibold rounded-full border border-[#d4af37]/20 uppercase tracking-wider">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {track.badge_name}
                          </span>
                        )}
                      </div>
                      
                      <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-[#d4af37] transition-colors" style={{ fontFamily: "Georgia, serif" }}>
                        {track.title}
                      </h2>
                      
                      <p className="text-gray-400 leading-relaxed mb-6 flex-1">
                        {track.description || "A comprehensive curriculum to master this discipline."}
                      </p>

                      <div className="pt-4 border-t border-white/10 flex items-center justify-between mt-auto">
                        <span className="text-[#d4af37] font-semibold text-sm flex items-center gap-2 group-hover:translate-x-2 transition-transform">
                          Explore Curriculum <ChevronRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
