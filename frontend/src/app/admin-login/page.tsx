'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL, api } from '@/lib/api';
import { LandingHeader } from '@/components/LandingHeader';

const API = `${API_BASE_URL}/api/v1/admin`;

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    setError('');
    
    setLoading(true);
    try {
      const response = await api.post(`${API}/login`, { admin_password: password });
      if (response.data.token) localStorage.setItem('access_token', response.data.token);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Authorization failed');
      setLoading(false);
      return;
    }

    sessionStorage.setItem('admin_unlocked', 'true');
    setLoading(false);
    
    // Hard redirect to force layout reset and hit isolated dashboard
    window.location.href = '/admin-dashboard';
  };

  return (
    <div className="flex min-h-screen bg-background flex-col relative overflow-hidden text-foreground">
      <LandingHeader />
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-[400px] bg-primary/20 rounded-full blur-[150px] -z-10 opacity-70 pointer-events-none" />

      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md p-10 rounded-[32px] bg-card border border-white/10 shadow-2xl relative z-10"
        >
        <div className="text-center space-y-3 mb-8">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-primary/10 flex items-center justify-center text-4xl border border-primary/20 shadow-inner">
            🛡️
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Super Admin</h2>
          <p className="text-[14px] text-gray-400">Restricted zone. Enter the master credential.</p>
        </div>

        <div className="space-y-5">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-5 pr-12 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-all text-lg tracking-wider font-mono"
              placeholder="••••••••••••"
              autoFocus
            />
            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white transition-colors">
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-red-400 text-[13px] font-bold text-center bg-red-500/10 py-2 rounded-xl border border-red-500/20">
              {typeof error === 'string' ? error : JSON.stringify(error)}
            </motion.div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !password}
            className="w-full bg-primary text-background py-4 rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 disabled:opacity-50 mt-4"
          >
            {loading ? 'Authenticating Sequence...' : 'Unlock Gateway'}
          </button>
        </div>
      </motion.div>
      </div>
    </div>
  );
}
