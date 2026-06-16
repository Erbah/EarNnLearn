"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, Filter, Star, Users, BookOpen, ChevronRight, 
  Sparkles, TrendingUp, Clock
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";

const API = `${API_BASE_URL}/api/v1`;

interface Course {
  id: string;
  title: string;
  description: string | null;
  creator_rid: string;
  category: string;
  skill_level: string;
  price: number;
  avg_rating: number;
  enrollment_count: number;
  is_published: boolean;
  thumbnail_url?: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeLevel, setActiveLevel] = useState<string | null>(null);
  const [sort, setSort] = useState("popular");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [loading, setLoading] = useState(true);

  const loadCourses = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    const params = new URLSearchParams({ sort });
    if (activeCategory) params.set("category", activeCategory);
    if (activeLevel) params.set("skill_level", activeLevel);
    try {
      const r = await fetch(`${API}/courses/browse?${params}`, { signal });
      const data = await r.json();
      if (Array.isArray(data)) setCourses(data);
      else setCourses([]);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setCourses([]);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [activeCategory, activeLevel, sort]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/courses/categories`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setCategories(data);
        else setCategories([]);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setCategories([]);
      });
    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadCourses(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadCourses]);

  const filtered = useMemo(() => {
    return debouncedSearch && Array.isArray(courses)
      ? courses.filter(c => c.title.toLowerCase().includes(debouncedSearch.toLowerCase()))
      : (Array.isArray(courses) ? courses : []);
  }, [courses, debouncedSearch]);

  const levels = ["Beginner", "Intermediate", "Advanced"];

  return (
    <div className="flex flex-col gap-8 pb-12 pt-4">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Course Marketplace
          </h1>
          <p className="text-gray-400 mt-1">
            Discover skills, earn certificates, and grow your career
          </p>
        </div>
        <Link href="/creator"
          className="px-5 py-2.5 bg-gradient-to-r from-primary to-cyan-400 text-background font-bold rounded-xl hover:shadow-[0_0_20px_rgba(0,224,255,0.4)] transition-all text-sm"
        >
          Publish a Course
        </Link>
      </div>

      {/* Search + Sort */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-all"
          />
        </div>
        <div className="relative">
          <label id="lbl-sort" className="sr-only">Sort by</label>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            title="Sort by"
            aria-labelledby="lbl-sort"
            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white appearance-none cursor-pointer focus:outline-none focus:border-primary/50"
          >
            <option value="popular" className="bg-sidebar">Most Popular</option>
            <option value="rating" className="bg-sidebar">Top Rated</option>
            <option value="newest" className="bg-sidebar">Newest</option>
          </select>
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            !activeCategory 
              ? "bg-primary/20 text-primary border border-primary/30" 
              : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20"
          }`}
        >
          All
        </button>
        {Array.isArray(categories) && categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(activeCategory === cat.name ? null : cat.name)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeCategory === cat.name 
                ? "bg-primary/20 text-primary border border-primary/30" 
                : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20"
            }`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      {/* Skill Level */}
      <div className="flex gap-3">
        {levels.map(lvl => (
          <button
            key={lvl}
            onClick={() => setActiveLevel(activeLevel === lvl ? null : lvl)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              activeLevel === lvl 
                ? "bg-secondary/20 text-secondary border border-secondary/30" 
                : "bg-white/5 text-gray-500 border border-white/10 hover:border-white/20"
            }`}
          >
            {lvl}
          </button>
        ))}
      </div>

      {/* Course Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="h-72 rounded-2xl bg-white/5 animate-pulse border border-white/5" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Sparkles className="w-12 h-12 text-primary/40 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">No courses found</p>
          <p className="text-gray-500 text-sm mt-1">Try a different category or filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filtered.map((course, i) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/courses/${course.id}`}>
                  <div className="group rounded-2xl bg-white/[0.03] border border-white/10 hover:border-primary/30 transition-all duration-300 overflow-hidden hover:shadow-[0_0_30px_rgba(0,224,255,0.08)]">
                    {/* Course Banner */}
                    <div className="h-36 bg-gradient-to-br from-primary/20 via-blue-600/10 to-purple-600/10 flex items-center justify-center relative overflow-hidden">
                      {course.thumbnail_url ? (
                        <img src={course.thumbnail_url} alt={course.title} className="absolute inset-0 w-full h-full object-cover z-0" />
                      ) : (
                        <BookOpen className="w-10 h-10 text-primary/50 relative z-10" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80 z-10" />
                      {course.price === 0 && (
                        <span className="absolute top-3 right-3 px-2.5 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full border border-green-500/20 z-20">
                          FREE
                        </span>
                      )}
                    </div>

                    {/* Course Info */}
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">{course.category}</span>
                        <span className="text-xs text-gray-500">{course.skill_level}</span>
                      </div>
                      <h3 className="text-white font-semibold text-base mb-2 group-hover:text-primary transition-colors line-clamp-2">
                        {course.title}
                      </h3>
                      {course.description && (
                        <p className="text-gray-500 text-sm line-clamp-2 mb-4">{course.description}</p>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-yellow-400 text-sm">
                            <Star className="w-3.5 h-3.5 fill-yellow-400" />
                            {course.avg_rating.toFixed(1)}
                          </span>
                          <span className="flex items-center gap-1 text-gray-500 text-sm">
                            <Users className="w-3.5 h-3.5" />
                            {course.enrollment_count}
                          </span>
                        </div>
                        <span className={`font-bold text-sm ${course.price > 0 ? "text-primary" : "text-green-400"}`}>
                          {course.price > 0 ? `${course.price} GHS` : "Free"}
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
