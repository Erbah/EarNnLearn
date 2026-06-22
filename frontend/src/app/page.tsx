"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, PlayCircle, KeyRound, Lightbulb, Users, ShieldCheck, Zap, Cpu, Award, BookOpen, TrendingUp, DollarSign, Wallet, Building2 } from "lucide-react";
import { LandingHeader } from "@/components/LandingHeader";
import { API_BASE_URL } from "@/lib/api";

export default function LandingPage() {
  const [config, setConfig] = useState({
    seller_percentage: 0.70,
    family_percentage: 0.25,
    master_percentage: 0.05,
    activation_price: 20.0
  });

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/marketplace/config`)
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.seller_percentage === 'number') {
          setConfig(data);
        }
      })
      .catch(err => console.error("Error loading config:", err));
  }, []);

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
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <span className="text-sm font-semibold tracking-wider text-primary uppercase">Ecosystem Dynamics</span>
            <h3 className="text-3xl md:text-4xl font-bold text-white mt-2 mb-4">How the Platform Works</h3>
            <p className="text-gray-400 max-w-2xl mx-auto">Master digital skills, publish your expertise, and build network wealth in a multi-tier commission economy.</p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8 items-stretch">
            
            {/* 1. The Learning Portal */}
            <div className="p-8 rounded-3xl bg-card border border-white/5 glass flex flex-col justify-between hover:border-primary/20 transition-all duration-300">
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-primary uppercase tracking-widest">Pillar One</span>
                    <h4 className="text-xl font-bold text-white">The Learning Journey</h4>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                  Gain access to a world-class training center that turns beginners into tech professionals. Our education portal features structured curriculums, bite-sized video learning, and interactive projects.
                </p>
                
                <div className="space-y-5">
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Cpu className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <h5 className="font-semibold text-white text-sm">Interactive AI Tutor</h5>
                      <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">Every course includes an AI tutor. Get explanations for code, custom quiz questions, and direct support on any lesson.</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Lightbulb className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div>
                      <h5 className="font-semibold text-white text-sm">Premium Tech Subjects</h5>
                      <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">Master programming, Artificial Intelligence engineering, digital marketing, business development, and personal finance via modular chapters.</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Award className="w-3.5 h-3.5 text-secondary" />
                    </div>
                    <div>
                      <h5 className="font-semibold text-white text-sm">Verified Certifications</h5>
                      <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">Pass final lesson quizzes to unlock cryptographic completion certificates that verify your skills directly to clients.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
                <span className="text-[10px] text-gray-500 font-medium">Self-Paced • AI Guided</span>
                <Link href="/register" className="text-xs font-semibold text-primary hover:text-cyan-300 transition-colors flex items-center gap-1">
                  Browse Courses <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* 2. Creator & Institution Space */}
            <div className="p-8 rounded-3xl bg-card border border-white/5 glass flex flex-col justify-between hover:border-blue-400/20 transition-all duration-300">
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Pillar Two</span>
                    <h4 className="text-xl font-bold text-white">Creator Space</h4>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                  Publish high-value educational content and establish your brand on a globally scaling platform. Tools designed for universities, content creators, and independent instructors.
                </p>
                
                <div className="space-y-5">
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Zap className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div>
                      <h5 className="font-semibold text-white text-sm">Course Ingestion Tools</h5>
                      <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">Create structured course syllabi, add learning modules, and import videos via YouTube playlists with a single click.</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-semibold text-white text-sm">Earning-Powered Payments</h5>
                        <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">Flexible</span>
                      </div>
                      <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">Students can pay for your courses using their platform wallet earnings or pay upfront using card/mobile money simulators.</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <h5 className="font-semibold text-white text-sm">Creator Analytics</h5>
                      <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">Track student counts, ratings, reviews, revenue split metrics, and referral network reach directly from your creator studio.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
                <span className="text-[10px] text-gray-500 font-medium">Publish • Earn • Scale</span>
                <Link href="/register" className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
                  Become a Creator <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
            
            {/* 3. The Referral Economy */}
            <div className="p-8 rounded-3xl bg-card border border-white/5 glass flex flex-col justify-between hover:border-secondary/20 transition-all duration-300">
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-secondary uppercase tracking-widest">Pillar Three</span>
                    <h4 className="text-xl font-bold text-white">Referral Economy</h4>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                  Earn active and passive commission splits as you help grow the platform. When a new user activates their portal using your code, the activation fee is split instantly.
                </p>
                
                <div className="space-y-5">
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-semibold text-white text-sm">{Math.round(config.seller_percentage * 100)}% Direct Seller Share</h5>
                        <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">Active</span>
                      </div>
                      <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">Keep the majority of every direct sale. Resell activation codes directly to new students and receive a {Math.round(config.seller_percentage * 100)}% payout instantly in your wallet.</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-secondary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-semibold text-white text-sm">{Math.round(config.family_percentage * 100)}% Network Splits</h5>
                        <span className="text-[10px] font-bold bg-pink-500/10 text-secondary border border-pink-500/20 px-1.5 py-0.5 rounded">Passive</span>
                      </div>
                      <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">Build downstream income. When referrals you sponsored make sales, a {Math.round(config.family_percentage * 100)}% passive share is distributed up the network tree to sponsors.</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Wallet className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-semibold text-white text-sm">{Math.round(config.master_percentage * 100)}% Master node & Settlements</h5>
                        <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded">System</span>
                      </div>
                      <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">A minimal {Math.round(config.master_percentage * 100)}% platform fee is kept to power interactive AI APIs. All commissions land instantly in your dashboard and can be withdrawn anytime.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
                <span className="text-[10px] text-gray-500 font-medium">Transparent • Instant Settlements</span>
                <Link href="/register" className="text-sm font-semibold text-secondary hover:text-pink-300 transition-colors flex items-center gap-1">
                  Activate Now <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
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
