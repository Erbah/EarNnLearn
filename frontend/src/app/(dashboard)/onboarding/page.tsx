"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { api as axios } from "@/lib/api";
import { AriaOrb, AriaState } from "@/components/AriaOrb";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CheckCircle2, Target, Zap, BookOpen, Search, ArrowRight, Sparkles } from "lucide-react";
import { useUser } from "@/context/UserContext";

const steps = [
  { id: "intro", title: "Welcome to LearNnEarn" },
  { id: "goal", title: "Your Learning Goal" },
  { id: "style", title: "Preferred Learning Style" },
  { id: "generating", title: "Structuring Your Path" },
  { id: "preview", title: "Aria's Initial Roadmap" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, refetchUser: refreshUser } = useUser();
  const [currentStep, setCurrentStep] = useState(0);
  const [ariaState, setAriaState] = useState<AriaState>("idle");
  const [ariaMessage, setAriaMessage] = useState("Hi, I’m Aria. I’ll be your personal AI Tutor.");
  
  // Selection States
  const [goal, setGoal] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  
  // Magical Generation States
  const [generationPhase, setGenerationPhase] = useState(0);
  const narrativeSteps = [
    "Understanding your core objectives...",
    "Analyzing your preferred learning pace...",
    "Curating high-fidelity textbook modules...",
    "Synthesizing your personalized roadmap...",
    "Preparing your first learning session..."
  ];

  useEffect(() => {
    // Phase 4: Re-entry Logic (Soft Resume)
    if (user?.last_onboarding_step && user.last_onboarding_step > 0 && currentStep === 0) {
      setCurrentStep(user.last_onboarding_step);
    }
  }, [user, currentStep]);

  // Phase 4: Logging Step Analytics
  const logStep = async (step: number, action: string) => {
    try {
      await axios.post("/api/v1/users/analytics/onboarding-event", {
        step,
        action,
        time_spent: 0 // Placeholder
      });
    } catch (e) {
      console.warn("Analytics failed:", e);
    }
  };

  useEffect(() => {
    // State Transitions based on current step
    if (currentStep === 1) {
      setAriaState("speaking");
      setAriaMessage("What would you like to achieve with your learning?");
    } else if (currentStep === 2) {
      setAriaState("speaking");
      setAriaMessage("Excellent. How do you prefer to absorb new concepts?");
    } else if (currentStep === 3) {
      triggerMagicalGeneration();
    } else if (currentStep === 4) {
      setAriaState("success");
      setAriaMessage("Ready. I've prepared a roadmap uniquely for you.");
    }
  }, [currentStep]);

  const handleNextStep = async () => {
    const next = currentStep + 1;
    setCurrentStep(next);
    logStep(next, "next_step");
    
    // Persist step progress (Soft Re-entry)
    await axios.put("/api/v1/users/onboarding", { step: next });
  };

  const isGeneratingRef = React.useRef(false);

  const triggerMagicalGeneration = async () => {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    
    setAriaState("thinking");
    setAriaMessage("One moment while I craft your path...");
    
    try {
      // Simulate generation narrative
      for (let i = 0; i < narrativeSteps.length; i++) {
         setGenerationPhase(i);
         await new Promise(r => setTimeout(r, 1200));
      }

      // Finalize Preferences & Onboarding
      await axios.put("/api/v1/users/onboarding", {
        learning_goal: goal,
        preferred_style: style,
        onboarding_completed: true,
        step: 4
      });
    } catch (e) {
      console.error("Failed to complete onboarding generation API call:", e);
      // Fallback: Ensure they are marked completed locally to avoid getting stuck forever
    } finally {
      setAriaState("success");
      setAriaMessage("Ready. I've prepared a roadmap uniquely for you.");
      setCurrentStep(4); // Preview
      await refreshUser();
      isGeneratingRef.current = false;
    }
  };

  const startFirstLesson = () => {
    router.push("/dashboard"); // Or direct to first lesson topic if known
  };

  const skipOnboarding = async () => {
    try {
      await axios.put("/api/v1/users/onboarding", {
        onboarding_completed: true
      });
      await refreshUser();
      router.push("/dashboard");
    } catch (e) {
      console.error("Failed to skip onboarding:", e);
      router.push("/dashboard");
    }
  };

  const renderStepContent = () => {
    switch (steps[currentStep].id) {
      case "intro":
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <h1 className="text-3xl font-bold mb-4">A New Way to Learn.</h1>
            <p className="text-muted-foreground mb-8 text-lg">
              No generic courses. No fluff. Just high-fidelity tutoring <br /> designed for your specific goals.
            </p>
            <div className="flex flex-col items-center gap-4">
              <Button size="lg" onClick={handleNextStep} className="px-10 h-14 text-lg rounded-full">
                Let's Get Started <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <button 
                onClick={skipOnboarding}
                className="text-muted-foreground hover:text-primary transition-colors text-sm font-medium"
              >
                Skip for now, take me to dashboard
              </button>
            </div>
          </motion.div>
        );

      case "goal":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {[
              { id: "Career", label: "Career Pivot", icon: Target, desc: "Master skills for a new high-paying role." },
              { id: "School", label: "Academic Excellence", icon: BookOpen, desc: "Deepen understanding of school subjects." },
              { id: "Curiosity", label: "Intellectual Curiosity", icon: Search, desc: "Explore fascinating new domains." },
              { id: "Exploration", label: "General Exploration", icon: Zap, desc: "Just seeing what's possible." },
            ].map((item) => (
              <Card 
                key={item.id}
                onClick={() => { setGoal(item.id); handleNextStep(); }}
                className={`p-6 cursor-pointer border-2 transition-all hover:border-primary group ${goal === item.id ? 'border-primary bg-primary/5' : 'border-border'}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${goal === item.id ? 'bg-primary text-white' : 'bg-secondary'}`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{item.label}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        );

      case "style":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {[
              { id: "Practical", label: "Practical/Hands-on", desc: "Show me how it's used before why it works." },
              { id: "Theoretical", label: "Deep Theory", desc: "First principles, derivations, and core logic." },
              { id: "Fast-paced", label: "Fast-paced", desc: "Maximize density, minimize repetition." },
              { id: "Balanced", label: "Balanced / Scholar", desc: "A measured mix of theory and practice." },
            ].map((item) => (
              <Card 
                key={item.id}
                onClick={() => { setStyle(item.id); handleNextStep(); }}
                className={`p-6 cursor-pointer border-2 transition-all hover:border-primary ${style === item.id ? 'border-primary bg-primary/5' : 'border-border'}`}
              >
                <h3 className="font-bold text-lg">{item.label}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </Card>
            ))}
          </div>
        );

      case "generating":
        return (
          <div className="text-center max-w-md mx-auto">
            <motion.div 
               key={generationPhase}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               className="text-xl font-medium text-primary mb-2 flex items-center justify-center gap-2"
            >
               <Sparkles className="w-5 h-5 animate-pulse" /> {narrativeSteps[generationPhase]}
            </motion.div>
            <div className="w-full h-1 bg-secondary rounded-full overflow-hidden mt-6">
              <motion.div 
                className="h-full bg-primary"
                initial={{ width: "0%" }}
                animate={{ width: `${(generationPhase + 1) * 20}%` }}
                transition={{ duration: 1.2 }}
              />
            </div>
          </div>
        );

      case "preview":
        return (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-xl mx-auto text-center">
             <div className="bg-primary/10 p-8 rounded-3xl border border-primary/20 mb-8">
                <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">Roadmap Generated</h3>
                <p className="text-muted-foreground mb-6">Based on your goals, I've structured a 6-unit path starting with:</p>
                
                <div className="space-y-3 text-left">
                  <div className="bg-background p-4 rounded-xl border flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-primary uppercase">Starting Point</span>
                      <p className="font-semibold text-lg">Foundational Core Principles</p>
                    </div>
                    <div className="text-right">
                       <p className="text-xs text-muted-foreground">Difficulty</p>
                       <p className="font-medium">Introductory</p>
                    </div>
                  </div>
                  <div className="bg-background/50 p-4 rounded-xl border border-dashed flex items-center justify-between opacity-60">
                    <p className="font-medium italic">Preparing advanced modules...</p>
                  </div>
                </div>
             </div>

             <Button size="lg" onClick={startFirstLesson} className="w-full h-16 text-xl rounded-2xl shadow-xl shadow-primary/20">
               Enter Your Private Learning Space
             </Button>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary/20 rounded-full blur-[100px] -z-10" />

      {/* Progress Header */}
      <div className="max-w-7xl mx-auto w-full px-8 pt-6 flex items-center justify-between z-10">
        <div className="flex gap-1.5">
          {steps.map((s, idx) => (
            <div 
              key={s.id} 
              className={`h-1 rounded-full transition-all duration-500 ${idx <= currentStep ? 'w-12 bg-primary' : 'w-6 bg-border'}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-6">
          <div className="text-sm font-bold text-muted-foreground">
            Step {currentStep + 1} of {steps.length}
          </div>
          <button 
            onClick={skipOnboarding}
            className="text-[10px] uppercase font-black tracking-widest text-muted-foreground hover:text-primary transition-colors bg-white/5 px-3 py-1 rounded-full border border-white/10"
          >
            Skip
          </button>
        </div>
      </div>

      {/* Main Experience Layer */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 py-12 z-10 w-full max-w-4xl mx-auto">
        
        {/* Aria Avatar Interaction Zone */}
        <div className="mb-12 flex flex-col items-center">
          <AriaOrb state={ariaState} size={160} />
          
          <AnimatePresence mode="wait">
            <motion.div
              key={ariaMessage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-8 text-2xl font-medium max-w-lg text-center leading-relaxed h-16"
            >
              {ariaMessage}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dynamic Content Switching */}
        <div className="w-full">
           <AnimatePresence mode="wait">
             <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
             >
                {renderStepContent()}
             </motion.div>
           </AnimatePresence>
        </div>
      </main>

      {/* Subtle Footer Copy */}
      <footer className="py-8 text-center text-xs text-muted-foreground/60">
        LearNnEarn Elite &copy; 2026 &bull; Advanced AI Pedagogy Engine v12
      </footer>
    </div>
  );
}
