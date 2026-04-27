"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { ArrowRight, Lightbulb, BookOpen, Zap, Loader2, Check, Plus, X, ChevronDown } from "lucide-react";
import Link from "next/link";
import Dropdown from "@/components/Dropdown";

const API = "/api/v1";

// Predefined subjects/topics
const PREDEFINED_TOPICS = [
  "Artificial Intelligence",
  "Digital Marketing",
  "Programming",
  "Entrepreneurship",
  "Finance",
  "Personal Development",
  "Design",
  "Data Science",
  "Mathematics",
  "Web Development",
  "Machine Learning",
  "Blockchain & Web3",
  "Cybersecurity",
  "Cloud Computing",
  "UI/UX Design"
];

// Title templates generator
const getTitleSuggestions = (topic: string) => {
  if (!topic) return ["Introduction to ...", "Fundamentals of ...", "Mastering ..."];
  return [
    `Introduction to ${topic}`,
    `${topic} Fundamentals`,
    `Mastering ${topic}`,
    `Advanced ${topic} Techniques`,
    `Deep Dive: ${topic}`,
    `${topic} for Professionals`,
    `${topic} Best Practices`,
    `The Art of ${topic}`
  ];
};

const PREDEFINED_OBJECTIVES = {
  "Understanding & Knowledge": [
    "Understand the fundamental concepts",
    "Identify key principles and theories",
    "Explain core ideas and mechanisms",
    "Recognize patterns and relationships",
    "Define important terminology"
  ],
  "Practical Skills": [
    "Apply concepts to real-world scenarios",
    "Develop practical problem-solving skills",
    "Master technical tools and software",
    "Practice hands-on implementation",
    "Build working projects or solutions"
  ],
  "Analysis & Critical Thinking": [
    "Analyze complex information",
    "Evaluate different approaches",
    "Compare and contrast concepts",
    "Break down complex problems",
    "Synthesize information from multiple sources"
  ],
  "Creation & Innovation": [
    "Create original work or solutions",
    "Design innovative approaches",
    "Develop original projects",
    "Combine ideas in new ways",
    "Produce new content or products"
  ],
  "Communication": [
    "Communicate ideas clearly",
    "Present information effectively",
    "Write persuasive arguments",
    "Collaborate with others",
    "Explain complex topics simply"
  ],
  "Professional Development": [
    "Develop career-ready skills",
    "Build professional portfolio",
    "Master industry best practices",
    "Develop leadership abilities",
    "Learn career management strategies"
  ]
};

interface GenerateLessonRequest {
  title: string;
  topic: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  objectives: string[];
  style: "socratic" | "problem-based" | "lecture" | "interactive";
  target_duration_minutes: number;
}

type Step = "form" | "generating" | "success";

