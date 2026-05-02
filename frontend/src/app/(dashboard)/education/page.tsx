'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  GraduationCap, BookOpen, Video, HelpCircle, Users, BarChart3,
  Search, Plus, ChevronRight, ExternalLink, Play, Clock, Zap, TrendingUp, FilterX
} from 'lucide-react';
import { API_BASE_URL, api } from '@/lib/api';

const API = "/api/v1/education";
const V1_API = "/api/v1";

function getHeaders() {
  return { 'Content-Type': 'application/json' };
}

function Stat({ label, value, color = '#00E0FF' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-card/70 rounded-[14px] p-5 border border-white/5">
      <div className="text-[12px] text-gray-400 mb-1.5">{label}</div>
      <div className="text-[24px] font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 rounded-xl border-none cursor-pointer text-[13px] font-semibold transition-all duration-200 ${
        active ? 'bg-primary/15 text-primary' : 'bg-transparent text-gray-400'
      }`}
    >
      {label}
    </button>
  );
}

function CoursePanel() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get(`${API}/courses`)
      .then(res => {
        const data = res.data;
        return data;
      })
      .then(data => {
        if (Array.isArray(data)) {
          setCourses(data);
        } else {
          setCourses([]);
        }
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 text-center text-gray-500">Loading courses...</div>;
  if (error) return <div className="p-10 text-center text-red-500 bg-red-500/10 rounded-2xl border border-red-500/20 m-4">Error: {typeof error === 'string' ? error : JSON.stringify(error)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-white">📚 All Courses</h3>
        <button className="bg-primary text-background px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Course
        </button>
      </div>
      
      <div className="grid gap-4">
        {Array.isArray(courses) && courses.length > 0 ? courses.map(course => (
          <div key={course.id} className="bg-card/70 border border-white/5 rounded-2xl p-5 flex justify-between items-center hover:border-primary/20 transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h4 className="font-bold text-white group-hover:text-primary transition-colors">{course.title}</h4>
                <div className="text-xs text-gray-500 flex gap-4 mt-1">
                  <span>{course.category}</span>
                  <span>{course.skill_level}</span>
                  <span className="text-emerald-500">GHS {course.price}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="p-2 hover:bg-white/5 rounded-lg text-gray-400" title="Edit Content"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>
        )) : (
          <div className="p-10 text-center text-gray-500 border border-dashed border-white/10 rounded-2xl">
            No courses found. Start by creating one!
          </div>
        )}
      </div>
    </div>
  );
}

function QuizDetailModal({ quiz, onClose }: { quiz: any; onClose: () => void }) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/v1/engagement/quizzes/${quiz.id}`)
      .then(res => setDetails(res.data))
      .finally(() => setLoading(false));
  }, [quiz.id]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-4xl max-h-[90vh] bg-[#111827] border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tighter flex items-center gap-3">
              <HelpCircle className="text-primary" />
              {quiz.title}
            </h2>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Quiz Oversight & Configuration</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
            <FilterX className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {loading ? (
            <div className="py-20 text-center text-gray-500">Retrieving quiz architecture...</div>
          ) : (
            <>
              {/* Questions */}
              <div className="space-y-6">
                <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Assessment Logic ({details.questions?.length || 0} Questions)
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {details.questions?.map((q: any, idx: number) => (
                    <div key={q.id} className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 relative group">
                      <span className="absolute top-6 right-8 text-primary/20 font-black text-4xl group-hover:text-primary/40 transition-colors">{idx + 1}</span>
                      <p className="text-white font-bold mb-4 pr-12">{q.question_text}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {q.options?.map((o: any) => (
                          <div key={o.id} className={`p-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest border ${o.is_correct ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-white/5 border-white/5 text-gray-500"}`}>
                            {o.option_text}
                            {o.is_correct && <span className="float-right">✓ Correct</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function QuizzesPanel() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [qRes, sRes] = await Promise.all([
          api.get(`${API}/quizzes`),
          api.get(`${API}/quizzes/stats`)
        ]);
        setQuizzes(qRes.data);
        setStats(sRes.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-10 text-center text-gray-500">Loading assessments...</div>;
  if (error) return <div className="p-10 text-center text-red-500">Error: {error}</div>;

  return (
    <div className="space-y-8">
      {/* Quiz Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card/70 border border-white/5 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Total Quizzes</div>
              <div className="text-xl font-bold text-white">{stats.total_quizzes}</div>
            </div>
          </div>
          <div className="bg-card/70 border border-white/5 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Total Attempts</div>
              <div className="text-xl font-bold text-white">{stats.total_attempts}</div>
            </div>
          </div>
          <div className="bg-card/70 border border-white/5 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Avg. Pass Rate</div>
              <div className="text-xl font-bold text-white">{stats.avg_pass_rate}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Quiz List */}
      <div className="bg-card/70 border border-white/5 rounded-[2rem] p-8">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-lg font-bold text-white">📋 Active Assessments</h3>
          <div className="text-xs text-gray-500 uppercase tracking-widest font-bold">Platform Wide Oversight</div>
        </div>

        <div className="grid gap-4">
          {quizzes.length > 0 ? quizzes.map(quiz => (
            <div 
              key={quiz.id} 
              onClick={() => setSelectedQuiz(quiz)}
              className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 flex justify-between items-center hover:border-primary/20 transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <HelpCircle className="w-5 h-5 text-gray-400 group-hover:text-primary" />
                </div>
                <div>
                  <h4 className="font-bold text-white">{quiz.title}</h4>
                  <div className="text-[10px] text-gray-500 flex gap-4 mt-1 font-bold uppercase tracking-wider">
                    <span>Course: {quiz.course_id.slice(0, 8)}</span>
                    <span className={quiz.pass_rate > 70 ? 'text-emerald-500' : 'text-orange-400'}>
                      {quiz.pass_rate}% Pass Rate
                    </span>
                    <span>{quiz.total_attempts} Attempts</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Passing Threshold</div>
                  <div className="text-sm font-bold text-white">{quiz.passing_score}%</div>
                </div>
                <button className="p-2 hover:bg-white/5 rounded-lg text-gray-400">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )) : (
            <div className="p-10 text-center text-gray-500 border border-dashed border-white/10 rounded-2xl">
              No quizzes found on the platform.
            </div>
          )}
        </div>
        {selectedQuiz && (
          <QuizDetailModal 
            quiz={selectedQuiz} 
            onClose={() => setSelectedQuiz(null)} 
          />
        )}
      </div>
    </div>
  );
}

function ProgressPanel() {
  const [progress, setProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get(`${API}/students/progress`)
      .then(res => {
        const data = res.data;
        return data;
      })
      .then(data => {
        if (Array.isArray(data)) {
          setProgress(data);
        } else {
          setProgress([]);
        }
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 text-center text-gray-500 text-[13px]">Analyzing student trajectories...</div>;
  if (error) return <div className="p-10 text-center text-red-500 bg-red-500/10 rounded-2xl border border-red-500/20 m-4 text-[13px]">Error: {typeof error === 'string' ? error : JSON.stringify(error)}</div>;

  return (
    <div className="bg-card/70 border border-white/5 rounded-2xl p-6">
      <h3 className="text-lg font-bold text-white mb-6">🎯 Student Performance</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 text-gray-500">
              <th className="px-4 py-3 font-medium uppercase tracking-widest text-[10px]">Student RID</th>
              <th className="px-4 py-3 font-medium uppercase tracking-widest text-[10px]">Course</th>
              <th className="px-4 py-3 font-medium uppercase tracking-widest text-[10px]">Lessons</th>
              <th className="px-4 py-3 font-medium uppercase tracking-widest text-[10px]">Progress</th>
              <th className="px-4 py-3 font-medium uppercase tracking-widest text-[10px]">Last Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {Array.isArray(progress) && progress.length > 0 ? progress.map((p, i) => (
              <tr key={i} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-4 font-mono text-primary">{p.user_rid || '—'}</td>
                <td className="px-4 py-4 text-gray-300">Course {p.course_id.slice(0,8)}</td>
                <td className="px-4 py-4 text-gray-400">{p.completed_lessons?.length || 0}</td>
                <td className="px-4 py-4">
                  <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '45%' }} />
                  </div>
                </td>
                <td className="px-4 py-4 text-gray-500">{new Date(p.updated_at).toLocaleDateString()}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">No student progress recorded yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface Lesson {
  id: string;
  title: string;
  topic: string;
  difficulty: string;
  style: string;
  created_at: string;
  total_duration_minutes: number;
  progress?: {
    completed_scenes: number;
    total_scenes: number;
    completion_percent: number;
  };
}

function LessonsPanel() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        setLoading(true);
        const res = await api.get(`${V1_API}/education/lessons`);
        if (res.status === 200) {
          setLessons(res.data.lessons || []);
        }
      } catch (err: any) {
        const detail = err.response?.data?.detail;
        if (err.response?.status !== 404) {
          setError(
            typeof detail === "string"
              ? detail
              : "Failed to load lessons"
          );
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLessons();
  }, []);

  let filtered = lessons.filter((lesson) => {
    if (difficultyFilter !== "all" && lesson.difficulty !== difficultyFilter) {
      return false;
    }
    if (!searchQuery) return true;
    return (
      lesson.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lesson.topic.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  filtered = filtered.sort((a, b) => {
    if (sortBy === "recent") {
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    if (sortBy === "difficulty") {
      const order: any = { beginner: 1, intermediate: 2, advanced: 3 };
      return (
        (order[a.difficulty] || 0) -
        (order[b.difficulty] || 0)
      );
    }
    if (sortBy === "progress") {
      return (
        (b.progress?.completion_percent || 0) -
        (a.progress?.completion_percent || 0)
      );
    }
    return 0;
  });

  const hasActiveFilters = difficultyFilter !== "all" || searchQuery.length > 0;

  if (loading) {
    return <div className="p-10 text-center text-gray-500">Loading lessons...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-lg font-bold text-white mb-2">
            <BookOpen className="w-6 h-6 inline-block mr-2" />
            AI-Generated Lessons
          </h3>
          <p className="text-sm text-gray-400">Your personalized learning materials</p>
        </div>
        <Link
          href="/education-studio"
          className="flex items-center gap-2 px-6 py-3 bg-primary text-background font-bold rounded-lg hover:scale-105 transition-transform text-sm"
        >
          <Plus className="w-5 h-5" />
          Generate Lesson
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-card/70 border border-white/10 rounded-xl p-4 glass">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Lessons</p>
              <p className="text-3xl font-bold text-white">{lessons.length}</p>
            </div>
            <BookOpen className="w-8 h-8 text-primary opacity-80" />
          </div>
        </div>

        <div className="bg-card/70 border border-white/10 rounded-xl p-4 glass">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Learning Time</p>
              <p className="text-3xl font-bold text-white">
                {Math.round(lessons.reduce((sum, l) => sum + l.total_duration_minutes, 0) / 60)}h
              </p>
            </div>
            <Clock className="w-8 h-8 text-secondary opacity-80" />
          </div>
        </div>

        <div className="bg-card/70 border border-white/10 rounded-xl p-4 glass">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Avg Progress</p>
              <p className="text-3xl font-bold text-white">
                {lessons.length > 0
                  ? Math.round(
                      lessons.reduce(
                        (sum, l) => sum + (l.progress?.completion_percent || 0),
                        0
                      ) / lessons.length
                    )
                  : 0}
                %
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-400 opacity-80" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-8 flex-wrap items-center">
        <div className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search lessons by title or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-card/70 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors text-sm"
            />
          </div>
        </div>

        <select
          value={difficultyFilter}
          onChange={(e) => setDifficultyFilter(e.target.value)}
          className="px-4 py-2 bg-card/70 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary transition-colors text-sm"
        >
          <option value="all">All Levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 bg-card/70 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary transition-colors text-sm"
        >
          <option value="recent">Recent</option>
          <option value="difficulty">Difficulty</option>
          <option value="progress">Progress</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={() => {
              setSearchQuery("");
              setDifficultyFilter("all");
            }}
            className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <FilterX className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/20 text-center mb-8">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {lessons.length === 0 && !error && (
        <div className="py-12 text-center">
          <Zap className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">No Lessons Yet</h3>
          <p className="text-gray-400 mb-6 text-sm">Start by generating your first AI-powered lesson!</p>
          <Link
            href="/education-studio"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-background font-bold rounded-lg hover:scale-105 transition-transform text-sm"
          >
            <Plus className="w-5 h-5" />
            Generate First Lesson
          </Link>
        </div>
      )}

      {/* Lessons Grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((lesson, idx) => (
            <motion.div
              key={lesson.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-card/70 border border-white/10 rounded-2xl p-6 glass hover:border-primary/50 transition-all cursor-pointer group"
            >
              <Link
                href={`/education/lessons/${lesson.id}`}
                className="block h-full"
              >
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-primary transition-colors line-clamp-2">
                    {lesson.title}
                  </h3>
                  <p className="text-sm text-gray-400 line-clamp-1">
                    {lesson.topic}
                  </p>
                </div>

                {/* Metadata */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span
                    className={`text-xs font-medium px-3 py-1 rounded-full ${
                      lesson.difficulty === "beginner"
                        ? "bg-green-500/20 text-green-300"
                        : lesson.difficulty === "intermediate"
                        ? "bg-yellow-500/20 text-yellow-300"
                        : "bg-red-500/20 text-red-300"
                    }`}
                  >
                    {lesson.difficulty}
                  </span>
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-blue-500/20 text-blue-300">
                    {lesson.style}
                  </span>
                </div>

                {/* Progress Bar */}
                {lesson.progress && lesson.progress.completion_percent > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Progress</span>
                      <span>{lesson.progress.completion_percent}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary to-blue-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${lesson.progress.completion_percent}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                )}

                {/* Duration */}
                <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{lesson.total_duration_minutes} min</span>
                  </div>
                  <span className="text-primary group-hover:translate-x-1 transition-transform">
                    Open →
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* No Results with Active Filters */}
      {!loading && filtered.length === 0 && hasActiveFilters && (
        <div className="py-12 text-center">
          <p className="text-gray-400 mb-6 text-sm">No lessons match your search criteria</p>
          <button
            onClick={() => {
              setSearchQuery("");
              setDifficultyFilter("all");
            }}
            className="px-6 py-2 bg-primary text-background font-bold rounded-lg hover:scale-105 transition-transform text-sm"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}

export default function EducationAdminPage() {
  const [activeTab, setActiveTab] = useState('lessons');
  const tabs = [
    { key: 'lessons', label: '🚀 AI Lessons', icon: Zap },
    { key: 'courses', label: '📚 Courses', icon: BookOpen },
    { key: 'progress', label: '🎯 Progress', icon: BarChart3 },
    { key: 'quizzes', label: '❓ Quizzes', icon: HelpCircle },
  ];

  return (
    <div className="p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
          <Zap className="w-8 h-8 text-secondary" />
          AI Learning Hub
        </h1>
        <p className="text-gray-400 text-sm">Create and explore AI-generated lessons</p>
      </header>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <Stat label="Total Students" value="1,280" />
        <Stat label="Live Courses" value="24" color="#FFD700" />
        <Stat label="Avg. Progress" value="68%" color="#10B981" />
        <Stat label="Certificates Issued" value="452" color="#A78BFA" />
      </div>

      <div className="flex gap-2 mb-8 bg-white/5 p-1 rounded-2xl w-fit border border-white/5">
        {tabs.map(t => (
          <Tab key={t.key} label={t.label} active={activeTab === t.key} onClick={() => setActiveTab(t.key)} />
        ))}
      </div>

      <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {activeTab === 'lessons' && <LessonsPanel />}
        {activeTab === 'courses' && <CoursePanel />}
        {activeTab === 'progress' && <ProgressPanel />}
        {activeTab === 'quizzes' && <QuizzesPanel />}
      </motion.div>
    </div>
  );
}
