'use client';
import React, { useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Database } from 'lucide-react';
import { Stat } from './Stat';
import { RealDatabaseInspector } from './RealDatabaseInspector';

export const DatabasePanel = React.memo(function DatabasePanel() {
  const [showInspector, setShowInspector] = useState(false);

  const handleOpenInspector = useCallback(() => {
    setShowInspector(true);
  }, []);

  const handleCloseInspector = useCallback(() => {
    setShowInspector(false);
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Stat label="DB Engine" value="SQLite 3.x" color="#10B981" />
        <Stat label="Storage" value="Persistent" color="#3B82F6" />
        <Stat label="Security" value="Admin Restricted" color="#F59E0B" />
      </div>
      <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center space-y-6 backdrop-blur-md">
        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto text-primary shadow-lg shadow-primary/10">
          <Database size={40} />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-white">System Database Explorer</h3>
          <p className="text-gray-400 max-w-md mx-auto text-sm leading-relaxed">
            Directly access the core data layer. Audit tables, verify transaction records, and monitor user state changes with precision.
          </p>
        </div>
        <button
          onClick={handleOpenInspector}
          className="bg-primary text-black px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-primary/20 active:scale-95"
        >
          Initialize Explorer
        </button>
      </div>
      <AnimatePresence>
        {showInspector && <RealDatabaseInspector onClose={handleCloseInspector} />}
      </AnimatePresence>
    </div>
  );
});

export default DatabasePanel;
