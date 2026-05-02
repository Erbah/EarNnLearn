"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Cpu, Zap, Globe, Brain, Book, Upload, X, Library, FileText } from "lucide-react";
import { api, API_BASE_URL as API } from "@/lib/api";

interface ForgeIntakeProps {
  onComplete: (data: { topic: string; difficulty: string; style: string; source_id?: string }) => void;
}

export default function ForgeIntake({ onComplete }: ForgeIntakeProps) {
  const [prompt, setPrompt] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [complexity, setComplexity] = useState(0); // 0 to 1
  const [showSources, setShowSources] = useState(false);
  const [selectedSource, setSelectedSource] = useState<{ id: string; name: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [librarySources, setLibrarySources] = useState<{id: string; title: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Effect to handle "Resonance" - background pulse based on input length/keywords
  useEffect(() => {
    const len = prompt.length;
    setComplexity(Math.min(len / 50, 1));
  }, [prompt]);

  // Fetch library sources when dropdown opens
  useEffect(() => {
    if (!showSources) return;
    api.get(`${API}/education/knowledge/library?limit=5`)
      .then(res => setLibrarySources(res.data?.sources || []))
      .catch(() => setLibrarySources([]));
  }, [showSources]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && prompt.trim().length > 3) {
      onComplete({ 
        topic: prompt, 
        difficulty: "intermediate", 
        style: "interactive",
        source_id: selectedSource?.id 
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post(`${API}/education/knowledge/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.id) {
        setSelectedSource({ id: res.data.id, name: res.data.title || file.name });
      }
    } catch (err) {
      console.error("Upload failed:", err);
      // Fallback to local reference so user isn't blocked
      setSelectedSource({ id: "local_" + Date.now(), name: file.name });
    } finally {
      setIsUploading(false);
      setShowSources(false);
    }
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto pt-20 pb-40">
      {/* Background Particles / Resonance */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            scale: 1 + complexity * 0.2,
            opacity: 0.1 + complexity * 0.2,
            backgroundColor: complexity > 0.6 ? "#00e0ff" : "#fbbf24"
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] blur-[120px] rounded-full transition-colors duration-1000"
        />
      </div>

      <div className="text-center mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-[10px] font-black tracking-widest uppercase text-gray-400">The Knowledge Forge</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-serif text-white mb-6 tracking-tight">
            What do you want to <br />
            <span className="bg-gradient-to-r from-primary via-blue-500 to-secondary bg-clip-text text-transparent">master today?</span>
          </h1>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        className="relative group"
      >
        <div className={`absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-[32px] blur opacity-20 group-hover:opacity-40 transition duration-1000 ${isFocused ? 'opacity-50 blur-xl' : ''}`} />
        <div className="relative bg-[#0d1117] border border-white/10 rounded-[32px] p-2 flex items-center shadow-2xl">
          <div className="relative">
            <button 
              onClick={() => setShowSources(!showSources)}
              className={`p-4 ml-2 rounded-2xl transition-colors group/source ${selectedSource ? 'bg-primary/20 text-primary border border-primary/50' : 'hover:bg-white/5 text-gray-400'}`}
              title="Add Knowledge Source"
            >
              <Book className={`w-6 h-6 ${selectedSource ? 'animate-pulse' : ''}`} />
            </button>

            {/* Knowledge Source Dropdown */}
            <AnimatePresence>
              {showSources && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full left-0 mb-4 w-80 bg-[#161b22] border border-white/10 rounded-3xl p-6 shadow-3xl z-50 backdrop-blur-xl"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Library className="w-4 h-4 text-primary" />
                      <span className="text-xs font-black uppercase tracking-widest text-white">AI Library</span>
                    </div>
                    <button onClick={() => setShowSources(false)}>
                      <X className="w-4 h-4 text-gray-500 hover:text-white" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full p-4 rounded-2xl bg-white/5 border border-dashed border-white/10 hover:border-primary/50 hover:bg-primary/5 transition-all text-center group/upload"
                    >
                      {isUploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <Cpu className="w-6 h-6 text-primary animate-spin" />
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Indexing Source...</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-6 h-6 text-gray-500 group-hover/upload:text-primary mx-auto mb-2 transition-colors" />
                          <span className="text-xs font-bold text-gray-300">Upload Book (PDF/EPUB)</span>
                        </>
                      )}
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      className="hidden" 
                      accept=".pdf,.epub,.docx,.txt"
                    />

                    <div className="pt-4 border-t border-white/5">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-3 px-2">
                        {librarySources.length > 0 ? "AI Library" : "No sources yet"}
                      </p>
                      <div className="space-y-2">
                        {librarySources.map((source) => (
                          <button
                            key={source.id}
                            onClick={() => {
                              setSelectedSource({ id: source.id, name: source.title });
                              setShowSources(false);
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-left transition-colors group/item"
                          >
                            <FileText className="w-4 h-4 text-gray-600 group-hover/item:text-primary transition-colors" />
                            <span className="text-xs text-gray-400 group-hover/item:text-gray-200 transition-colors line-clamp-1">{source.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder={selectedSource ? `Master ${selectedSource.name}...` : "e.g. Quantum Computing, Advanced Python..."}
            className="flex-1 bg-transparent border-none py-6 px-8 text-xl md:text-2xl text-white placeholder-gray-600 focus:outline-none focus:ring-0"
          />
          
          <button 
            onClick={() => prompt.trim().length > 3 && onComplete({ 
              topic: prompt, 
              difficulty: "intermediate", 
              style: "interactive",
              source_id: selectedSource?.id
            })}
            className="p-4 md:p-6 bg-primary text-background rounded-2xl hover:scale-105 transition-transform group/btn mr-2"
          >
            <ArrowRight className="w-6 h-6 group-hover/btn:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Selected Source Indicator */}
        <AnimatePresence>
          {selectedSource && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute -top-12 left-8 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/20 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest"
            >
              <Book className="w-3 h-3" />
              <span>Sourced: {selectedSource.name}</span>
              <button onClick={() => setSelectedSource(null)} className="ml-1 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Suggested Tags */}
        <AnimatePresence>
          {!prompt && !selectedSource && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-wrap justify-center gap-3 mt-8"
            >
              {["Artificial Intelligence", "Blockchain", "Digital Arts", "Psychology"].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setPrompt(tag)}
                  className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-white hover:border-primary/50 transition-all"
                >
                  {tag}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32">
        {[
          { icon: Brain, title: "Source-Back Synthesis", desc: "AI builds curriculum directly from your uploaded books." },
          { icon: Library, title: "Global AI Library", desc: "Access shared knowledge from trusted institutional sources." },
          { icon: Globe, title: "Verified Academic", desc: "No hallucinations. Pure, verified knowledge sources only." }
        ].map((feature, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + idx * 0.1 }}
            className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-primary/30 transition-colors group"
          >
            <feature.icon className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
