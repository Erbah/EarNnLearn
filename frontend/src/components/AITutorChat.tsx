"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { Send, User, Bot, AlertCircle, Maximize2, Minimize2, X } from "lucide-react";
import { whiteboardManager } from "@/lib/whiteboard";
import { AriaOrb } from "@/components/AriaOrb";
import { cleanLessonContent } from "@/lib/content";


interface Message {
  id: string;
  role: "user" | "teacher" | "tutor" | "peer";
  content: string;
  timestamp: string;
}

interface AITutorChatProps {
  lessonId: string;
  currentSceneId?: string;
}

export default function AITutorChat({
  lessonId,
  currentSceneId,
}: AITutorChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<
    "teacher" | "tutor" | "peer"
  >("teacher");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Load chat history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await api.get(
          `/api/v1/education/lessons/${lessonId}/chat/history`
        );
        if (res.status === 200) {
          setMessages(res.data.messages || []);
        }
      } catch (err: any) {
        console.debug("Chat history not available:", err.response?.status);
      }
    };

    loadHistory();
  }, [lessonId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isFullScreen]);

  // Handle Escape key to exit full screen
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullScreen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const processWhiteboardCommands = (text: string) => {
    // 🎬 Visual Sequence Engine Parser (v1)
    let remainingText = text;
    let sequenceStartIndex;
    
    while ((sequenceStartIndex = remainingText.indexOf("[VISUAL_SEQUENCE:")) !== -1) {
      let bracketCount = 0;
      let braceCount = 0;
      let endIndex = -1;
      
      for (let i = sequenceStartIndex; i < remainingText.length; i++) {
        if (remainingText[i] === "[") bracketCount++;
        else if (remainingText[i] === "]") bracketCount--;
        else if (remainingText[i] === "{") braceCount++;
        else if (remainingText[i] === "}") braceCount--;
        
        if (bracketCount === 0 && braceCount === 0 && i > sequenceStartIndex + 15) {
          endIndex = i;
          break;
        }
      }

      if (endIndex !== -1) {
        const rawTag = remainingText.substring(sequenceStartIndex, endIndex + 1);
        try {
          const jsonStart = rawTag.indexOf("{");
          const jsonEnd = rawTag.lastIndexOf("}");
          if (jsonStart !== -1 && jsonEnd !== -1) {
            let commandJson = rawTag.substring(jsonStart, jsonEnd + 1).trim();
            
            // --- 🛡️ STEEL-PLATED JSON CLEANER ---
            // Remove markdown code fences if the AI wrapped the JSON
            commandJson = commandJson.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
            
            const sequenceData = JSON.parse(commandJson);
            whiteboardManager.runSequence(sequenceData);
          }
        } catch (err) {
          console.error("Error parsing visual sequence:", err);
        }
        remainingText = remainingText.substring(0, sequenceStartIndex) + remainingText.substring(endIndex + 1);
      } else { break; }
    }

    // 🎨 Legacy Whiteboard Command Extractor
    let startIndex;
    while ((startIndex = remainingText.indexOf("[WHITEBOARD:")) !== -1) {
      let bracketCount = 0;
      let braceCount = 0;
      let endIndex = -1;
      
      for (let i = startIndex; i < remainingText.length; i++) {
        if (remainingText[i] === "[") bracketCount++;
        else if (remainingText[i] === "]") bracketCount--;
        else if (remainingText[i] === "{") braceCount++;
        else if (remainingText[i] === "}") braceCount--;
        
        if (bracketCount === 0 && braceCount === 0 && i > startIndex + 12) {
          endIndex = i;
          break;
        }
      }

      if (endIndex !== -1) {
        const rawTag = remainingText.substring(startIndex, endIndex + 1);
        try {
          // Inner JSON is between the first '{' and the last '}' before the closing ']'
          const jsonStart = rawTag.indexOf("{");
          const jsonEnd = rawTag.lastIndexOf("}");
          
          if (jsonStart !== -1 && jsonEnd !== -1) {
            let commandJson = rawTag.substring(jsonStart, jsonEnd + 1).trim();

            // --- STEEL-PLATED JSON REPAIR LAYER ---
            commandJson = commandJson.replace(/}\s*({)/g, '},$1');
            commandJson = commandJson.replace(/]\s*({)/g, '],$1');
            commandJson = commandJson.replace(/}\s*(\[)/g, '},$1');
            commandJson = commandJson.replace(/,\s*([\]}])/g, '$1');
            
            const command = JSON.parse(commandJson);

            // Execute drawing commands
            if (command.action === "drawPath") {
              whiteboardManager.drawPath(
                command.points,
                command.color || "#06b6d4",
                command.width || 2,
                command.duration || 500
              );
            } else if (command.action === "addText") {
              whiteboardManager.addText({
                content: command.content,
                x: command.x,
                y: command.y,
                color: command.color || "#ffffff",
                fontSize: command.fontSize || "16px",
              });
            } else if (command.action === "clear") {
              whiteboardManager.clear();
            }
          }
        } catch (err) {
          console.error("Error parsing whiteboard command:", err);
        }
        
        // Remove the processed tag from the text
        remainingText = remainingText.substring(0, startIndex) + remainingText.substring(endIndex + 1);
      } else {
        // Unclosed tag - remove from this point forward to prevent UI leaks
        remainingText = remainingText.substring(0, startIndex);
        break;
      }
    }

    // Use the global cleaner for equation formatting and whitespace normalization
    return cleanLessonContent(remainingText);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);

    // Add user message to chat
    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setLoading(true);

    try {
      const res = await api.post(
        `/api/v1/education/lessons/${lessonId}/chat`,
        {
          message: userMessage,
          tutor_role: selectedRole,
          scene_id: currentSceneId,
        }
      );

      if (res.status === 200) {
        const rawContent = res.data.response;
        let cleanContent = "";

        // --- 🧠 DUAL-CHANNEL COGNITION ORCHESTRATOR ---
        try {
          // Attempt to parse the response as a Pure JSON reasoning object
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

          if (parsed && typeof parsed.explanation === "string" && parsed.visual) {
            // Priority 1: High-Fidelity Reasoning Protocol
            cleanContent = cleanLessonContent(parsed.explanation);
            
            // Execute Visual Sequence if present
            if (parsed.visual.type === "sequence" && Array.isArray(parsed.visual.steps)) {
              whiteboardManager.runSequence(parsed.visual);
            }
          } else {
            // Priority 2: Legacy Tag-Based Protocol
            cleanContent = processWhiteboardCommands(rawContent);
          }
        } catch (err) {
          // Priority 3: Raw Text Fallback
          cleanContent = processWhiteboardCommands(rawContent);
        }

        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: selectedRole,
          content: cleanContent || "I've updated the Visual Lab for you.",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const errorMsg =
        typeof detail === "string" ? detail : "Failed to get response";
      setError(errorMsg);

      // Add error message to chat
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "teacher",
        content: `Sorry, I couldn't process that. Error: ${errorMsg}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className={`transition-all duration-300 ease-in-out ${
        isFullScreen 
          ? "fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col p-6 overflow-hidden" 
          : "bg-card/70 border border-white/10 rounded-2xl p-6 glass"
      }`}
    >
      <div className={`${isFullScreen ? "max-w-3xl mx-auto w-full flex flex-col h-full" : "flex flex-col h-full"}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-secondary" />
            <span className={isFullScreen ? "text-2xl font-black" : "text-base"}>AI Tutor Assistant</span>
          </h3>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
              title={isFullScreen ? "Exit Full Screen" : "Full Screen Reader"}
            >
              {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            {isFullScreen && (
              <button
                onClick={() => setIsFullScreen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Role Selector */}
        <div className="flex gap-2 mb-6">
          {(["teacher", "tutor", "peer"] as const).map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedRole === role
                  ? "bg-primary text-background"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
            >
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </button>
          ))}
        </div>

        {/* Messages Container */}
        <div 
          className={`bg-black/20 border border-white/5 rounded-xl p-4 overflow-y-auto mb-4 space-y-6 ${
            isFullScreen ? "flex-1 min-h-0" : "h-96"
          }`}
        >
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <AriaOrb state="idle" size={80} className="mx-auto mb-4" />
                <p className="text-gray-500 text-sm max-w-[200px] mx-auto">
                  Ask me anything about this lesson. I'm here to help you master these concepts.
                </p>
              </div>
            </div>
          )}

          {messages.map((message, idx) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`flex gap-3 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role !== "user" && (
                <div className="flex-shrink-0 mt-1">
                  <AriaOrb state="speaking" size={isFullScreen ? 48 : 32} />
                </div>
              )}

              <div
                className={`max-w-[85%] px-5 py-3 rounded-2xl ${
                  message.role === "user"
                    ? "bg-primary text-background rounded-br-none"
                    : "bg-white/10 text-gray-100 rounded-bl-none border border-white/5"
                } ${isFullScreen ? "text-xl leading-relaxed" : "text-base leading-relaxed"}`}
              >
                {message.role === "user" ? (
                  <p>{message.content}</p>
                ) : (
                  <div 
                    dangerouslySetInnerHTML={{ __html: cleanLessonContent(message.content) }}
                    className={isFullScreen ? "leading-loose" : "leading-relaxed"}
                  />
                )}
                <p
                  className={`text-xs mt-1 ${
                    message.role === "user" ? "text-background/70" : "text-gray-500"
                  }`}
                >
                  {new Date(message.timestamp).toLocaleTimeString()}
                </p>
              </div>

              {message.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
              )}
            </motion.div>
          ))}

          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
            >
              <div className="flex-shrink-0 mt-1">
                <AriaOrb state="thinking" size={isFullScreen ? 48 : 32} />
              </div>
              <div className={`bg-white/10 px-5 py-3 rounded-2xl rounded-bl-none ${isFullScreen ? "w-24" : "w-16"}`}>
                <div className="flex gap-2 py-1 items-center justify-center">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ scaleY: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                      className={`bg-secondary/60 rounded-full ${isFullScreen ? "w-2 h-6" : "w-1.5 h-3"}`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-300 text-sm"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Input */}
        <div className={`flex gap-3 ${isFullScreen ? "mt-4 pb-4" : ""}`}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder={`Ask the ${selectedRole}...`}
            disabled={loading}
            className={`flex-1 px-5 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors disabled:opacity-50 ${
              isFullScreen ? "text-lg" : "text-base"
            }`}
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || loading}
            className={`flex items-center justify-center bg-primary text-background rounded-xl font-bold hover:bg-primary/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isFullScreen ? "w-16 h-14" : "w-12 h-12"
            }`}
          >
            <Send className={isFullScreen ? "w-6 h-6" : "w-5 h-5"} />
          </button>
        </div>
      </div>
    </div>
  );
}
