'use client';
import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Zap, LogOut } from 'lucide-react';

import OverviewPanel from './admin/OverviewPanel';
import NotificationsPanel from './admin/NotificationsPanel';
import CourseReviewPanel from './admin/CourseReviewPanel';
import SeasonsPanel from './admin/SeasonsPanel';
import SettingsPanel from './admin/SettingsPanel';
import UsersPanel from './admin/UsersPanel';
import PayoutsPanel from './admin/PayoutsPanel';
import CodesPanel from './admin/CodesPanel';
import DatabasePanel from './admin/DatabasePanel';
import AIStrategyPanel from './admin/AIStrategyPanel';
import LogsPanel from './admin/LogsPanel';
import Tab from './admin/Tab';

export const AdminDashboard = React.memo(function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = useMemo(() => [
    { key: 'overview', label: '📊 Overview' },
    { key: 'notifications', label: '🔔 Alerts' },
    { key: 'reviews', label: '🎓 Reviews' },
    { key: 'seasons', label: '📅 Seasons' },
    { key: 'settings', label: '⚙️ Settings' },
    { key: 'users', label: '👥 Users' },
    { key: 'payouts', label: '💰 Payouts' },
    { key: 'codes', label: '🔑 Codes' },
    { key: 'database', label: '🗄️ Database' },
    { key: 'ai', label: '🧠 AI Strategy' },
    { key: 'logs', label: '📜 Logs' },
  ], []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('access_token');
    sessionStorage.removeItem('admin_unlocked');
    window.location.href = '/admin-login';
  }, []);

  const handleTabClick = useCallback((key: string) => {
    setActiveTab(key);
  }, []);

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-10 pb-6 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30 shadow-[0_0_20px_rgba(0,224,255,0.15)]">
               <Zap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-1">Super Admin Infrastructure</h1>
              <p className="text-[10px] uppercase font-bold text-gray-500 tracking-[0.2em]">Global Maintenance Command Center</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all text-xs font-bold"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-10 bg-slate-900/60 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 w-fit mx-auto shadow-2xl">
          {tabs.map(t => (
            <Tab 
              key={t.key} 
              tabKey={t.key}
              label={t.label} 
              active={activeTab === t.key} 
              onClick={handleTabClick} 
            />
          ))}
        </div>
        <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}>
          {activeTab === 'overview' && <OverviewPanel />}
          {activeTab === 'notifications' && <NotificationsPanel />}
          {activeTab === 'reviews' && <CourseReviewPanel />}
          {activeTab === 'seasons' && <SeasonsPanel />}
          {activeTab === 'settings' && <SettingsPanel />}
          {activeTab === 'users' && <UsersPanel />}
          {activeTab === 'payouts' && <PayoutsPanel />}
          {activeTab === 'codes' && <CodesPanel />}
          {activeTab === 'database' && <DatabasePanel />}
          {activeTab === 'ai' && <AIStrategyPanel />}
          {activeTab === 'logs' && <LogsPanel />}
        </motion.div>
      </div>
    </div>
  );
});

export default AdminDashboard;
