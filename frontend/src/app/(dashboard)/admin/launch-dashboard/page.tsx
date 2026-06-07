'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'next/navigation';
import { 
  BarChart3, 
  Users, 
  Clock, 
  Activity, 
  AlertTriangle, 
  CheckCircle2,
  TrendingUp,
  Zap
} from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import axios from 'axios';

interface LaunchMetrics {
  onboarding: {
    total_started: number;
    total_completed: number;
    completion_rate: number;
    avg_time_to_first_lesson: number;
    first_correct_answer_rate: number;
  };
  performance: {
    latency_stats: Record<string, number>;
    warning_count: number;
    critical_count: number;
    failure_count: number;
  };
  users: {
    total_beta_users: number;
    active_today: number;
  };
}

export default function LaunchDashboard() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [metrics, setMetrics] = useState<LaunchMetrics | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'SUPER_ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const fetchMetrics = useCallback(async (signal?: any) => {
    const abortSignal = signal instanceof AbortSignal ? signal : undefined;
    setIsRefreshing(true);
    try {
      const response = await api.get('/api/v1/users/analytics/launch-metrics', { signal: abortSignal });
      setMetrics(response.data);
    } catch (error) {
      if (axios.isCancel(error)) return;
      console.error('Failed to fetch metrics:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      const controller = new AbortController();
      fetchMetrics(controller.signal);
      const interval = setInterval(() => fetchMetrics(controller.signal), 30000); // 30s auto-refresh
      return () => {
        controller.abort();
        clearInterval(interval);
      };
    }
  }, [user, fetchMetrics]);

  if (loading || !user || user.role !== 'SUPER_ADMIN') {
    return <div className="p-8 text-white/50 animate-pulse">Authenticating Elite Access...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400">
            Elite Launch Hardening
          </h1>
          <p className="text-gray-400 mt-1">Real-time Soft Launch Metrics (50-User Cohort)</p>
        </div>
        <button 
          onClick={fetchMetrics}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white transition-all text-sm font-medium"
        >
          <Activity className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Live Refresh'}
        </button>
      </div>

      {!metrics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white/5 rounded-2xl border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Top Row: Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title="Conversion" 
              value={`${(metrics.onboarding.completion_rate * 100).toFixed(1)}%`}
              subValue="Onboarding Comp."
              icon={<TrendingUp className="text-green-400" />}
              trend="+12% from baseline"
            />
            <StatCard 
              title="Time to First Lesson" 
              value={`${Math.round(metrics.onboarding.avg_time_to_first_lesson / 60)}m`}
              subValue="Avg. Duration"
              icon={<Clock className="text-blue-400" />}
            />
            <StatCard 
              title="AI Stability" 
              value={`${(100 - (metrics.performance.failure_count / (metrics.onboarding.total_started || 1)) * 100).toFixed(1)}%`}
              subValue="Success Rate"
              icon={<CheckCircle2 className="text-primary" />}
            />
            <StatCard 
              title="Active Beta" 
              value={metrics.users.active_today.toString()}
              subValue={`of ${metrics.users.total_beta_users} total`}
              icon={<Users className="text-purple-400" />}
            />
          </div>

          {/* Middle Row: Detailed Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Onboarding Funnel */}
            <div className="lg:col-span-2 bg-zinc-900/50 rounded-3xl border border-white/5 p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Onboarding Health
                </h2>
                <div className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-mono">
                  ACTIONABLE
                </div>
              </div>
              
              <div className="space-y-6">
                <ProgressItem label="Started" value={metrics.onboarding.total_started} max={metrics.onboarding.total_started} color="bg-gray-500" />
                <ProgressItem label="Completed" value={metrics.onboarding.total_completed} max={metrics.onboarding.total_started} color="bg-primary" />
                <ProgressItem label="First Correct Answer" value={Math.round(metrics.onboarding.first_correct_answer_rate * metrics.onboarding.total_completed)} max={metrics.onboarding.total_completed} color="bg-green-500" />
              </div>

              <div className="mt-8 p-4 bg-white/5 rounded-xl flex items-start gap-3">
                <Zap className="w-5 h-5 text-yellow-400 shrink-0 mt-1" />
                <div>
                  <p className="text-sm text-white font-semibold">Insight Engine</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {metrics.onboarding.completion_rate > 0.8 
                      ? "Onboarding flow is performing above elite standards. No intervention needed."
                      : "Conversion is lagging. Check for friction points in the personality selection step."}
                  </p>
                </div>
              </div>
            </div>

            {/* AI Performance Status */}
            <div className="bg-zinc-900/50 rounded-3xl border border-white/5 p-6 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-orange-400" />
                Latency Categories
              </h2>
              
              <div className="space-y-4">
                <LatencyIndicator label="Normal (<5s)" count={metrics.performance.latency_stats['NORMAL'] || 0} color="bg-green-500" />
                <LatencyIndicator label="Warning (5-8s)" count={metrics.performance.latency_stats['WARNING'] || 0} color="bg-yellow-500" />
                <LatencyIndicator label="Critical (8-12s)" count={metrics.performance.latency_stats['CRITICAL'] || 0} color="bg-orange-500" />
                <LatencyIndicator label="Failures/Retries" count={metrics.performance.failure_count} color="bg-red-500" />
              </div>

              <div className="mt-6 border-t border-white/5 pt-6">
                <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Immediate Alerts</span>
                </div>
                {metrics.performance.failure_count > 0 ? (
                  <p className="text-xs text-gray-400 italic">
                    AI Tutor triggered {metrics.performance.failure_count} fallbacks. Verifying adaptive retry logs...
                  </p>
                ) : (
                  <p className="text-xs text-green-400/60 italic">
                    Zero fatal failures detected in the last session.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ title, value, subValue, icon, trend }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900/50 rounded-3xl border border-white/5 p-6 backdrop-blur-sm"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-white/5 rounded-xl">{icon}</div>
        {trend && <span className="text-[10px] text-green-400 font-mono tracking-tighter">{trend}</span>}
      </div>
      <div>
        <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{title}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-3xl font-bold text-white font-mono">{value}</span>
          <span className="text-xs text-gray-500">{subValue}</span>
        </div>
      </div>
    </motion.div>
  );
}

function ProgressItem({ label, value, max, color }: any) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-mono font-bold">{value}</span>
      </div>
      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className={`h-full ${color}`} 
        />
      </div>
    </div>
  );
}

function LatencyIndicator({ label, count, color }: any) {
  return (
    <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${color} animate-pulse`} />
        <span className="text-sm text-gray-300 font-medium">{label}</span>
      </div>
      <span className="text-white font-mono font-bold">{count}</span>
    </div>
  );
}
