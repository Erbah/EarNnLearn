"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, PlayCircle, KeyRound, Lightbulb, Users, ShieldCheck, Zap, Cpu, Award } from "lucide-react";
import { LandingHeader } from "@/components/LandingHeader";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden flex flex-col">
      <LandingHeader />
      <div className="relative flex-1 flex flex-col">
        {/* Hero Section */}
        <section className="relative min-h-[calc(100vh-80px)] flex items-center justify-center pt-20">
        {/* Background Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 blur-[150px] rounded-full pointer-events-none -z-10" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-secondary/10 blur-[150px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-4xl mx-auto px-6 text-center z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <span className="inline-block py-1.5 px-4 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
              The #1 Tech Network Marketing Platform
            </span>
            <h2 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-tight mb-8">
              Learn Technical Skills. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-400 to-secondary">
                Earn Infinite Commissions.
              </span>
            </h2>
            <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
              Activate your product code, access premium courses, and build your network. 
              Get paid instantly every time your network grows.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
              <Link href="/register" className="w-full sm:w-auto px-8 py-4 bg-primary text-background font-bold rounded-full hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(0,224,255,0.4)] hover:shadow-[0_0_30px_rgba(0,224,255,0.6)] flex items-center justify-center group">
                Activate Product Code
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#how-it-works" className="w-full sm:w-auto px-8 py-4 bg-card border border-white/10 text-white font-medium rounded-full hover:bg-white/5 transition-all flex items-center justify-center group">
                <PlayCircle className="w-5 h-5 mr-2 text-gray-400 group-hover:text-white transition-colors" />
                How It Works
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works simple section */}
      <section id="how-it-works" className="py-24 bg-card/30 border-t border-white/5 relative z-10 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-white mb-4">A simple cycle of success</h3>
            <p className="text-gray-400">Master the tech stack while mastering your financial freedom.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-card border border-white/5 glass text-center hover:border-primary/30 transition-colors">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <KeyRound className="w-8 h-8 text-primary" />
              </div>
              <h4 className="text-xl font-bold text-white mb-3">1. Activate</h4>
              <p className="text-gray-400 text-sm leading-relaxed">Purchase an activation code from a sponsor to unlock your portal and training modules.</p>
            </div>
            
            <div className="p-8 rounded-2xl bg-card border border-white/5 glass text-center hover:border-blue-400/30 transition-colors">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-6">
                <Lightbulb className="w-8 h-8 text-blue-400" />
              </div>
              <h4 className="text-xl font-bold text-white mb-3">2. Learn</h4>
              <p className="text-gray-400 text-sm leading-relaxed">Gain access to premium technical courses and digital products instantly.</p>
            </div>
            
            <div className="p-8 rounded-2xl bg-card border border-white/5 glass text-center hover:border-secondary/30 transition-colors">
              <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-6">
                <Users className="w-8 h-8 text-secondary" />
              </div>
              <h4 className="text-xl font-bold text-white mb-3">3. Earn</h4>
              <p className="text-gray-400 text-sm leading-relaxed">Resell codes and build your network. Earn active & passive commissions up to infinity levels.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 border-t border-white/5 relative z-10 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-white mb-4">Engineered for Massive Scaling</h3>
            <p className="text-gray-400">Unlock features designed to scale your network to 10M+ users seamlessly.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-8 rounded-2xl bg-card border border-white/5 glass hover:border-primary/20 transition-all flex gap-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-white mb-2">Automated Verification</h4>
                <p className="text-gray-400 text-sm leading-relaxed">Instantly verify activation codes and referral links with cryptographic consensus checks.</p>
              </div>
            </div>

            <div className="p-8 rounded-2xl bg-card border border-white/5 glass hover:border-blue-400/20 transition-all flex gap-6">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-white mb-2">Instant Splits & Payouts</h4>
                <p className="text-gray-400 text-sm leading-relaxed">Profits split automatically upon referral activation. Cash out instantly directly from your portal.</p>
              </div>
            </div>

            <div className="p-8 rounded-2xl bg-card border border-white/5 glass hover:border-secondary/20 transition-all flex gap-6">
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                <Cpu className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-white mb-2">AI-Powered Teacher</h4>
                <p className="text-gray-400 text-sm leading-relaxed">Learn technical skills with interactive AI mentors guiding your path with targeted lessons.</p>
              </div>
            </div>

            <div className="p-8 rounded-2xl bg-card border border-white/5 glass hover:border-purple-500/20 transition-all flex gap-6">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Award className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-white mb-2">Seasonal Leaderboards</h4>
                <p className="text-gray-400 text-sm leading-relaxed">Participate in dynamic global cycles. Earn unique achievements and platform rewards.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}
