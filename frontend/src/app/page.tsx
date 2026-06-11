"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, PlayCircle, KeyRound, Lightbulb, Users } from "lucide-react";
import { TopBanner } from "@/components/TopBanner";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden flex flex-col">
      <TopBanner />
      <div className="relative flex-1 flex flex-col">
        {/* Navbar Minimal */}
        <nav className="absolute top-0 w-full p-6 flex justify-between items-center z-50">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">EarNnLearN</h1>
          <div className="space-x-4">
            <Link href="/login" className="text-white hover:text-primary transition-colors text-sm font-medium">Login</Link>
            <Link href="/register" className="bg-white/10 hover:bg-white/20 px-5 py-2.5 rounded-full text-white transition-all text-sm font-medium border border-white/10 glass">Get Started</Link>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative min-h-[calc(100vh-40px)] flex items-center justify-center pt-20">
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
              <button className="w-full sm:w-auto px-8 py-4 bg-card border border-white/10 text-white font-medium rounded-full hover:bg-white/5 transition-all flex items-center justify-center group">
                <PlayCircle className="w-5 h-5 mr-2 text-gray-400 group-hover:text-white transition-colors" />
                How It Works
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works simple section */}
      <section className="py-24 bg-card/30 border-t border-white/5 relative z-10">
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
      </div>
    </div>
  );
}