export default function EducationStudio() {
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedLessonId, setGeneratedLessonId] = useState<string | null>(null);
  
  // State for objective dropdown and custom input
  const [selectedCategory, setSelectedCategory] = useState<string>("Understanding & Knowledge");
  const [customObjective, setCustomObjective] = useState<string>("");

  const [formData, setFormData] = useState<GenerateLessonRequest>({
    title: "",
    topic: "",
    difficulty: "beginner",
    objectives: [""],
    style: "interactive",
    target_duration_minutes: 30,
  });

  const [isCustomTopic, setIsCustomTopic] = useState(false);
  const [isCustomTitle, setIsCustomTitle] = useState(false);

  const handleTopicChange = (topic: string) => {
    if (topic === "custom") {
      setIsCustomTopic(true);
      setFormData({ ...formData, topic: "" });
    } else {
      setIsCustomTopic(false);
      setFormData({ ...formData, topic });
      // Suggest a default title when topic changes if title is empty or was from previous topic
      const suggestions = getTitleSuggestions(topic);
      setFormData(prev => ({ ...prev, topic, title: suggestions[0] }));
      setIsCustomTitle(false);
    }
  };

  const handleTitleChange = (title: string) => {
    if (title === "custom") {
      setIsCustomTitle(true);
      setFormData({ ...formData, title: "" });
    } else {
      setIsCustomTitle(false);
      setFormData({ ...formData, title });
    }
  };

  const handleAddObjectiveFromDropdown = (objective: string) => {
    if (!formData.objectives.includes(objective)) {
      setFormData({
        ...formData,
        objectives: [...formData.objectives.filter(o => o.trim()), objective]
      });
    }
  };

  const handleAddCustomObjective = () => {
    if (customObjective.trim() && !formData.objectives.includes(customObjective)) {
      setFormData({
        ...formData,
        objectives: [...formData.objectives.filter(o => o.trim()), customObjective]
      });
      setCustomObjective("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const filteredObjectives = formData.objectives.filter((obj) => obj.trim());
      if (filteredObjectives.length === 0) {
        setError("Please add at least one learning objective");
        setLoading(false);
        return;
      }

      setStep("generating");

      const res = await api.post(`${API}/education/lessons/generate`, {
        title: formData.title,
        topic: formData.topic,
        difficulty: formData.difficulty,
        objectives: filteredObjectives,
        style: formData.style,
        target_duration_minutes: formData.target_duration_minutes,
      });

      if (res.status === 200 || res.status === 201) {
        const lessonId = res.data.lesson_id || res.data.id;
        console.log("SUCCESS: Lesson generated. ID:", lessonId);
        setGeneratedLessonId(lessonId);
        setStep("success");
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const errorMsg =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: any) => d.msg).join("; ")
            : "Failed to generate lesson";
      setError(errorMsg);
      setStep("form");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-white mb-4">🎓 AI Lesson Studio</h1>
        <p className="text-gray-400">Generate interactive AI-powered lessons in seconds</p>
      </div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {step === "form" && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-2xl"
          >
            <div className="bg-card/70 border border-white/10 rounded-3xl p-8 glass">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Topic / Subject */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Topic / Subject *
                  </label>
                  {!isCustomTopic ? (
                    <Dropdown
                      value={formData.topic}
                      onChange={handleTopicChange}
                      options={[
                        ...PREDEFINED_TOPICS,
                        { value: "custom", label: "+ Other / Custom Subject" }
                      ]}
                      placeholder="Select a subject..."
                    />
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.topic}
                        onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                        placeholder="Type custom subject..."
                        className="flex-1 bg-background/50 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary transition-all"
                        required
                        autoFocus
                      />
                      <button 
                        type="button"
                        onClick={() => setIsCustomTopic(false)}
                        className="px-4 py-2 text-xs text-gray-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {/* Lesson Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Lesson Title *
                  </label>
                  {!isCustomTitle ? (
                    <Dropdown
                      value={formData.title}
                      onChange={handleTitleChange}
                      options={[
                        ...getTitleSuggestions(formData.topic),
                        { value: "custom", label: "+ Write Custom Title" }
                      ]}
                      placeholder={formData.topic ? "Select a title..." : "Select a topic first"}
                      disabled={!formData.topic}
                    />
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g., React Hooks 101"
                        className="flex-1 bg-background/50 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary transition-all"
                        required
                        autoFocus
                      />
                      <button 
                        type="button"
                        onClick={() => setIsCustomTitle(false)}
                        className="px-4 py-2 text-xs text-gray-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {/* Difficulty */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Difficulty Level
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(["beginner", "intermediate", "advanced"] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setFormData({ ...formData, difficulty: level })}
                        className={`py-3 px-4 rounded-xl font-medium transition-all capitalize ${
                          formData.difficulty === level
                            ? "bg-primary text-background"
                            : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Teaching Style */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Teaching Style
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["socratic", "problem-based", "lecture", "interactive"] as const).map(
                      (style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => setFormData({ ...formData, style })}
                          className={`py-3 px-4 rounded-xl font-medium transition-all capitalize ${
                            formData.style === style
                              ? "bg-secondary text-background"
                              : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
                          }`}
                        >
                          {style}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Target Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.target_duration_minutes}
                    onChange={(e) =>
                      setFormData({ ...formData, target_duration_minutes: parseInt(e.target.value) })
                    }
                    min="5"
                    max="180"
                    step="5"
                    className="w-full bg-background/50 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary transition-all"
                  />
                </div>

                {/* Learning Objectives */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-4">
                    Learning Objectives * (at least 1)
                  </label>
                  
                  {/* Objective Selector */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
                    <p className="text-xs text-gray-400 mb-3 font-medium">SELECT FROM CATEGORIES:</p>
                    
                    {/* Category Selector */}
                    <div className="mb-4">
                      <Dropdown
                        value={selectedCategory}
                        onChange={setSelectedCategory}
                        options={Object.keys(PREDEFINED_OBJECTIVES)}
                        buttonClassName="rounded-lg py-2 pl-3 pr-10 text-sm"
                      />
                    </div>

                    {/* Objectives Dropdown */}
                    <div className="mb-4">
                      <label className="text-xs text-gray-400 block mb-2">Select from suggestions:</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {PREDEFINED_OBJECTIVES[selectedCategory as keyof typeof PREDEFINED_OBJECTIVES].map((obj, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleAddObjectiveFromDropdown(obj)}
                            disabled={formData.objectives.includes(obj)}
                            className={`text-left p-2 rounded-lg text-xs font-medium transition-all ${
                              formData.objectives.includes(obj)
                                ? "bg-primary/20 border border-primary/50 text-primary cursor-not-allowed opacity-60"
                                : "bg-white/5 border border-white/10 text-gray-300 hover:bg-primary/10 hover:border-primary/30"
                            }`}
                          >
                            {formData.objectives.includes(obj) ? "✓ " : "+ "}{obj}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Objective Input */}
                    <div className="border-t border-white/10 pt-4">
                      <p className="text-xs text-gray-400 mb-2 font-medium">OR ADD CUSTOM OBJECTIVE:</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customObjective}
                          onChange={(e) => setCustomObjective(e.target.value)}
                          onKeyPress={(e) => e.key === "Enter" && handleAddCustomObjective()}
                          placeholder="Type your own learning objective..."
                          className="flex-1 bg-background/50 border border-white/10 rounded-lg py-2 px-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-all"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomObjective}
                          disabled={!customObjective.trim()}
                          className="px-4 py-2 bg-primary text-background rounded-lg font-medium hover:bg-primary/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Selected Objectives List */}
                  {formData.objectives.length > 0 && formData.objectives[0] !== "" && (
                    <div>
                      <p className="text-xs text-gray-400 mb-2 font-medium">SELECTED OBJECTIVES:</p>
                      <div className="space-y-2">
                        {formData.objectives.map((objective, idx) => (
                          objective.trim() && (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/30 rounded-lg"
                            >
                              <div className="flex-1">
                                <p className="text-sm text-white">{objective}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const newObj = formData.objectives.filter((_, i) => i !== idx);
                                  setFormData({ ...formData, objectives: newObj });
                                }}
                                className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-all"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </motion.div>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm">
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-primary to-blue-500 text-background font-bold rounded-xl hover:shadow-[0_0_30px_rgba(0,224,255,0.4)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Generate Lesson
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {step === "generating" && (
          <motion.div
            key="generating"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-2xl"
          >
            <div className="bg-card/70 border border-white/10 rounded-3xl p-12 glass text-center">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity }}>
                <Lightbulb className="w-16 h-16 text-primary mx-auto mb-6" />
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-3">Creating Your Lesson</h2>
              <p className="text-gray-400 mb-8">
                AI is generating lesson content, scenes, and assessments...
              </p>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-blue-500"
                  initial={{ width: "10%" }}
                  animate={{ width: "90%" }}
                  transition={{ duration: 8, ease: "easeInOut" }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-4">This typically takes 30-60 seconds...</p>
            </div>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-2xl"
          >
            <div className="bg-card/70 border border-primary/30 rounded-3xl p-12 glass text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 100 }}
              >
                <Check className="w-16 h-16 text-green-400 mx-auto mb-6" />
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-2">Lesson Created!</h2>
              <p className="text-gray-400 mb-8">Your AI-powered lesson is ready to go.</p>

              <div className="space-y-3">
                <Link
                  href={`/education/lessons/${generatedLessonId}`}
                  className="block w-full py-4 bg-primary text-background font-bold rounded-xl hover:bg-primary/90 transition-all"
                >
                  Open Lesson
                </Link>
                <button
                  onClick={() => {
                    setStep("form");
                    setFormData({
                      title: "",
                      topic: "",
                      difficulty: "beginner",
                      objectives: [""],
                      style: "interactive",
                      target_duration_minutes: 30,
                    });
                  }}
                  className="w-full py-4 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all"
                >
                  Create Another
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
